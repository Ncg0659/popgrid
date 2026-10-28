# POPGRID — Mimari Notları

## Katmanlar
- `src/engine/` — saf TypeScript oyun motoru. Tarayıcı ve React bilmez; Node'da da aynı sonucu verir.
- `src/ui/`, `src/input/`, `src/fx/`, `src/audio/`, `src/storage/` — Aşama 2 ve sonrasında eklenecek.

## Motor dosyaları
| Dosya | Görev |
|---|---|
| `types.ts` | Ortak tipler ve sabitler (8×8 tahta, 6 renk) |
| `rng.ts` | Tohumlu rastgele sayı üreteci (mulberry32) ve seed karıştırma |
| `shapes.ts` | Parça kataloğu (sabit sıralı dizi) |
| `board.ts` | Yerleştirme, satır/sütun bulma ve temizleme |
| `scoring.ts` | Puan kuralları |
| `generator.ts` | Üçlü parça üretimi ve kurtarma şansı |
| `game.ts` | `newGame` ve `play` — tek giriş noktası |
| `jokers.ts` | Eğlence Modu jokerleri: `applyJoker`, `giveUp`, kurtuluş analizi (`canRescue`), haklar |

## Puan
- Yerleştirme: parçadaki her blok için +1.
- Temizleme: `10 × n × n` (n = aynı hamlede temizlenen satır + sütun sayısı).
- Kombo: art arda temizleme yapan her hamle seriyi 1 artırır; temizleme puanı seri sayısıyla çarpılır. Temizlemeyen hamle seriyi sıfırlar.

## Rastgelelik ve belirlenim
- Her üçlü kendi tohumundan üretilir: `mixSeed(seed, üçlüNo)`. Önceki üçlülerde kaç rastgele sayı kullanıldığı sonrakileri etkilemez.
- Önce 3 "ham" parça çekilir, sonra kurtarma zarı **her zaman** atılır (sonuç kullanılmasa bile). Böylece ham parça sırası tahtadan bağımsızdır.
- Kurtarma yalnızca zar tutarsa VE hiçbir ham parça tahtaya sığmıyorsa devreye girer; bir parçayı normal ağırlıklı havuzdan sığan bir parçayla değiştirir.
- Sözleşme: **aynı seed + aynı hamleler = aynı oyun.** Altın test ve tekrar oynatma testi bunu doğrular.

## Modlar ve jokerler (Aşama 6.1)
- `newGame(seed, config, { mode })`: `'klasik'` (varsayılan, jokersiz) ya da `'eglence'`.
- **Klasik birebir aynı:** parça üretimi, puan, oyun sonu ve altın parmak izi değişmedi; `GENERATOR_VERSION` 1 kaldı.
  Jokersiz bir Eğlence oyunu da Klasik ile hamle hamle aynı sonucu verir (test).
- Joker hamleleri `applyJoker(durum, { type: 'cekic', cell } | { type: 'yenile' } | { type: 'dondur', slot })`.
  `play` gibi saf: yeni durum + olaylar (`jokerUsed`, `hammered`, `refreshed`, `rotated`, `stuck`, `gameOver`).
  Kaydedilen hamle + joker listesi tekrar oynatılınca aynı oyun çıkar.
- Jokerler puan vermez, komboya dokunmaz, üçlü numarasını ilerletmez.
- **Yenile** kendi tohum akışını kullanır: `mixSeed(mixSeed(seed ^ "JOKR", üçlüNo), yenilemeNo)`.
  Normal üçlü sırası kaymaz. Boş hücre varsa yeni parçalardan en az biri sığar.
- **Döndür** katalogdaki eşleşmeyi kullanır (37 şeklin hepsinin döndürülmüş hâli katalogda; 1×1, 2×2, 3×3 dönmez).
  İlk dönüş 1 hak; o parça yerleşene ya da Yenile ile değişene kadar sonraki dönüşler ücretsiz (`rotatePaid`).
- **Oyun sonu (Eğlence):** hiçbir parça sığmıyorsa `canRescue` eldeki jokerlerin *gerçek etkisine* bakar:
  Yenile'nin gerçek sonucu, her parça/yön için "sığması için kaç Çekiç gerekir". Kurtuluş varsa `stuck = true`
  (oyun sürer, arayüz "Bitir" sunar → `giveUp`), yoksa `gameOver = true`. Testte bağımsız kaba kuvvet aramasıyla doğrulanır.
- **Haklar iki kaynaktan:** `jokers.free` (oyun başına ücretsiz, `DEFAULT_FREE_JOKERS` = Çekiç 1 / Yenile 1 / Döndür 2, deneysel) ve
  `jokers.inventory` (kalıcı envanterden bu oyuna getirilen; ileride yıldızla alınacak, şimdilik 0).
  Önce ücretsiz harcanır; envanterden harcanınca `jokerUsed.source = 'inventory'` olayı gelir ve arayüz kalıcı envanteri düşer.
  `grantJokers` envantere ekleme için saf yardımcıdır. Mağaza/yıldız yok.
- **Rekor:** Klasik eski anahtarı (`popgrid:v1:best`) kullanır; Eğlence ayrı (`popgrid:v1:best:eglence`).
- Simülasyon: `npm run sim:jokers` → `docs/sim-jokers.md`.
- Aşama 6.2 (arayüz) test gereksinimleri ve durumu: `docs/asama-6.2-test-gereksinimleri.md`.

## Joker arayüzü (Aşama 6.2)
- `src/ui/jokerUi.ts` (saf): hangi joker düğmesi ne zaman açık; sıkışınca yalnızca kurtuluşa katkı verebilecekler (`usefulWhenStuck`).
- `src/ui/useGame.ts`: mod, iki rekor, `arm/disarm`, `refresh`, `hammerCell`, `rotateSlot`, `giveUp`. Joker eylemleri her zaman en son durumu okur (`gameRef`), Yenile'de 450 ms çift dokunma koruması vardır.
- `JokerBar` (tepsinin altında, Eğlence'de ipucu satırının yerinde), `ModeSheet` ("Yeni oyun" ve oyun sonundan), `StuckNotice` (üst bölümün üstünde; tahtayı, tepsiyi ve çubuğu kapatmaz).
- Depolama: `popgrid:v1:mode` (son mod), `popgrid:v1:inventory` (kalıcı envanter, şimdilik 0; yalnızca `jokerUsed.source === 'inventory'` olayıyla düşer).
- Klasik ekran değişmedi: Eğlence'ye özgü CSS `.game[data-mode='eglence']` altındadır.

## Gelecek: Günlük yarışma modu (not)
Günlük yarışmada bütün oyuncuların **aynı parça sırasını** görmesi gerekir. Bu yüzden:
- Bu modda kurtarma kapalı olmalıdır (`rescue.enabled = false`). Kurtarma tahtaya baktığı için farklı hamle yapan oyuncular farklı parçalar alırdı.
- Ham üçlüler zaten yalnızca `seed + üçlüNo`'ya bağlıdır; tahta durumundan bağımsızdır. Kurtarma kapalıyken parça sırası herkes için ortaktır (test: `generator.test.ts`).
- Günlük seed, tarih metninden türetilir (ör. `seedFromString("2026-10-24")`) ve oyun kaydında `GENERATOR_VERSION` ile birlikte saklanır.
- Adalet için zorluk eğrisi skora değil üçlü numarasına bağlanmalıdır; aksi hâlde iyi oynayan oyuncu farklı parçalar görür. (Şu an zorluk eğrisi yok; eklenirse bu kural uygulanacak.)

## Gelecek özellikler için bağlantı noktaları
- Özel bloklar: `Piece` tipine `kind` alanı ve `play` içinde yeni hamle tipleri.
- Temalar: renkler motorda yalnızca 1–6 numaradır; görünüm tamamen CSS'tedir.
- Başarımlar ve görevler: `play`'in döndürdüğü olaylar dinlenerek, motora dokunmadan.

## Joker efektleri ve sesleri (Aşama 6.3)
- `src/fx/jokerEffects.ts` (saf): `describeJokerFx` motorun `hammered` / `refreshed` / `rotated` olaylarından efekt tanımı üretir. Yalnızca başarılı `applyJoker` sonucundan çağrılır; geçersiz kullanım, iptal ve hedef seçimi efekt üretmez.
- `useGame.jokerFx`: son başarılı jokerin efekti; yerleştirmede ve yeni oyunda temizlenir (boşalan yuvada tekrar oynamasın).
- Çekiç: `JokerBoardFx` (ezilip dağılan kopya + darbe halkası) ve `FxCanvas` (12 küçük parçacık). Yenile: `Tray` içinde `.jk-out` (eski parça küçülür) + `.jk-in` (yenisi belirir). Döndür: `.jk-rot` (yeni şekil -90°'den yerine döner; ücretsiz dönüşte de).
- Yalnızca `transform` / `opacity` canlanır; efekt öğeleri dokunmayı engellemez; Klasik Mod'da hiçbiri çizilmez.
- Hareketi azalt: kaybolan kopyalar ve Çekiç kopyası çizilmez, parçacık yok, geçişler anlık; sesler çalar.
- Sesler: `sound.ts` → `playJoker(kind)`, yalnızca osilatör (dosya yok). Aynı motor ve aynı `ready()` denetimi kullanılır: arka plan/ön plan, sessiz mod ve "ambient" ses oturumu davranışı değişmez.

## Joker rehberi ve ilk kullanım tanıtımı (Aşama 6.4)
- `src/help/JokerIntro.tsx`: tek kartlık "Jokerlerle tanış!" (oyundaki renkli joker rozetleri, hak sayıları, "Hadi oyna!"). Animasyon yok.
- İçerik `src/help/content.ts` → `JOKER_INTRO` ve yardımdaki `jokerler` bölümü; hak sayıları `DEFAULT_FREE_JOKERS`'tan üretilir (metin oyunla çelişmez).
- Kayıt `popgrid:v1:joker-intro` (`src/storage/jokerIntro.ts`): yalnızca Eğlence Modu'na ilk girişte kendiliğinden açılır (mod seçimi ya da Eğlence ile açılış). Klasik oyuncular hiç görmez. Depolama kapalıysa aynı oturumda tekrar açılmaz.
- Açılış sırası: yeni oyuncuda önce 4 kartlık temel eğitim, Eğlence ile açılmışsa ardından joker tanıtımı.
- Yardımda "Joker tanıtımını aç" düğmesi kartı tekrar açar. Kart oyunun üstünde açılır; oyun durumu değişmez, kapanınca odak "?" düğmesine döner.

## Yıldız ekonomisi motoru (Aşama 7.1)
- **Oyun motoru değişmedi.** Ekonomi motorun olaylarını (`cleared`) ve son skoru okur; `src/engine/` dosyalarına, üreticiye ve golden parmak izine dokunulmadı.
- `src/economy/` saf TypeScript'tir (ESLint ve `purity.test.ts` motorla aynı yasakları uygular):
  - `rules.ts`: hat ödülü (1 → 2, 2 → 5, 3+ → 10 yıldız; aynı hamlede birikmez), oyun sonu `Math.floor(skor / 100) * 5`, fiyatlar (Çekiç 25, Yenile 40, Döndür 20), **Eğlence'de oyun başı tavan 300** (`FUN_STAR_CAP`, Klasik'te yok). Onaylı değerler.
  - `ledger.ts`: `EconomyState` (bakiye, satın alınmış envanter, etkin oyun defteri, son 20 oyun özeti, Eğlence'nin ayrımlı rekorları, toplamlar, sahiplik) ve değişmez işlemler `startGame`, `awardMove`, `syncUsage`, `finishGame`, `purchase`. Tavan hamle ve oyun sonu ödülüne kalan pay kadar uygulanır; kazanılan geri alınmaz.
  - `ownership.ts`: tek yazıcı kuralı (kira 15 sn; sahip her işlemde ve düzenli aralıkla yeniler; bırakma ve zorla alma).
  - `schema.ts`: sürümlü kayıt (şema 2), tam doğrulama, şema 1 → 2 geçişi, Aşama 6 envanterinden geçiş.
- Kalıcı kayıt: `src/storage/economy.ts`, tek anahtar `popgrid:v1:economy`, işlem başına tek `setItem` (atomik). Her işlem kaydı yeniden okur ve sahipliği denetler.
  - **Yalnızca sahip sekme yazar** (K1, K2): öbür sekme okur, işlemleri `otherTab` ile reddedilir; arayüz açıklama gösterir (7.2).
  - `useJoker`: jokeri uygular ve satın alınmış hakkın düşülmesini aynı senkron çağrıda yazar; yazılamıyorsa joker uygulanmaz (K5).
  - `recordMove`: hamle numarasını motorun durumundan alır (K3). `newGameId`: rastgele oyun kimliği, tohumdan türetilmez (K4).
  - Bozuk kayıt `popgrid:v1:economy:corrupt`'a yedeklenir; daha yeni sürümün kaydı okunmaz ve üzerine yazılmaz; depolama yoksa oturumda bellekte devam edilir.
- `src/storage/economyLock.ts`: sahiplik alma Web Locks varsa kilit içinde yapılır (K7); yoksa kilitsiz (yarış penceresi yalnızca sahiplik almada).
- **Güvenlik sınırı:** localStorage oyuncunun tarayıcısındadır ve elle değiştirilebilir. Bu kayıt hileye karşı koruma sağlamaz; yalnızca dürüst oyunda hata ve çift ödülü önler. Gerçek koruma sunucu gerektirir (0 TL kuralı nedeniyle yok).
- Oyun devam kaydı yoktur: sayfa kapanırsa o ana kadarki hat yıldızları kalır, oyun sonu ödülü verilmez; yeni oyun eskisini "bırakılmış" sayar.
- Simülasyon: `npm run sim:economy` → `docs/sim-economy.md`; dengeleme: `npm run sim:balance` → `docs/sim-economy-balance.md`; yorum ve kararlar: `docs/asama-7.1-ekonomi.md`, `docs/asama-7.1-dengeleme.md`.

## Yıldız mağazası ve oyun entegrasyonu (Aşama 7.2)
- **Tek kaynak:** satın alınmış jokerler yalnızca ekonomi kaydında (`popgrid:v1:economy`). `useGame` artık eski `popgrid:v1:inventory` anahtarını kullanmaz; o anahtar yalnızca ekonomi kaydı hiç yokken bir kez okunup taşınır (`src/storage/inventory.ts` eski testler için duruyor).
- `src/ui/useEconomy.ts`: sekme yaşam döngüsü. Açılışta sahiplik; 5 sn'de bir kira yenileme; sekme öne gelince (`visibilitychange`, `pageshow`) yeniden doğrulama ve boşsa alma; `pagehide`'da bırakma; başka sekmenin yazdığı değişiklik (`storage` olayı) bakiyeye yansır. Sahiplik alma Web Locks varsa kilit içinde (`claimWithLock`).
- `src/ui/useGame.ts`: her oyun rastgele kimlikle (`newGameId`) deftere kaydedilir; kayıt olmazsa (başka sekme, yeni sürüm kaydı) oyuna satın alınmış joker getirilmez. Hamle ödülü `recordMove` (numara motordan), oyun sonu `finishGame` (bir kez), joker `useJoker` (uygulama + envanter düşümü aynı çağrıda). Kayıtsız oyunda satın alınmış joker kullanılamaz.
- Sahiplik kaybedilirse oyun aynen sürer; o sekmede yıldız kazanılmaz ve satın alınmış joker kullanılamaz. Uyarı: kısa bilgi + yıldız düğmesinde "!" + mağazada açıklama ve "Bu sekmede devam et". Kayıt yazılamıyorsa aynı uyarı düzeni; satın alma kapalı (`purchase` yalnızca kalıcı yazmada başarılı).
- Arayüz: `StarButton` (Klasik'te ipucu satırının sağında, Eğlence'de joker çubuğunun son hücresinde; yeni satır açmaz), `StarToast` (300 sınırı ve uyarılar), `ShopSheet` (alttan açılan panel), oyun sonu kartında kazanılan yıldız, mod seçiminde bakiye. Saf mantık `src/ui/economyUi.ts`.
- Yerleşim: Eğlence'de tahta boyutu değişmedi (joker düğmeleri simge + hak rozeti). Klasik'te ipucu satırı 21px → 44px: tahta yalnızca yüksekliğin yetmediği ekranlarda en çok 23px küçülür (268px → 291px ayrılır).
- Mağazada alınan joker, bu sekmenin takip ettiği bir Eğlence oyunu sürüyorsa o oyuna hemen eklenir: satın alma ve `active.inventoryAtStart` artışı aynı kayıtta yazılır (`bringPurchasedIntoGame`), arayüz oyunun cüzdanına aynı jokeri ekler. Kullanım hâlâ oyun başındaki envanter ile cüzdan farkından hesaplanır; yıldız yalnızca alımda düşer, kullanımda envanter bir azalır. Ücretsiz haklar önce harcanır (motor kuralı). Klasik'te, oyun yokken ya da sahip olunmadan başlamış bir oyunda alınan joker sonraki Eğlence oyununa kalır. Biten (kurtarılamayan) oyun alımla geri açılmaz.
- **Rekor kategorileri (R1):** Klasik rekor; normal Eğlence rekoru (`popgrid:v1:best:eglence`, satın alınmış joker kullanılmayan oyunlar; eski rekorlar aynen); satın alınmış jokerli Eğlence rekoru (ekonomi defteri `funBests.withPurchased`, oyun bitince yazılır). Oyunda satın alınmış joker kullanıldığı anlaşılınca (oyunun cüzdanı < oyun başındaki envanter) o oyun ayrı kategoriye geçer; bu oyun sırasında normal rekora yazılmış değer oyunun başındaki değerine geri alınır (`restoreBest`). "Yeni rekor" yalnızca oyunun kendi kategorisine göre; oyun sonu kartı ve üst bölüm kategoriyi gösterir. Mantık `src/ui/economyUi.ts` (`purchasedUsedInGame`, `recordCategory`, `recordView`).
- **Kısa ekranlar (R2):** yüksekliği 640px ve altı ekranlarda Klasik'te satır 36px yer kaplar (yıldız düğmesi yine 44px, boşluğa taşar), bölüm boşluğu 10 → 7px, alt kenar 12 → 8px; tahta main ile aynı (320×568) ya da 2px içinde (375×553). Eğlence ve uzun ekranlar değişmez.
- **Satın alma bildirimi (R3):** "Çekiç alındı! Bir sonraki Eğlence oyununda kullanabilirsin." yalnızca kalıcı kayıt başarılıysa.
- Oyun sonu dokunma koruması (450 ms) artık pencere ekrana yerleştiği anda başlar (yoğun anlarda kısalmasın).
