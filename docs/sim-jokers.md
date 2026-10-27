# POPGRID — Joker simülasyonu

Üretici sürümü 1 · varsayılan kurtarma ayarı · hamle sınırı 3000 · her ayar aynı tohumlarla (1…N).

- Botlar jokeri **yalnızca sıkışınca** kullanır: önce yalnız döndürme, sonra tek Çekiç, sonra Yenile, en son Döndür + Çekiç.
- Gerçek oyuncular jokeri daha erken (ör. kötü tepsi gelince Yenile) kullanabilir; bu tablo "son çare" kullanımını ölçer.
- **Uzama:** medyan hamle sayısının Klasik medyanına oranı.
- **Kurtarma / oyun:** oyun başına kaç kez sıkışmadan jokerle çıkıldı.
- **Hak kalmış bitiş:** oyun bittiğinde kullanılmamış hak vardı (o haklar o anda işe yaramıyordu).

## Planlayıcı bot — 3 oyun

| Ayar (Çekiç/Yenile/Döndür) | Medyan hamle | Uzama | P10–P90 hamle | Medyan skor | Ort. skor | Kurtarma / oyun | Kullanılan Ç / Y / D (ort.) | Hak kalmış bitiş | Sınıra ulaşan |
|---|---|---|---|---|---|---|---|---|---|
| Klasik | 65 | ×1,00 | 44–65 | 587 | 906 | 0,00 | 0,00 / 0,00 / 0,00 | %0,0 | %0,0 |
| Eğlence 0/0/0 (kontrol) | 65 | ×1,00 | 44–65 | 587 | 906 | 0,00 | 0,00 / 0,00 / 0,00 | %0,0 | %0,0 |
| Yalnız Çekiç 2 | 65 | ×1,00 | 50–65 | 587 | 1.567 | 1,00 | 1,33 / 0,00 / 0,00 | %33,3 | %0,0 |
| Yalnız Yenile 2 | 248 | ×3,82 | 125–248 | 2.689 | 2.492 | 2,00 | 0,00 / 2,00 / 0,00 | %0,0 | %0,0 |
| Yalnız Döndür 3 | 65 | ×1,00 | 44–65 | 587 | 906 | 0,00 | 0,00 / 0,00 / 0,00 | %100,0 | %0,0 |
| 1/1/1 | 182 | ×2,80 | 104–182 | 1.975 | 3.728 | 2,67 | 1,00 / 1,00 / 0,67 | %33,3 | %0,0 |
| 1/1/2 | 182 | ×2,80 | 104–182 | 1.975 | 3.728 | 2,67 | 1,00 / 1,00 / 0,67 | %100,0 | %0,0 |
| 2/2/3 (onaylı başlangıç) | 518 | ×7,97 | 118–518 | 5.820 | 6.100 | 5,00 | 1,67 / 2,00 / 1,33 | %100,0 | %0,0 |
| 3/3/5 | 748 | ×11,51 | 281–748 | 8.270 | 8.790 | 6,33 | 2,67 / 3,00 / 0,67 | %100,0 | %0,0 |

## Greedy bot — 20 oyun

| Ayar (Çekiç/Yenile/Döndür) | Medyan hamle | Uzama | P10–P90 hamle | Medyan skor | Ort. skor | Kurtarma / oyun | Kullanılan Ç / Y / D (ort.) | Hak kalmış bitiş | Sınıra ulaşan |
|---|---|---|---|---|---|---|---|---|---|
| Klasik | 44 | ×1,00 | 23–98 | 431 | 551 | 0,00 | 0,00 / 0,00 / 0,00 | %0,0 | %0,0 |
| Eğlence 0/0/0 (kontrol) | 44 | ×1,00 | 23–98 | 431 | 551 | 0,00 | 0,00 / 0,00 / 0,00 | %0,0 | %0,0 |
| Yalnız Çekiç 2 | 65 | ×1,48 | 35–104 | 626 | 700 | 1,70 | 1,85 / 0,00 / 0,00 | %10,0 | %0,0 |
| Yalnız Yenile 2 | 74 | ×1,68 | 32–109 | 729 | 800 | 2,00 | 0,00 / 2,00 / 0,00 | %0,0 | %0,0 |
| Yalnız Döndür 3 | 53 | ×1,20 | 23–113 | 533 | 644 | 0,90 | 0,00 / 0,00 / 0,90 | %85,0 | %0,0 |
| 1/1/1 | 77 | ×1,75 | 43–135 | 838 | 885 | 2,90 | 1,00 / 1,00 / 0,90 | %10,0 | %0,0 |
| 1/1/2 | 83 | ×1,89 | 44–135 | 876 | 964 | 3,65 | 1,00 / 1,00 / 1,65 | %25,0 | %0,0 |
| 2/2/3 (onaylı başlangıç) | 130 | ×2,95 | 70–185 | 1.444 | 1.438 | 6,70 | 2,00 / 2,00 / 2,70 | %20,0 | %0,0 |
| 3/3/5 | 167 | ×3,80 | 104–234 | 2.037 | 1.951 | 10,35 | 3,00 / 3,00 / 4,35 | %45,0 | %0,0 |

## Rastgele bot — 30 oyun

| Ayar (Çekiç/Yenile/Döndür) | Medyan hamle | Uzama | P10–P90 hamle | Medyan skor | Ort. skor | Kurtarma / oyun | Kullanılan Ç / Y / D (ort.) | Hak kalmış bitiş | Sınıra ulaşan |
|---|---|---|---|---|---|---|---|---|---|
| Klasik | 13 | ×1,00 | 10–17 | 55 | 65 | 0,00 | 0,00 / 0,00 / 0,00 | %0,0 | %0,0 |
| Eğlence 0/0/0 (kontrol) | 13 | ×1,00 | 10–17 | 55 | 65 | 0,00 | 0,00 / 0,00 / 0,00 | %0,0 | %0,0 |
| Yalnız Çekiç 2 | 21 | ×1,62 | 13–29 | 142 | 156 | 1,67 | 1,73 / 0,00 / 0,00 | %20,0 | %0,0 |
| Yalnız Yenile 2 | 21 | ×1,62 | 16–31 | 141 | 156 | 2,00 | 0,00 / 2,00 / 0,00 | %0,0 | %0,0 |
| Yalnız Döndür 3 | 14 | ×1,08 | 11–23 | 71 | 97 | 0,90 | 0,00 / 0,00 / 0,90 | %90,0 | %0,0 |
| 1/1/1 | 26 | ×2,00 | 17–38 | 184 | 217 | 2,80 | 0,93 / 1,00 / 0,87 | %20,0 | %0,0 |
| 1/1/2 | 26 | ×2,00 | 22–37 | 219 | 225 | 3,40 | 0,97 / 1,00 / 1,47 | %43,3 | %0,0 |
| 2/2/3 (onaylı başlangıç) | 38 | ×2,92 | 28–50 | 308 | 357 | 6,17 | 1,93 / 2,00 / 2,30 | %43,3 | %0,0 |
| 3/3/5 | 50 | ×3,85 | 38–64 | 431 | 490 | 9,80 | 2,93 / 3,00 / 3,90 | %53,3 | %0,0 |

Süre: 86 sn.
