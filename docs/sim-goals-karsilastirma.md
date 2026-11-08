# POPGRID — Görev hedefleri: sürüm 1 ve sürüm 2 karşılaştırması (Aşama 10.3)

Aynı oyun havuzu, aynı oyuncu tohumları, 20 oyuncu-yılı; tek fark günlük görev kataloğu. Başarım eşikleri iki koşuda da sürüm 2.
Oranlar: o görevin çıktığı oynanan günlerde tamamlanma yüzdesi.

## zayıf (rastgele bot)

| Görev (eski → yeni) | Az oynayan | Düzenli oynayan | Yoğun oynayan | Klasik · az | Klasik · düzenli |
|---|---:|---:|---:|---:|---:|
| orta · tek oyunda 1.000 puan → gün içinde toplam 1.500 | %0 → %0 | %0 → %6 | %1 → %90 | %0 → %0 | %0 → %0 |
| zor · tek oyunda 2.500 puan → gün içinde toplam 4.000 | %0 → %0 | %0 → %0 | %0 → %1 | %0 → %0 | %0 → %0 |
| zor · kombo 5 → kombo 4 | %0 → %3 | %0 → %4 | %0 → %15 | %0 → %0 | %0 → %1 |
| Günlük görev ★ / oynanan gün | 13 → 14 | 24 → 26 | 41 → 50 | 7 → 7 | 13 → 13 |
| Üç görevi tamamlanan gün | 1 → 1 | 23 → 27 | 92 → 155 | 0 → 0 | 1 → 1 |
| En uzun seri | 1 → 1 | 2 → 2 | 4 → 6 | 0 → 0 | 1 → 1 |
| Toplam ödül ★ (yıl) | 1.620 → 1.695 | 8.420 → 8.660 | 15.625 → 19.040 | 830 → 830 | 4.035 → 4.065 |
| Yıl sonu bakiye | 286 → 294 | 136 → 155 | 123 → 175 | 1.626 → 1.616 | 9.937 → 9.956 |

## orta (greedy bot)

| Görev (eski → yeni) | Az oynayan | Düzenli oynayan | Yoğun oynayan | Klasik · az | Klasik · düzenli |
|---|---:|---:|---:|---:|---:|
| orta · tek oyunda 1.000 puan → gün içinde toplam 1.500 | %52 → %43 | %87 → %95 | %100 → %100 | %5 → %3 | %14 → %57 |
| zor · tek oyunda 2.500 puan → gün içinde toplam 4.000 | %10 → %2 | %25 → %50 | %61 → %100 | %0 → %0 | %0 → %0 |
| zor · kombo 5 → kombo 4 | %16 → %57 | %36 → %87 | %74 → %100 | %6 → %25 | %15 → %58 |
| Günlük görev ★ / oynanan gün | 33 → 35 | 54 → 63 | 71 → 78 | 20 → 20 | 34 → 42 |
| Üç görevi tamamlanan gün | 21 → 26 | 154 → 206 | 289 → 341 | 3 → 4 | 49 → 87 |
| En uzun seri | 2 → 2 | 6 → 10 | 22 → 54 | 1 → 1 | 3 → 4 |
| Toplam ödül ★ (yıl) | 4.590 → 4.800 | 18.050 → 20.690 | 26.450 → 29.200 | 2.400 → 2.380 | 11.175 → 13.665 |
| Yıl sonu bakiye | 20.047 → 20.347 | 133.965 → 136.740 | 390.196 → 392.633 | 10.510 → 10.618 | 75.867 → 77.961 |

## güçlü (planlayıcı bot)

| Görev (eski → yeni) | Az oynayan | Düzenli oynayan | Yoğun oynayan | Klasik · az | Klasik · düzenli |
|---|---:|---:|---:|---:|---:|
| orta · tek oyunda 1.000 puan → gün içinde toplam 1.500 | %82 → %78 | %99 → %100 | %100 → %100 | %63 → %58 | %93 → %98 |
| zor · tek oyunda 2.500 puan → gün içinde toplam 4.000 | %66 → %55 | %94 → %96 | %100 → %100 | %18 → %11 | %42 → %68 |
| zor · kombo 5 → kombo 4 | %30 → %71 | %59 → %97 | %92 → %100 | %11 → %46 | %29 → %81 |
| Günlük görev ★ / oynanan gün | 51 → 54 | 70 → 74 | 79 → 80 | 35 → 37 | 52 → 61 |
| Üç görevi tamamlanan gün | 52 → 56 | 249 → 275 | 350 → 356 | 22 → 26 | 138 → 193 |
| En uzun seri | 3 → 3 | 13 → 17 | 72 → 97 | 2 → 2 | 5 → 8 |
| Toplam ödül ★ (yıl) | 6.815 → 7.005 | 23.045 → 24.325 | 29.805 → 30.065 | 4.295 → 4.445 | 16.730 → 19.515 |
| Yıl sonu bakiye | 38.870 → 38.807 | 271.525 → 273.165 | 764.061 → 764.561 | 32.706 → 32.686 | 234.204 → 236.539 |

