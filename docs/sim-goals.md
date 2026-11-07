# POPGRID — Görev ve başarım ekonomisi simülasyonu (Aşama 10.3)

Üretim kodu (defter, görevler, ödüller) 365 günlük oyuncu yılları üzerinde çalıştırıldı. Oyunlar gerçek motorla
botlar tarafından oynanıp kaydedildi (`scripts/simulate-goals.ts collect`), yıl simülasyonunda bu havuzdan tohumlu
rastgele seçildi. Her satır 20 oyuncu-yılının medyanıdır (ayrıca %10 / %90 dilimleri). Değerler DEĞİŞTİRİLMEDİ.

**Botlar gerçek oyuncu değildir.** Sonuçlar büyüklük sırasını ve kuralların birbirine etkisini gösterir.

## Oyun havuzu

| Beceri | Mod | Oyun | Ort. skor | Ort. hamle |
|---|---|---:|---:|---:|
| zayıf (rastgele bot) | klasik | 400 | 76 | 14 |
| zayıf (rastgele bot) | eglence0 | 400 | 242 | 30 |
| zayıf (rastgele bot) | eglence111 | 400 | 368 | 41 |
| orta (greedy bot) | klasik | 400 | 421 | 44 |
| orta (greedy bot) | eglence0 | 400 | 1.074 | 102 |
| orta (greedy bot) | eglence111 | 400 | 1.643 | 151 |
| güçlü (planlayıcı bot) | klasik | 150 | 1.288 | 124 |
| güçlü (planlayıcı bot) | eglence0 | 150 | 4.149 | 390 |
| güçlü (planlayıcı bot) | eglence111 | 150 | 6.054 | 563 |

Doğrulama — aynı oyuncu-yılı saf defterle ve gerçek depoyla (createEconomyStore, bellek localStorage): **birebir aynı**
(bakiye 131.172 / 131.172, ödül 17.925 / 17.925).

## Beceri: zayıf (rastgele bot)

### Harcayan oyuncu (her Eğlence oyununa 1/1/1 joker setiyle girer, parası yetiyorsa)

| | Az oynayan · görevli | Az oynayan · görevsiz | Düzenli oynayan · görevli | Düzenli oynayan · görevsiz | Yoğun oynayan · görevli | Yoğun oynayan · görevsiz |
|---|---:|---:|---:|---:|---:|---:|
| Oynanan gün | 104 | 103 | 309 | 311 | 358 | 357 |
| Oyun | 157 | 154 | 1.234 | 1.242 | 3.573 | 3.571 |
| Oyun yıldızı (hat + oyun sonu + şanslı) | 4.069 | 3.659 | 30.486 | 28.023 | 98.691 | 93.406 |
| Görev ödülü (elle "Al") | 840 | 0 | 6.730 | 0 | 14.750 | 0 |
| Görev ödülü (gün sonu otomatik) | 530 | 0 | 740 | 0 | 0 | 0 |
| Başarım ödülü | 325 | 0 | 850 | 0 | 875 | 0 |
| Ödül payı (toplam kazancın) | %28 | %0 | %22 | %0 | %14 | %0 |
| Açılan başarım (21) | 7 | 0 | 11 | 0 | 12 | 0 |
| Üç görevi tamamlanan gün | 1 | 0 | 23 | 0 | 92 | 0 |
| En uzun seri (gün) | 1 | 0 | 2 | 0 | 4 | 0 |
| Satın alınan joker | 189 | 121 | 1.306 | 945 | 3.853 | 3.158 |
| Harcanan yıldız | 5.620 | 3.560 | 38.690 | 27.975 | 113.845 | 93.345 |
| Kullanılan satın alınmış joker | 188 | 120 | 1.306 | 945 | 3.853 | 3.157 |
| Yıl sonu bakiye (medyan, %10–%90) | 286 (134–528) | 99 (56–135) | 136 (72–232) | 79 (58–103) | 123 (92–168) | 89 (52–122) |

### Biriktiren oyuncu (hiç joker almaz)

| | Az oynayan · görevli | Az oynayan · görevsiz | Düzenli oynayan · görevli | Düzenli oynayan · görevsiz | Yoğun oynayan · görevli | Yoğun oynayan · görevsiz |
|---|---:|---:|---:|---:|---:|---:|
| Oynanan gün | 104 | 103 | 309 | 311 | 358 | 357 |
| Oyun | 157 | 154 | 1.234 | 1.242 | 3.573 | 3.571 |
| Oyun yıldızı (hat + oyun sonu + şanslı) | 2.799 | 2.909 | 21.116 | 21.196 | 71.021 | 70.741 |
| Görev ödülü (elle "Al") | 670 | 0 | 5.500 | 0 | 12.850 | 0 |
| Görev ödülü (gün sonu otomatik) | 450 | 0 | 640 | 0 | 0 | 0 |
| Başarım ödülü | 100 | 0 | 825 | 0 | 850 | 0 |
| Ödül payı (toplam kazancın) | %29 | %0 | %25 | %0 | %16 | %0 |
| Açılan başarım (21) | 4 | 0 | 10 | 0 | 11 | 0 |
| Üç görevi tamamlanan gün | 0 | 0 | 11 | 0 | 67 | 0 |
| En uzun seri (gün) | 0 | 0 | 1 | 0 | 3 | 0 |
| Satın alınan joker | 0 | 0 | 0 | 0 | 0 | 0 |
| Harcanan yıldız | 0 | 0 | 0 | 0 | 0 | 0 |
| Kullanılan satın alınmış joker | 0 | 0 | 0 | 0 | 0 | 0 |
| Yıl sonu bakiye (medyan, %10–%90) | 4.029 (3.479–4.443) | 2.909 (2.415–3.142) | 28.041 (27.079–29.121) | 21.196 (20.504–22.029) | 84.696 (83.120–85.850) | 70.741 (68.582–72.066) |

### Günlük görev türlerinin tamamlanma oranı (oynanan günlerde)

| Görev | Az oynayan | Düzenli oynayan | Yoğun oynayan |
|---|---:|---:|---:|
| kolay · lines 10 | %45 | %90 | %100 |
| kolay · placed 25 | %69 | %100 | %100 |
| kolay · games 1 | %100 | %100 | %100 |
| orta · lines 25 | %8 | %53 | %99 |
| orta · score 1.000 | %0 | %0 | %1 |
| orta · combo 3 | %19 | %38 | %74 |
| orta · games 2 | %47 | %100 | %100 |
| zor · lines 50 | %0 | %7 | %83 |
| zor · score 2.500 | %0 | %0 | %0 |
| zor · multi 3 | %17 | %39 | %75 |
| zor · combo 5 | %0 | %0 | %0 |

### Hedef adaylarının tamamlanma oranı (bir günde, oynanan günlerde)

| Ölçü | Hedef | Az oynayan | Düzenli oynayan | Yoğun oynayan |
|---|---:|---:|---:|---:|
| tek oyunda puan | 500 | %9 | %24 | %49 |
| tek oyunda puan | 750 | %1 | %2 | %4 |
| tek oyunda puan | 800 | %0 | %1 | %1 |
| tek oyunda puan | 1.000 | %0 | %1 | %1 |
| tek oyunda puan | 1.500 | %0 | %0 | %0 |
| tek oyunda puan | 2.000 | %0 | %0 | %0 |
| tek oyunda puan | 2.500 | %0 | %0 | %0 |
| gün içinde toplam puan | 1.000 | %1 | %33 | %99 |
| gün içinde toplam puan | 2.000 | %0 | %1 | %64 |
| gün içinde toplam puan | 3.000 | %0 | %0 | %13 |
| gün içinde toplam puan | 5.000 | %0 | %0 | %0 |
| kombo | 2 | %59 | %91 | %100 |
| kombo | 3 | %15 | %39 | %75 |
| kombo | 4 | %2 | %4 | %14 |
| kombo | 5 | %0 | %0 | %0 |
| kombo | 6 | %0 | %0 | %0 |
| tek hamlede hat | 2 | %65 | %94 | %100 |
| tek hamlede hat | 3 | %16 | %40 | %73 |
| tek hamlede hat | 4 | %2 | %6 | %17 |
| günlük hat | 10 | %46 | %89 | %100 |
| günlük hat | 20 | %13 | %65 | %100 |
| günlük hat | 25 | %6 | %51 | %99 |
| günlük hat | 40 | %0 | %17 | %93 |
| günlük hat | 50 | %0 | %6 | %84 |

### Başarımın açıldığı gün (medyan; "—" = oyuncuların yarısından azı bir yılda açıyor)

| Başarım | Hedef | ★ | Az oynayan | Düzenli oynayan | Yoğun oynayan |
|---|---:|---:|---:|---:|---:|
| hat-1 | 100 | 25 | 43. gün | 6. gün | 2. gün |
| hat-2 | 1.000 | 75 | 331. gün | 46. gün | 14. gün |
| hat-3 | 5.000 | 200 | — (%0) | 226. gün | 71. gün |
| klasik-1 | 1.000 | 25 | — (%0) | — (%0) | — (%0) |
| klasik-2 | 3.000 | 75 | — (%0) | — (%0) | — (%0) |
| klasik-3 | 6.000 | 150 | — (%0) | — (%0) | — (%0) |
| eglence-1 | 1.000 | 25 | — (%15) | 241. gün | 86. gün |
| eglence-2 | 3.000 | 75 | — (%0) | — (%0) | — (%0) |
| eglence-3 | 6.000 | 150 | — (%0) | — (%0) | — (%0) |
| kombo-1 | 3 | 25 | 22. gün | 3. gün | 1. gün |
| kombo-2 | 5 | 50 | — (%0) | — (%0) | — (%0) |
| kombo-3 | 8 | 100 | — (%0) | — (%0) | — (%0) |
| bomba-1 | 10 | 25 | 43. gün | 5. gün | 2. gün |
| bomba-2 | 100 | 75 | 310. gün | 42. gün | 13. gün |
| bomba-3 | 500 | 150 | — (%0) | 207. gün | 63. gün |
| sans-1 | 10 | 25 | 66. gün | 8. gün | 3. gün |
| sans-2 | 50 | 75 | 263. gün | 36. gün | 10. gün |
| sans-3 | 200 | 150 | — (%0) | 135. gün | 39. gün |
| duzenli-1 | 3 | 25 | — (%0) | — (%15) | 27. gün |
| duzenli-2 | 7 | 75 | — (%0) | — (%0) | — (%0) |
| duzenli-3 | 30 | 200 | — (%0) | — (%0) | — (%0) |

## Beceri: orta (greedy bot)

### Harcayan oyuncu (her Eğlence oyununa 1/1/1 joker setiyle girer, parası yetiyorsa)

| | Az oynayan · görevli | Az oynayan · görevsiz | Düzenli oynayan · görevli | Düzenli oynayan · görevsiz | Yoğun oynayan · görevli | Yoğun oynayan · görevsiz |
|---|---:|---:|---:|---:|---:|---:|
| Oynanan gün | 104 | 103 | 309 | 311 | 358 | 357 |
| Oyun | 157 | 154 | 1.234 | 1.242 | 3.573 | 3.571 |
| Oyun yıldızı (hat + oyun sonu + şanslı) | 21.547 | 20.609 | 165.144 | 163.027 | 533.336 | 531.605 |
| Görev ödülü (elle "Al") | 2.220 | 0 | 15.050 | 0 | 25.250 | 0 |
| Görev ödülü (gün sonu otomatik) | 1.370 | 0 | 1.670 | 0 | 0 | 0 |
| Başarım ödülü | 850 | 0 | 1.025 | 0 | 1.100 | 0 |
| Ödül payı (toplam kazancın) | %17 | %0 | %10 | %0 | %5 | %0 |
| Açılan başarım (21) | 13 | 0 | 15 | 0 | 16 | 0 |
| Üç görevi tamamlanan gün | 21 | 0 | 154 | 0 | 289 | 0 |
| En uzun seri (gün) | 2 | 0 | 6 | 0 | 22 | 0 |
| Satın alınan joker | 204 | 198 | 1.653 | 1.623 | 5.724 | 5.701 |
| Harcanan yıldız | 5.970 | 5.870 | 48.525 | 47.540 | 168.320 | 167.455 |
| Kullanılan satın alınmış joker | 204 | 198 | 1.653 | 1.622 | 5.724 | 5.701 |
| Yıl sonu bakiye (medyan, %10–%90) | 20.047 (16.908–21.347) | 14.546 (13.099–16.872) | 133.865 (127.072–138.839) | 114.765 (111.456–117.598) | 390.096 (383.534–396.128) | 363.553 (353.908–370.367) |

### Biriktiren oyuncu (hiç joker almaz)

| | Az oynayan · görevli | Az oynayan · görevsiz | Düzenli oynayan · görevli | Düzenli oynayan · görevsiz | Yoğun oynayan · görevli | Yoğun oynayan · görevsiz |
|---|---:|---:|---:|---:|---:|---:|
| Oynanan gün | 104 | 103 | 309 | 311 | 358 | 357 |
| Oyun | 157 | 154 | 1.234 | 1.242 | 3.573 | 3.571 |
| Oyun yıldızı (hat + oyun sonu + şanslı) | 16.326 | 15.300 | 126.215 | 123.883 | 394.730 | 395.375 |
| Görev ödülü (elle "Al") | 1.830 | 0 | 13.100 | 0 | 21.770 | 0 |
| Görev ödülü (gün sonu otomatik) | 1.130 | 0 | 1.380 | 0 | 0 | 0 |
| Başarım ödülü | 650 | 0 | 1.025 | 0 | 1.100 | 0 |
| Ödül payı (toplam kazancın) | %18 | %0 | %11 | %0 | %5 | %0 |
| Açılan başarım (21) | 12 | 0 | 15 | 0 | 16 | 0 |
| Üç görevi tamamlanan gün | 13 | 0 | 112 | 0 | 220 | 0 |
| En uzun seri (gün) | 1 | 0 | 5 | 0 | 10 | 0 |
| Satın alınan joker | 0 | 0 | 0 | 0 | 0 | 0 |
| Harcanan yıldız | 0 | 0 | 0 | 0 | 0 | 0 |
| Kullanılan satın alınmış joker | 0 | 0 | 0 | 0 | 0 | 0 |
| Yıl sonu bakiye (medyan, %10–%90) | 20.086 (16.925–21.205) | 15.300 (13.488–17.773) | 142.195 (134.600–144.852) | 123.883 (119.957–126.577) | 417.724 (411.169–424.126) | 395.375 (383.074–400.015) |

### Günlük görev türlerinin tamamlanma oranı (oynanan günlerde)

| Görev | Az oynayan | Düzenli oynayan | Yoğun oynayan |
|---|---:|---:|---:|
| kolay · lines 10 | %94 | %100 | %100 |
| kolay · placed 25 | %95 | %100 | %100 |
| kolay · games 1 | %100 | %100 | %100 |
| orta · lines 25 | %74 | %100 | %100 |
| orta · score 1.000 | %52 | %87 | %100 |
| orta · combo 3 | %84 | %99 | %100 |
| orta · games 2 | %47 | %100 | %100 |
| zor · lines 50 | %47 | %97 | %100 |
| zor · score 2.500 | %10 | %25 | %61 |
| zor · multi 3 | %24 | %52 | %87 |
| zor · combo 5 | %16 | %36 | %74 |

### Hedef adaylarının tamamlanma oranı (bir günde, oynanan günlerde)

| Ölçü | Hedef | Az oynayan | Düzenli oynayan | Yoğun oynayan |
|---|---:|---:|---:|---:|
| tek oyunda puan | 500 | %75 | %98 | %100 |
| tek oyunda puan | 750 | %62 | %93 | %100 |
| tek oyunda puan | 800 | %61 | %92 | %100 |
| tek oyunda puan | 1.000 | %51 | %87 | %100 |
| tek oyunda puan | 1.500 | %33 | %69 | %97 |
| tek oyunda puan | 2.000 | %20 | %44 | %83 |
| tek oyunda puan | 2.500 | %11 | %27 | %61 |
| gün içinde toplam puan | 1.000 | %59 | %98 | %100 |
| gün içinde toplam puan | 2.000 | %28 | %88 | %100 |
| gün içinde toplam puan | 3.000 | %11 | %69 | %100 |
| gün içinde toplam puan | 5.000 | %1 | %30 | %99 |
| kombo | 2 | %98 | %100 | %100 |
| kombo | 3 | %82 | %99 | %100 |
| kombo | 4 | %53 | %87 | %100 |
| kombo | 5 | %17 | %39 | %76 |
| kombo | 6 | %2 | %7 | %20 |
| tek hamlede hat | 2 | %89 | %100 | %100 |
| tek hamlede hat | 3 | %23 | %51 | %87 |
| tek hamlede hat | 4 | %0 | %2 | %6 |
| günlük hat | 10 | %92 | %100 | %100 |
| günlük hat | 20 | %80 | %100 | %100 |
| günlük hat | 25 | %73 | %100 | %100 |
| günlük hat | 40 | %58 | %98 | %100 |
| günlük hat | 50 | %48 | %96 | %100 |

### Başarımın açıldığı gün (medyan; "—" = oyuncuların yarısından azı bir yılda açıyor)

| Başarım | Hedef | ★ | Az oynayan | Düzenli oynayan | Yoğun oynayan |
|---|---:|---:|---:|---:|---:|
| hat-1 | 100 | 25 | 8. gün | 2. gün | 1. gün |
| hat-2 | 1.000 | 75 | 59. gün | 9. gün | 3. gün |
| hat-3 | 5.000 | 200 | 294. gün | 38. gün | 12. gün |
| klasik-1 | 1.000 | 25 | 41. gün | 14. gün | 5. gün |
| klasik-2 | 3.000 | 75 | — (%0) | — (%0) | — (%0) |
| klasik-3 | 6.000 | 150 | — (%0) | — (%0) | — (%0) |
| eglence-1 | 1.000 | 25 | 6. gün | 1. gün | 1. gün |
| eglence-2 | 3.000 | 75 | 93. gün | 8. gün | 2. gün |
| eglence-3 | 6.000 | 150 | — (%0) | — (%0) | — (%0) |
| kombo-1 | 3 | 25 | 4. gün | 1. gün | 1. gün |
| kombo-2 | 5 | 50 | 12. gün | 2. gün | 1. gün |
| kombo-3 | 8 | 100 | — (%0) | — (%0) | — (%0) |
| bomba-1 | 10 | 25 | 10. gün | 2. gün | 1. gün |
| bomba-2 | 100 | 75 | 82. gün | 12. gün | 3. gün |
| bomba-3 | 500 | 150 | — (%20) | 51. gün | 15. gün |
| sans-1 | 10 | 25 | 12. gün | 3. gün | 1. gün |
| sans-2 | 50 | 75 | 58. gün | 8. gün | 3. gün |
| sans-3 | 200 | 150 | 222. gün | 28. gün | 9. gün |
| duzenli-1 | 3 | 25 | — (%0) | 17. gün | 4. gün |
| duzenli-2 | 7 | 75 | — (%0) | — (%25) | 14. gün |
| duzenli-3 | 30 | 200 | — (%0) | — (%0) | — (%5) |

## Beceri: güçlü (planlayıcı bot)

### Harcayan oyuncu (her Eğlence oyununa 1/1/1 joker setiyle girer, parası yetiyorsa)

| | Az oynayan · görevli | Az oynayan · görevsiz | Düzenli oynayan · görevli | Düzenli oynayan · görevsiz | Yoğun oynayan · görevli | Yoğun oynayan · görevsiz |
|---|---:|---:|---:|---:|---:|---:|
| Oynanan gün | 104 | 103 | 309 | 311 | 358 | 357 |
| Oyun | 157 | 154 | 1.234 | 1.242 | 3.573 | 3.571 |
| Oyun yıldızı (hat + oyun sonu + şanslı) | 37.312 | 36.090 | 293.726 | 289.568 | 886.841 | 885.340 |
| Görev ödülü (elle "Al") | 3.230 | 0 | 19.650 | 0 | 28.280 | 0 |
| Görev ödülü (gün sonu otomatik) | 2.230 | 0 | 2.180 | 0 | 0 | 0 |
| Başarım ödülü | 1.250 | 0 | 1.325 | 0 | 1.525 | 0 |
| Ödül payı (toplam kazancın) | %15 | %0 | %7 | %0 | %3 | %0 |
| Açılan başarım (21) | 17 | 0 | 18 | 0 | 19 | 0 |
| Üç görevi tamamlanan gün | 52 | 0 | 249 | 0 | 350 | 0 |
| En uzun seri (gün) | 3 | 0 | 13 | 0 | 72 | 0 |
| Satın alınan joker | 180 | 181 | 1.434 | 1.431 | 5.015 | 4.972 |
| Harcanan yıldız | 5.505 | 5.510 | 43.985 | 43.675 | 153.100 | 152.075 |
| Kullanılan satın alınmış joker | 180 | 180 | 1.434 | 1.431 | 5.014 | 4.971 |
| Yıl sonu bakiye (medyan, %10–%90) | 38.870 (34.099–40.882) | 31.077 (28.158–35.784) | 271.525 (253.563–278.006) | 245.153 (241.992–253.813) | 764.061 (752.216–772.382) | 735.345 (722.479–741.440) |

### Biriktiren oyuncu (hiç joker almaz)

| | Az oynayan · görevli | Az oynayan · görevsiz | Düzenli oynayan · görevli | Düzenli oynayan · görevsiz | Yoğun oynayan · görevli | Yoğun oynayan · görevsiz |
|---|---:|---:|---:|---:|---:|---:|
| Oynanan gün | 104 | 103 | 309 | 311 | 358 | 357 |
| Oyun | 157 | 154 | 1.234 | 1.242 | 3.573 | 3.571 |
| Oyun yıldızı (hat + oyun sonu + şanslı) | 36.119 | 34.860 | 281.191 | 277.713 | 844.386 | 845.344 |
| Görev ödülü (elle "Al") | 3.060 | 0 | 18.740 | 0 | 27.780 | 0 |
| Görev ödülü (gün sonu otomatik) | 2.080 | 0 | 2.060 | 0 | 0 | 0 |
| Başarım ödülü | 1.250 | 0 | 1.325 | 0 | 1.525 | 0 |
| Ödül payı (toplam kazancın) | %15 | %0 | %7 | %0 | %3 | %0 |
| Açılan başarım (21) | 17 | 0 | 18 | 0 | 19 | 0 |
| Üç görevi tamamlanan gün | 47 | 0 | 226 | 0 | 341 | 0 |
| En uzun seri (gün) | 3 | 0 | 11 | 0 | 50 | 0 |
| Satın alınan joker | 0 | 0 | 0 | 0 | 0 | 0 |
| Harcanan yıldız | 0 | 0 | 0 | 0 | 0 | 0 |
| Kullanılan satın alınmış joker | 0 | 0 | 0 | 0 | 0 | 0 |
| Yıl sonu bakiye (medyan, %10–%90) | 42.744 (36.872–44.659) | 34.860 (31.149–39.949) | 303.136 (283.598–309.955) | 277.713 (270.739–286.492) | 873.191 (861.715–883.870) | 845.344 (829.001–853.873) |

### Günlük görev türlerinin tamamlanma oranı (oynanan günlerde)

| Görev | Az oynayan | Düzenli oynayan | Yoğun oynayan |
|---|---:|---:|---:|
| kolay · lines 10 | %99 | %100 | %100 |
| kolay · placed 25 | %99 | %100 | %100 |
| kolay · games 1 | %100 | %100 | %100 |
| orta · lines 25 | %94 | %100 | %100 |
| orta · score 1.000 | %82 | %99 | %100 |
| orta · combo 3 | %93 | %100 | %100 |
| orta · games 2 | %47 | %100 | %100 |
| zor · lines 50 | %83 | %100 | %100 |
| zor · score 2.500 | %66 | %94 | %100 |
| zor · multi 3 | %41 | %75 | %99 |
| zor · combo 5 | %30 | %59 | %92 |

### Hedef adaylarının tamamlanma oranı (bir günde, oynanan günlerde)

| Ölçü | Hedef | Az oynayan | Düzenli oynayan | Yoğun oynayan |
|---|---:|---:|---:|---:|
| tek oyunda puan | 500 | %92 | %100 | %100 |
| tek oyunda puan | 750 | %86 | %100 | %100 |
| tek oyunda puan | 800 | %86 | %100 | %100 |
| tek oyunda puan | 1.000 | %81 | %99 | %100 |
| tek oyunda puan | 1.500 | %74 | %98 | %100 |
| tek oyunda puan | 2.000 | %67 | %96 | %100 |
| tek oyunda puan | 2.500 | %61 | %94 | %100 |
| gün içinde toplam puan | 1.000 | %83 | %100 | %100 |
| gün içinde toplam puan | 2.000 | %71 | %100 | %100 |
| gün içinde toplam puan | 3.000 | %60 | %98 | %100 |
| gün içinde toplam puan | 5.000 | %44 | %94 | %100 |
| kombo | 2 | %100 | %100 | %100 |
| kombo | 3 | %92 | %100 | %100 |
| kombo | 4 | %69 | %96 | %100 |
| kombo | 5 | %29 | %60 | %92 |
| kombo | 6 | %2 | %5 | %13 |
| tek hamlede hat | 2 | %93 | %100 | %100 |
| tek hamlede hat | 3 | %39 | %75 | %98 |
| tek hamlede hat | 4 | %3 | %7 | %16 |
| günlük hat | 10 | %98 | %100 | %100 |
| günlük hat | 20 | %94 | %100 | %100 |
| günlük hat | 25 | %91 | %100 | %100 |
| günlük hat | 40 | %85 | %100 | %100 |
| günlük hat | 50 | %82 | %100 | %100 |

### Başarımın açıldığı gün (medyan; "—" = oyuncuların yarısından azı bir yılda açıyor)

| Başarım | Hedef | ★ | Az oynayan | Düzenli oynayan | Yoğun oynayan |
|---|---:|---:|---:|---:|---:|
| hat-1 | 100 | 25 | 3. gün | 1. gün | 1. gün |
| hat-2 | 1.000 | 75 | 17. gün | 3. gün | 1. gün |
| hat-3 | 5.000 | 200 | 75. gün | 10. gün | 3. gün |
| klasik-1 | 1.000 | 25 | 9. gün | 1. gün | 1. gün |
| klasik-2 | 3.000 | 75 | 40. gün | 7. gün | 4. gün |
| klasik-3 | 6.000 | 150 | — (%0) | — (%0) | — (%0) |
| eglence-1 | 1.000 | 25 | 5. gün | 1. gün | 1. gün |
| eglence-2 | 3.000 | 75 | 5. gün | 1. gün | 1. gün |
| eglence-3 | 6.000 | 150 | 10. gün | 3. gün | 1. gün |
| kombo-1 | 3 | 25 | 3. gün | 1. gün | 1. gün |
| kombo-2 | 5 | 50 | 10. gün | 2. gün | 1. gün |
| kombo-3 | 8 | 100 | — (%0) | — (%0) | — (%0) |
| bomba-1 | 10 | 25 | 5. gün | 1. gün | 1. gün |
| bomba-2 | 100 | 75 | 20. gün | 4. gün | 1. gün |
| bomba-3 | 500 | 150 | 110. gün | 15. gün | 4. gün |
| sans-1 | 10 | 25 | 5. gün | 1. gün | 1. gün |
| sans-2 | 50 | 75 | 14. gün | 3. gün | 1. gün |
| sans-3 | 200 | 150 | 56. gün | 8. gün | 2. gün |
| duzenli-1 | 3 | 25 | 297. gün | 4. gün | 3. gün |
| duzenli-2 | 7 | 75 | — (%0) | 37. gün | 7. gün |
| duzenli-3 | 30 | 200 | — (%0) | — (%0) | 67. gün |

## Özet (harcayan oyuncu, medyan)

| Beceri | Profil | Oyun ★ / oynanan gün | Ödül ★ / oynanan gün | Ödül payı | Toplam ★ / oynanan gün | Yıl sonu bakiye (görevli) | Yıl sonu bakiye (görevsiz) | Alınan joker (görevli / görevsiz) |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| zayıf (rastgele bot) | Az oynayan | 39 | 16 | %28 | 54 | 286 | 99 | 189 / 121 |
| zayıf (rastgele bot) | Düzenli oynayan | 100 | 27 | %22 | 126 | 136 | 79 | 1.306 / 945 |
| zayıf (rastgele bot) | Yoğun oynayan | 275 | 44 | %14 | 319 | 123 | 89 | 3.853 / 3.158 |
| orta (greedy bot) | Az oynayan | 198 | 41 | %17 | 238 | 20.047 | 14.546 | 204 / 198 |
| orta (greedy bot) | Düzenli oynayan | 532 | 58 | %10 | 589 | 133.865 | 114.765 | 1.653 / 1.623 |
| orta (greedy bot) | Yoğun oynayan | 1.493 | 74 | %5 | 1.566 | 390.096 | 363.553 | 5.724 / 5.701 |
| güçlü (planlayıcı bot) | Az oynayan | 341 | 64 | %15 | 403 | 38.870 | 31.077 | 180 / 181 |
| güçlü (planlayıcı bot) | Düzenli oynayan | 936 | 74 | %7 | 1.012 | 271.525 | 245.153 | 1.434 / 1.431 |
| güçlü (planlayıcı bot) | Yoğun oynayan | 2.481 | 83 | %3 | 2.564 | 764.061 | 735.345 | 5.015 / 4.972 |

Joker seti (1 Çekiç + 1 Yenile + 1 Döndür) = 85 ★.
