# POPGRID — Joker simülasyonu

Üretici sürümü 1 · varsayılan kurtarma ayarı · hamle sınırı 3000 · her ayar aynı tohumlarla (1…N).

- Botlar jokeri **yalnızca sıkışınca** kullanır: önce yalnız döndürme, sonra tek Çekiç, sonra Yenile, en son Döndür + Çekiç.
- Gerçek oyuncular jokeri daha erken (ör. kötü tepsi gelince Yenile) kullanabilir; bu tablo "son çare" kullanımını ölçer.
- **Uzama:** medyan hamle sayısının Klasik medyanına oranı.
- **Kurtarma / oyun:** oyun başına kaç kez sıkışmadan jokerle çıkıldı.
- **Hak kalmış bitiş:** oyun bittiğinde kullanılmamış hak vardı (o haklar o anda işe yaramıyordu).

## Planlayıcı bot — 30 oyun

| Ayar (Çekiç/Yenile/Döndür) | Medyan hamle | Uzama | P10–P90 hamle | Medyan skor | Ort. skor | Kurtarma / oyun | Kullanılan Ç / Y / D (ort.) | Hak kalmış bitiş | Sınıra ulaşan |
|---|---|---|---|---|---|---|---|---|---|
| Klasik | 113 | ×1,00 | 62–229 | 1.090 | 1.513 | 0,00 | 0,00 / 0,00 / 0,00 | %0,0 | %0,0 |
| Eğlence 0/0/0 (kontrol) | 113 | ×1,00 | 62–229 | 1.090 | 1.513 | 0,00 | 0,00 / 0,00 / 0,00 | %0,0 | %0,0 |
| Yalnız Çekiç 2 | 182 | ×1,61 | 65–347 | 1.917 | 2.338 | 1,40 | 1,67 / 0,00 / 0,00 | %26,7 | %0,0 |
| Yalnız Yenile 2 | 244 | ×2,16 | 101–668 | 2.651 | 3.438 | 2,00 | 0,00 / 2,00 / 0,00 | %0,0 | %0,0 |
| Yalnız Döndür 3 | 133 | ×1,18 | 62–344 | 1.430 | 1.774 | 0,43 | 0,00 / 0,00 / 0,43 | %96,7 | %0,0 |
| 1/1/1 | 305 | ×2,70 | 110–761 | 3.330 | 4.523 | 2,73 | 0,93 / 1,00 / 0,80 | %23,3 | %0,0 |
| 1/1/2 | 350 | ×3,10 | 110–761 | 3.726 | 4.710 | 3,13 | 0,90 / 1,00 / 1,23 | %60,0 | %0,0 |
| 2/2/3 (onaylı başlangıç) | 565 | ×5,00 | 214–1.127 | 6.159 | 6.986 | 5,87 | 1,87 / 2,00 / 2,03 | %60,0 | %0,0 |
| 3/3/5 | 757 | ×6,70 | 329–1.349 | 8.335 | 8.969 | 8,77 | 2,77 / 3,00 / 3,03 | %73,3 | %0,0 |

## Greedy bot — 300 oyun

| Ayar (Çekiç/Yenile/Döndür) | Medyan hamle | Uzama | P10–P90 hamle | Medyan skor | Ort. skor | Kurtarma / oyun | Kullanılan Ç / Y / D (ort.) | Hak kalmış bitiş | Sınıra ulaşan |
|---|---|---|---|---|---|---|---|---|---|
| Klasik | 38 | ×1,00 | 20–80 | 347 | 424 | 0,00 | 0,00 / 0,00 / 0,00 | %0,0 | %0,0 |
| Eğlence 0/0/0 (kontrol) | 38 | ×1,00 | 20–80 | 347 | 424 | 0,00 | 0,00 / 0,00 / 0,00 | %0,0 | %0,0 |
| Yalnız Çekiç 2 | 62 | ×1,63 | 29–104 | 617 | 674 | 1,66 | 1,81 / 0,00 / 0,00 | %16,0 | %0,0 |
| Yalnız Yenile 2 | 65 | ×1,71 | 35–116 | 654 | 741 | 2,00 | 0,00 / 2,00 / 0,00 | %0,0 | %0,0 |
| Yalnız Döndür 3 | 50 | ×1,32 | 23–98 | 486 | 570 | 1,06 | 0,00 / 0,00 / 1,06 | %84,3 | %0,0 |
| 1/1/1 | 77 | ×2,03 | 38–128 | 804 | 857 | 2,85 | 0,97 / 1,00 / 0,89 | %13,7 | %0,0 |
| 1/1/2 | 85 | ×2,24 | 44–146 | 920 | 983 | 3,50 | 0,95 / 1,00 / 1,56 | %35,0 | %0,0 |
| 2/2/3 (onaylı başlangıç) | 125 | ×3,29 | 74–195 | 1.394 | 1.444 | 6,54 | 1,94 / 2,00 / 2,61 | %26,3 | %0,0 |
| 3/3/5 | 173 | ×4,55 | 104–251 | 2.004 | 2.036 | 10,22 | 2,96 / 3,00 / 4,29 | %33,7 | %0,0 |

## Rastgele bot — 500 oyun

| Ayar (Çekiç/Yenile/Döndür) | Medyan hamle | Uzama | P10–P90 hamle | Medyan skor | Ort. skor | Kurtarma / oyun | Kullanılan Ç / Y / D (ort.) | Hak kalmış bitiş | Sınıra ulaşan |
|---|---|---|---|---|---|---|---|---|---|
| Klasik | 13 | ×1,00 | 8–19 | 57 | 69 | 0,00 | 0,00 / 0,00 / 0,00 | %0,0 | %0,0 |
| Eğlence 0/0/0 (kontrol) | 13 | ×1,00 | 8–19 | 57 | 69 | 0,00 | 0,00 / 0,00 / 0,00 | %0,0 | %0,0 |
| Yalnız Çekiç 2 | 20 | ×1,54 | 14–29 | 128 | 145 | 1,62 | 1,73 / 0,00 / 0,00 | %21,6 | %0,0 |
| Yalnız Yenile 2 | 20 | ×1,54 | 16–31 | 135 | 152 | 2,00 | 0,00 / 2,00 / 0,00 | %0,0 | %0,0 |
| Yalnız Döndür 3 | 16 | ×1,23 | 11–26 | 82 | 105 | 0,91 | 0,00 / 0,00 / 0,91 | %88,6 | %0,0 |
| 1/1/1 | 25 | ×1,92 | 17–35 | 179 | 194 | 2,81 | 0,96 / 1,00 / 0,85 | %16,6 | %0,0 |
| 1/1/2 | 26 | ×2,00 | 17–38 | 212 | 221 | 3,44 | 0,94 / 1,00 / 1,51 | %37,2 | %0,0 |
| 2/2/3 (onaylı başlangıç) | 38 | ×2,92 | 26–53 | 327 | 352 | 6,36 | 1,96 / 2,00 / 2,44 | %35,0 | %0,0 |
| 3/3/5 | 50 | ×3,85 | 37–67 | 477 | 496 | 9,89 | 2,96 / 3,00 / 3,96 | %49,2 | %0,0 |

## Yorum (Aşama 6.1)

- **Kontrol doğru:** jokersiz Eğlence (0/0/0) her botta Klasik ile birebir aynı sonucu verdi.
- **2/2/3 oyunu çok uzatıyor:** medyan oyun uzunluğu Klasik'in ×2,9 (rastgele), ×3,3 (greedy) ve ×5,0 (planlayıcı) katı.
  İyi oyuncu için oyun 5 kat uzuyor; oyun başına ortalama 6 sıkışmadan kurtuluyor.
- **Yenile hak başına en güçlü joker:** her kullanım bir sıkışmadan kesin çıkarır (boş hücre varsa en az bir parça sığar).
- **Döndür son çare olarak zayıf:** sıkışınca nadiren işe yarıyor; "Yalnız Döndür 3" oyunlarının %84–97'si hak kalmışken bitti.
  Asıl değeri sıkışmadan önce daha iyi yerleşim için kullanılmasında; bu tabloda ölçülmüyor (botlar yalnızca sıkışınca kullanıyor).
- **Hak kalmış bitiş** oranının yüksek olması kurtuluş analizinin çalıştığını gösterir: kalan haklar işe yaramıyorsa oyun bitiyor.
- **1/1/2** oyunu ×2,0–3,1 uzatıyor; 1/1/1 ×1,9–2,7.

Öneri: Eğlence Modu'nun başlangıç hakları **Çekiç 1, Yenile 1, Döndür 2**. Jokerler hissedilir ama rekor anlamını korur.
2/2/3 daha rahat bir mod istenirse uygundur. Karar kullanıcıda; kod şu an onaylanan 2/2/3 ile duruyor.

Süre: 1117 sn.
