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

## Puan
- Yerleştirme: parçadaki her blok için +1.
- Temizleme: `10 × n × n` (n = aynı hamlede temizlenen satır + sütun sayısı).
- Kombo: art arda temizleme yapan her hamle seriyi 1 artırır; temizleme puanı seri sayısıyla çarpılır. Temizlemeyen hamle seriyi sıfırlar.

## Rastgelelik ve belirlenim
- Her üçlü kendi tohumundan üretilir: `mixSeed(seed, üçlüNo)`. Önceki üçlülerde kaç rastgele sayı kullanıldığı sonrakileri etkilemez.
- Önce 3 "ham" parça çekilir, sonra kurtarma zarı **her zaman** atılır (sonuç kullanılmasa bile). Böylece ham parça sırası tahtadan bağımsızdır.
- Kurtarma yalnızca zar tutarsa VE hiçbir ham parça tahtaya sığmıyorsa devreye girer; bir parçayı normal ağırlıklı havuzdan sığan bir parçayla değiştirir.
- Sözleşme: **aynı seed + aynı hamleler = aynı oyun.** Altın test ve tekrar oynatma testi bunu doğrular.

## Gelecek: Günlük yarışma modu (not)
Günlük yarışmada bütün oyuncuların **aynı parça sırasını** görmesi gerekir. Bu yüzden:
- Bu modda kurtarma kapalı olmalıdır (`rescue.enabled = false`). Kurtarma tahtaya baktığı için farklı hamle yapan oyuncular farklı parçalar alırdı.
- Ham üçlüler zaten yalnızca `seed + üçlüNo`'ya bağlıdır; tahta durumundan bağımsızdır. Kurtarma kapalıyken parça sırası herkes için ortaktır (test: `generator.test.ts`).
- Günlük seed, tarih metninden türetilir (ör. `seedFromString("2026-10-24")`) ve oyun kaydında `GENERATOR_VERSION` ile birlikte saklanır.
- Adalet için zorluk eğrisi skora değil üçlü numarasına bağlanmalıdır; aksi hâlde iyi oynayan oyuncu farklı parçalar görür. (Şu an zorluk eğrisi yok; eklenirse bu kural uygulanacak.)

## Gelecek özellikler için bağlantı noktaları
- Jokerler / özel bloklar: `Piece` tipine `kind` alanı ve `play` içinde yeni hamle tipleri.
- Temalar: renkler motorda yalnızca 1–6 numaradır; görünüm tamamen CSS'tedir.
- Başarımlar ve görevler: `play`'in döndürdüğü olaylar dinlenerek, motora dokunmadan.
