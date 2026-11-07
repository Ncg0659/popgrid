# POPGRID — Performans ölçümü (Aşama 9)

Bu belge POPGRID'in performansının **tekrarlanabilir** biçimde nasıl ölçüldüğünü anlatır.
Betikler `scripts/perf/` altındadır. **Projenin bağımlılığı değildir, CI'de çalışmaz ve zorunlu testlere girmez.**

## Önemli sınırlar

- Ölçümler **Chromium emülasyonudur**: telefon görünümü (390×844, 3× piksel, dokunma) ve CPU yavaşlatma
  (`Emulation.setCPUThrottlingRate`). **Gerçek iPhone ölçümü değildir.** iPhone Safari (WebKit) farklı bir motordur;
  aynı darboğazın Safari'de aynı oranda olduğu buradan kanıtlanamaz.
- **1×** bu bilgisayarın hızıdır; yeni iPhone'lar tek çekirdekte buna yakındır. **4×** eski cihaz, Düşük Güç Modu
  ya da ısınmış telefon için "kötü durum" senaryosudur.
- Mutlaka **üretim derlemesi** ölçülür (`npm run build` → `dist/`). React'in geliştirme sürümü (ör. `npm run dev`)
  çok daha yavaştır; Aşama 8.3'teki 83–233 ms değerleri bu yüzden olduğundan kötü görünmüştü.
- Aynı bilgisayarda bile koşudan koşuya ±1 kare (16,7 ms) oynama olur. Bu yüzden her senaryo en az 3 kez çalıştırılır
  ve medyan raporlanır; önce/sonra karşılaştırması aynı bilgisayarda, art arda yapılır.

## Kurulum (projeye bağımlılık eklemeden)

Playwright yalnızca ölçüm yapan bilgisayarda gerekir; `package.json`'a **eklenmez**:

```
# Proje klasörünün dışında, bir kez:
mkdir -p ~/popgrid-perf-araclari && cd ~/popgrid-perf-araclari && npm i playwright && npx playwright install chromium
# Ölçüm sırasında Node'un bulabilmesi için:
export NODE_PATH=~/popgrid-perf-araclari/node_modules
```

Betikler projenin `vite-node` aracıyla çalışır (`npm ci` sonrası hazırdır).

## Ölçülen senaryolar

Hamleler botla ve sabit seed ile üretilir; her koşu birebir aynı oyunu oynar (`scripts/perf/common.ts`).

| Ad | Mod | Seed | Ölçülen an |
|---|---|---|---|
| `aim` | Klasik | 7 | Sürüklerken parça tahtada 4 köşe arasında gezer (her adımda yeni hedef hücre) |
| `place` | Klasik | 7 | Temizleme olmayan bir yerleştirme (bırakma + 1,3 sn) |
| `line` | Klasik | 7 | Hat temizleme (bırakma + efekt) |
| `chain` | Eğlence | 279 | Zincirleme bomba patlaması |
| `lucky` | Eğlence | 300 | Şanslı blok ödülü |

Ölçülen hamleye kadar oyun normal hızda oynanır; CPU yavaşlatma yalnızca ölçülen hamlede açılır.

## Komutlar

```
npm run build                                   # dist/ (üretim)

# 1) Kare süreleri (1× ve 4×, her senaryo 3 kez)
DIR=dist BASE=/popgrid/ LABEL=sonra N=3 RATES=1,4 npx vite-node scripts/perf/perf.ts
#    TRACE=1   → ilk koşunun iz kaydından uzun görevlerin içi (stil, yerleşim, JS …)
#    PROFILE=1 → ilk koşuda en çok süre alan JS fonksiyonları
#    SCEN=line,chain  → yalnızca bu senaryolar;  OUT=sonuc.json → ham sonuçlar

# 2) Önce/sonra görsel karşılaştırma (animasyonlar aynı anda dondurulur, piksel piksel)
git worktree add ../popgrid-main origin/main && (cd ../popgrid-main && npm ci && npm run build)
BEFORE=../popgrid-main/dist AFTER=dist BASE=/popgrid/ SHOTS=/tmp/popgrid-kareler npx vite-node scripts/perf/visual.ts

# 3) Stil hesabı mikro ölçümü (16 blok: durağan / animasyon blokta / animasyon dış kapta)
DIR=dist BASE=/popgrid/ RATE=4 npx vite-node scripts/perf/style-cost.ts
```

### Çıktı nasıl okunur

- **En uzun kare**: ölçülen pencere içindeki en uzun iki kare arası süre. 60 Hz'de bir kare 16,7 ms'dir;
  hedef, hiçbir karenin **50 ms**'yi geçmemesidir (yaklaşık 3 kare atlama).
- **50 ms+ kare**: o koşuda 50 ms'yi aşan kare sayısı.
- **Uzun görevler**: tarayıcının "long task" kayıtları (ana iş parçacığını 50 ms'den uzun tutan işler).
- `TRACE=1` dökümündeki adlar: `Document::recalcStyle` (stil hesabı), `LocalFrameView::performLayout` (yerleşim),
  `FunctionCall` (JavaScript: React, oyun mantığı), `Paint` (boyama).

### Görsel karşılaştırma nasıl çalışır

İki derleme aynı seed ve hamlelerle oynanır. Ölçülen hamleden sonra `document.getAnimations()` ile bütün CSS
animasyonları duraklatılır ve aynı ana (ör. 0, 30, 60 … ms) getirilir; tahta bölgesinin ekran görüntüsü alınır ve
piksel piksel karşılaştırılır. Parçacık katmanı tohumsuz rastgele olduğu için iki tarafta da gizlenir.
Hareketi Azalt ayarı da bir senaryo olarak denenir. Yöntemin farkı yakalayabildiği, kasıtlı bozulmuş bir
derlemeyle sınanmıştır (beyaz parlama kaldırıldığında 10 karede fark bulundu). Katman değişikliği kaynaklı ±2'lik
yuvarlama farkları da "fark" olarak sayılır; çıktıdaki "en büyük kanal farkı" bunları ayırt etmeye yarar.

## Bulgular ve yapılanlar

### Aşama 9 analizi (canlı sürüm, `main` @ 580aed4)

En büyük maliyet: temizlenen/patlayan blokların "pop" kopyaları ve yeni yerleşen bloğun zıplaması, ağır blok
stilinin (iç/dış gölgeler, degrade, `calc(var(--u))`) **taşındığı öğenin kendisinde** canlanıyordu. Chromium,
animasyonlu öğenin stilini çok daha pahalı hesaplıyor: 4×'te blok başına ≈2,5 ms (16 blok ≈40 ms; aynı bloklar
animasyonsuz ≈4 ms).

### Aşama 9.1 — animasyonlar dış kapta

- Temizleme/patlama kopyası: `<span class="fx-pop"><span class="blk"/></span>` — animasyon (`block-pop`) dış kapta,
  blok içinde durağan. Beyaz parlama kabın `::after` katmanında (bloğun üstünde). Parlama bloğun kendi `::before`'unda
  kalınca Chromium efekt boyunca her karede stil hesabı yaptı (4×'te kare başına ≈16 ms); kapta bu olmuyor.
  Görsel karşılaştırmada bu biçim popların alt kenarında ince bir şeritte, yalnızca 300 ms'lik parlama sırasında
  en çok 26/255 parlaklık farkı gösterdi (bkz. Aşama 9.1 raporu).
- Yeni yerleşen blok: yalnızca o hamlede `<span class="fx-place"><span class="blk"/></span>`; zıplama dış kapta.
- Kap, bloğun kutusuyla aynıdır; dönüşüm merkezi, ölçek ve opaklık birebir aynı kalır.
- Etkilenen seçiciler (`.cell > .blk`, temizlenecek satır parlaması, Çekiç hedefleri) kaplı blok için de yazıldı.

Sonuçlar için Aşama 9.1 raporuna bakın.

### Aşama 9.2 — parçacık katmanı (Canvas)

- Parçacık döngüsü her karede `window.innerWidth/innerHeight` okuyordu. Sayfada o karede stil değişmişse (patlama
  animasyonları başlarken) bu okuma tarayıcıyı stil ve yerleşimi hemen hesaplamaya zorlar.
- Artık pencere boyutu yalnızca efekt başlarken ve `resize` olayından sonra okunur; temizleme önbellekteki boyutla
  yapılır. Bileşen kaldırılınca dinleyici bırakılır (`destroy`).
- Çizim davranışı aynıdır: eski ve yeni sınıf, aynı rastgele dizi ve aynı kare zamanlarıyla birebir aynı çizim
  komutlarını üretti. `tests/particles.test.ts` okuma sayısını ve döndürmede yeniden okumayı sınar.
- `perf.ts` çıktısında "25 ms+ kare" sayısı da var: efekt boyunca takılan kareleri gösterir (en uzun kare çoğunlukla
  bırakma anındadır ve bu değişiklikten etkilenmez).

### Aşama 9.3 — yazı kalınlığı 900 → 800 (CSS düzeltmesi)

- Oyunun yazı tipi **Baloo 2 Variable yalnızca 400–800** kalınlıklarını içerir. 5 kural (`.star-warn`, `.star-gain`,
  `.sp-timer`, `.fx-lucky > b`, `.cheer-blast`) 900 istiyordu; tarayıcı zaten 800 çiziyordu. Değerler 800 yapıldı.
  `tests/css.test.ts` CSS'te 400–800 dışında sayısal kalınlık kalmadığını denetler.
- Gerçek yazı tipiyle (canlı sitede, Claude tarayıcı panesinde) her beş öğe için 900 ve 800 metni tuvale çizildi:
  **0 farklı piksel**; kontrol olarak 700↔800 ise yüzlerce–binlerce piksel farklı. Öğe boyutları da birebir aynı.
- Bu bir performans optimizasyonu değildir. Gerçek yazı tipiyle ölçüm gürültülüdür ve kazanç birkaç ms'yi geçmez.

## Test ortamında eksik yazı tipi (önemli)

Bu oturumdaki konteynerde npm'e erişim olmadığı için Aşama 9 ölçümleri, projenin Vite derlemesi yerine eşdeğer bir
esbuild üretim derlemesiyle yapıldı ve bu derlemede **Baloo 2 yazı tipi yoktu** (`@fontsource` içe aktarması boş
bırakıldı). Tarayıcı sistemin yedek yazı tipine düştü. Sonuçları:

- Mutlak sayılar biraz abartılıdır: yedek yazı tipinde bir kalınlığın **ilk** kullanımı (yazı tipi eşleştirme)
  1×'te ≈8 ms, 4×'te ≈22 ms sürdü; ikinci kullanım ≈0,2–1 ms. Aşama 9'da şanslı ödülde görülen "≈46 ms yerleşim"in
  büyük kısmı buydu.
- Önce/sonra karşılaştırmaları aynı derleme yöntemiyle yapıldığı için geçerlidir.
- **Doğru yöntem:** `npm run build` ile üretilen `dist/` ölçülür (yazı tipi pakete dahildir). `scripts/perf/*` betikleri
  `DIR=dist` ile zaten bunu ölçer. Yazı tipiyle ilgili bir sonuç çıkarılacaksa, sayfada `document.fonts` içinde
  `Baloo 2 Variable 400 800` yüklü olduğu doğrulanmalıdır.

Henüz yapılmayanlar (ayrı onayla): React'te gereksiz yeniden çizimler (Aşama 9.4).

## iPhone'da gerçek ölçüm (isteğe bağlı, ücretsiz)

iPhone'u kabloyla Mac'e bağlayın; iPhone'da Ayarlar › Safari › Gelişmiş › Web Denetçisi açık olsun. Mac'te Safari ›
Geliştir menüsünden iPhone'daki POPGRID sekmesini seçin, **Zaman Çizelgeleri** sekmesinde kaydı başlatıp bir hat
temizleyin. "Stil", "Yerleşim" ve "JavaScript" süreleri burada da görülür. Ana ekrana eklenmiş (PWA) sürüm de aynı
WebKit motorunu kullanır.
