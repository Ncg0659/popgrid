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
  - `rules.ts`: hat ödülü (1 → 2, 2 → 5, 3+ → 10 yıldız; aynı hamlede birikmez), oyun sonu `Math.floor(skor / 100) * 5`, fiyatlar (Çekiç 25, Yenile 40, Döndür 20). Değerler deneyseldir; onaysız değişmez.
  - `ledger.ts`: `EconomyState` (bakiye, satın alınmış envanter, etkin oyun defteri, son 20 oyun özeti, Eğlence'nin ayrımlı rekorları, toplamlar) ve değişmez işlemler `startGame`, `awardMove`, `syncUsage`, `finishGame`, `purchase`.
  - `schema.ts`: sürümlü kayıt (`schemaVersion: 1`), tam doğrulama, Aşama 6 envanterinden geçiş.
- Çift ödül koruması: hamle ödülü yalnızca etkin oyuna ve daha önce ödüllendirilmemiş `moveCount`'a; oyun sonu ödülü oyunu kapatır (ikinci çağrı reddedilir); satın alma istek kimliğiyle tekrarlanamaz.
- Joker kullanımı cüzdan farkından hesaplanır (idempotent): ücretsiz ve satın alınmış kullanım ayrı tutulur; satın alınmış kullanılan oyun `usedPurchased` ile işaretlenir ve ayrı rekora (`funBests.withPurchased`) yazılır. Mevcut Eğlence rekoru (`popgrid:v1:best:eglence`) ve Klasik rekoru değişmez.
- Kalıcı kayıt: `src/storage/economy.ts`, tek anahtar `popgrid:v1:economy`, işlem başına tek `setItem` (atomik). Her işlem kaydı yeniden okur. Bozuk kayıt `popgrid:v1:economy:corrupt`'a yedeklenir ve oyun varsayılanla sürer; daha yeni sürümün kaydı okunmaz ve üzerine yazılmaz; depolama yoksa oturumda bellekte devam edilir.
- **Güvenlik sınırı:** localStorage oyuncunun tarayıcısındadır ve elle değiştirilebilir. Bu kayıt hileye karşı koruma sağlamaz; yalnızca dürüst oyunda hata ve çift ödülü önler. Gerçek koruma sunucu gerektirir (0 TL kuralı nedeniyle yok).
- Oyun devam kaydı yoktur: sayfa kapanırsa o ana kadarki hat yıldızları kalır, oyun sonu ödülü verilmez; yeni oyun eskisini "bırakılmış" sayar.
- **Henüz arayüze bağlı değil** (Aşama 7.2): canlı oyun yıldız kazandırmaz, mağaza yok. `useGame` hâlâ `popgrid:v1:inventory`'yi kullanır; ekonomi kaydı yokken o anahtar yalnızca okunarak taşınır.
- Simülasyon: `npm run sim:economy` → `docs/sim-economy.md`, yorum `docs/asama-7.1-ekonomi.md`.
