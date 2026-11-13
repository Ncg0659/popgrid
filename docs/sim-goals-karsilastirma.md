# POPGRID — Görev hedefleri karşılaştırması (Aşama 10.3)

Aynı oyun havuzu ve aynı oyuncu tohumları, 20 oyuncu-yılı; yalnızca günlük görev hedefleri farklı. Başarım eşikleri hepsinde güncel.
Her hücre: **eski (10.2) → karışık toplam (10.3 ilk) → oranlı (güncel)**. Oranlar: görevin çıktığı oynanan günlerde tamamlanma.

- eski: orta "tek oyunda 1.000", zor "tek oyunda 2.500", zor kombo 5
- karışık toplam: orta "gün içinde 1.500", zor "gün içinde 4.000" (modlar eşit sayılır), zor kombo 4
- oranlı: orta "Klasik 750 ya da Eğlence 2.000", zor "Klasik 1.500 ya da Eğlence 4.000" (birlikte oranlı), zor kombo 4

## zayıf (rastgele bot)

| | Az oynayan | Düzenli oynayan | Yoğun oynayan | Klasik · az | Klasik · düzenli |
|---|---:|---:|---:|---:|---:|
| Orta puan görevi | %0 → %0 → %0 | %0 → %6 → %2 | %1 → %90 → %89 | %0 → %0 → %0 | %0 → %0 → %0 |
| Zor puan görevi | %0 → %0 → %0 | %0 → %0 → %0 | %0 → %1 → %4 | %0 → %0 → %0 | %0 → %0 → %0 |
| Zor kombo görevi | %0 → %3 → %3 | %0 → %4 → %5 | %0 → %15 → %15 | %0 → %0 → %0 | %0 → %1 → %1 |
| Günlük görev ★ / oynanan gün | 13 → 14 → 14 | 24 → 26 → 25 | 41 → 50 → 51 | 7 → 7 → 7 | 13 → 13 → 13 |
| Üç görevi tamamlanan gün | 1 → 1 → 1 | 23 → 27 → 26 | 92 → 155 → 156 | 0 → 0 → 0 | 1 → 1 → 1 |
| En uzun seri | 1 → 1 → 1 | 2 → 2 → 2 | 4 → 6 → 6 | 0 → 0 → 0 | 1 → 1 → 1 |
| Toplam ödül ★ (yıl) | 1.620 → 1.695 → 1.695 | 8.420 → 8.660 → 8.585 | 15.625 → 19.040 → 19.125 | 830 → 830 → 830 | 4.035 → 4.065 → 4.085 |
| Yıl sonu bakiye | 286 → 294 → 294 | 136 → 155 → 158 | 123 → 175 → 163 | 1.626 → 1.616 → 1.616 | 9.937 → 9.956 → 9.956 |

## orta (greedy bot)

| | Az oynayan | Düzenli oynayan | Yoğun oynayan | Klasik · az | Klasik · düzenli |
|---|---:|---:|---:|---:|---:|
| Orta puan görevi | %52 → %43 → %46 | %87 → %95 → %99 | %100 → %100 → %100 | %5 → %3 → %31 | %14 → %57 → %97 |
| Zor puan görevi | %10 → %2 → %5 | %25 → %50 → %78 | %61 → %100 → %100 | %0 → %0 → %4 | %0 → %0 → %57 |
| Zor kombo görevi | %16 → %57 → %57 | %36 → %87 → %87 | %74 → %100 → %100 | %6 → %25 → %25 | %15 → %58 → %58 |
| Günlük görev ★ / oynanan gün | 33 → 35 → 36 | 54 → 63 → 67 | 71 → 78 → 78 | 20 → 20 → 23 | 34 → 42 → 52 |
| Üç görevi tamamlanan gün | 21 → 26 → 26 | 154 → 206 → 224 | 289 → 341 → 341 | 3 → 4 → 8 | 49 → 87 → 139 |
| En uzun seri | 2 → 2 → 2 | 6 → 10 → 12 | 22 → 54 → 54 | 1 → 1 → 1 | 3 → 4 → 6 |
| Toplam ödül ★ (yıl) | 4.590 → 4.800 → 4.810 | 18.050 → 20.690 → 21.720 | 26.450 → 29.200 → 29.200 | 2.400 → 2.380 → 2.700 | 11.175 → 13.665 → 16.625 |
| Yıl sonu bakiye | 20.047 → 20.347 → 20.287 | 133.965 → 136.740 → 137.660 | 390.196 → 392.633 → 392.633 | 10.510 → 10.618 → 11.008 | 75.867 → 77.961 → 81.178 |

## güçlü (planlayıcı bot)

| | Az oynayan | Düzenli oynayan | Yoğun oynayan | Klasik · az | Klasik · düzenli |
|---|---:|---:|---:|---:|---:|
| Orta puan görevi | %82 → %78 → %86 | %99 → %100 → %100 | %100 → %100 → %100 | %63 → %58 → %80 | %93 → %98 → %100 |
| Zor puan görevi | %66 → %55 → %71 | %94 → %96 → %100 | %100 → %100 → %100 | %18 → %11 → %57 | %42 → %68 → %98 |
| Zor kombo görevi | %30 → %71 → %71 | %59 → %97 → %97 | %92 → %100 → %100 | %11 → %46 → %46 | %29 → %81 → %81 |
| Günlük görev ★ / oynanan gün | 51 → 54 → 57 | 70 → 74 → 75 | 79 → 80 → 80 | 35 → 37 → 44 | 52 → 61 → 65 |
| Üç görevi tamamlanan gün | 52 → 56 → 58 | 249 → 275 → 277 | 350 → 356 → 356 | 22 → 26 → 37 | 138 → 193 → 214 |
| En uzun seri | 3 → 3 → 3 | 13 → 17 → 17 | 72 → 97 → 97 | 2 → 2 → 3 | 5 → 8 → 10 |
| Toplam ödül ★ (yıl) | 6.815 → 7.005 → 7.180 | 23.045 → 24.325 → 24.475 | 29.805 → 30.065 → 30.065 | 4.295 → 4.445 → 5.200 | 16.730 → 19.515 → 20.605 |
| Yıl sonu bakiye | 38.870 → 38.807 → 39.017 | 271.525 → 273.165 → 273.315 | 764.061 → 764.561 → 764.561 | 32.706 → 32.686 → 33.511 | 234.204 → 236.539 → 237.709 |

