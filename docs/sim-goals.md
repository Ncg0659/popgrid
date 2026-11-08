# POPGRID — Görev ve başarım ekonomisi simülasyonu (Aşama 10.3) — görev kataloğu sürüm 2

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
(bakiye 135.577 / 135.577, ödül 22.330 / 22.330).

## Beceri: zayıf (rastgele bot)

### Harcayan oyuncu (her Eğlence oyununa 1/1/1 joker setiyle girer, parası yetiyorsa)

| | Az oynayan · görevli | Az oynayan · görevsiz | Düzenli oynayan · görevli | Düzenli oynayan · görevsiz | Yoğun oynayan · görevli | Yoğun oynayan · görevsiz | Klasik · az · görevli | Klasik · az · görevsiz | Klasik · düzenli · görevli | Klasik · düzenli · görevsiz |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Oynanan gün | 104 | 103 | 309 | 311 | 358 | 357 | 107 | 110 | 310 | 312 |
| Oyun | 157 | 154 | 1.234 | 1.242 | 3.573 | 3.571 | 165 | 166 | 1.236 | 1.253 |
| Oyun yıldızı (hat + oyun sonu + şanslı) | 4.023 | 3.659 | 30.508 | 28.023 | 99.441 | 93.406 | 777 | 781 | 5.862 | 6.004 |
| Görev ödülü (elle "Al") | 820 | 0 | 6.920 | 0 | 18.200 | 0 | 450 | 0 | 3.620 | 0 |
| Görev ödülü (gün sonu otomatik) | 520 | 0 | 790 | 0 | 0 | 0 | 300 | 0 | 410 | 0 |
| Başarım ödülü | 325 | 0 | 850 | 0 | 875 | 0 | 50 | 0 | 125 | 0 |
| Ödül payı (toplam kazancın) | %29 | %0 | %22 | %0 | %16 | %0 | %51 | %0 | %41 | %0 |
| Açılan başarım (21) | 7 | 0 | 11 | 0 | 12 | 0 | 2 | 0 | 3 | 0 |
| Üç görevi tamamlanan gün | 1 | 0 | 26 | 0 | 156 | 0 | 0 | 0 | 1 | 0 |
| En uzun seri (gün) | 1 | 0 | 2 | 0 | 6 | 0 | 0 | 0 | 1 | 0 |
| Satın alınan joker | 184 | 121 | 1.313 | 945 | 4.001 | 3.158 | 0 | 0 | 0 | 0 |
| Harcanan yıldız | 5.460 | 3.560 | 38.875 | 27.975 | 118.215 | 93.345 | 0 | 0 | 0 | 0 |
| Kullanılan satın alınmış joker | 184 | 120 | 1.313 | 945 | 4.001 | 3.157 | 0 | 0 | 0 | 0 |
| Yıl sonu bakiye (medyan, %10–%90) | 294 (114–484) | 99 (56–135) | 158 (88–235) | 79 (58–103) | 163 (111–211) | 89 (52–122) | 1.616 (1.421–1.759) | 781 (662–897) | 9.956 (9.683–10.796) | 6.004 (5.809–6.387) |

### Biriktiren oyuncu (hiç joker almaz)

| | Az oynayan · görevli | Az oynayan · görevsiz | Düzenli oynayan · görevli | Düzenli oynayan · görevsiz | Yoğun oynayan · görevli | Yoğun oynayan · görevsiz | Klasik · az · görevli | Klasik · az · görevsiz | Klasik · düzenli · görevli | Klasik · düzenli · görevsiz |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Oynanan gün | 104 | 103 | 309 | 311 | 358 | 357 | 107 | 110 | 310 | 312 |
| Oyun | 157 | 154 | 1.234 | 1.242 | 3.573 | 3.571 | 165 | 166 | 1.236 | 1.253 |
| Oyun yıldızı (hat + oyun sonu + şanslı) | 2.799 | 2.909 | 21.116 | 21.196 | 71.021 | 70.741 | 777 | 781 | 5.862 | 6.004 |
| Görev ödülü (elle "Al") | 690 | 0 | 5.750 | 0 | 14.940 | 0 | 450 | 0 | 3.620 | 0 |
| Görev ödülü (gün sonu otomatik) | 440 | 0 | 640 | 0 | 0 | 0 | 300 | 0 | 410 | 0 |
| Başarım ödülü | 100 | 0 | 825 | 0 | 850 | 0 | 50 | 0 | 125 | 0 |
| Ödül payı (toplam kazancın) | %30 | %0 | %25 | %0 | %18 | %0 | %51 | %0 | %41 | %0 |
| Açılan başarım (21) | 4 | 0 | 10 | 0 | 11 | 0 | 2 | 0 | 3 | 0 |
| Üç görevi tamamlanan gün | 0 | 0 | 12 | 0 | 101 | 0 | 0 | 0 | 1 | 0 |
| En uzun seri (gün) | 0 | 0 | 1 | 0 | 4 | 0 | 0 | 0 | 1 | 0 |
| Satın alınan joker | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Harcanan yıldız | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Kullanılan satın alınmış joker | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Yıl sonu bakiye (medyan, %10–%90) | 4.090 (3.360–4.547) | 2.909 (2.415–3.142) | 28.207 (27.499–29.525) | 21.196 (20.504–22.029) | 86.551 (85.310–88.009) | 70.741 (68.582–72.066) | 1.616 (1.421–1.759) | 781 (662–897) | 9.956 (9.683–10.796) | 6.004 (5.809–6.387) |

### Günlük görev türlerinin tamamlanma oranı (oynanan günlerde)

| Görev | Az oynayan | Düzenli oynayan | Yoğun oynayan | Klasik · az | Klasik · düzenli |
|---|---:|---:|---:|---:|---:|
| kolay · lines 10 | %49 | %89 | %100 | %3 | %21 |
| kolay · placed 25 | %68 | %100 | %100 | %34 | %100 |
| kolay · games 1 | %100 | %100 | %100 | %100 | %100 |
| orta · lines 25 | %6 | %50 | %99 | %0 | %0 |
| orta · puan (Klasik 750 / Eğlence 2.000, oranlı) | %0 | %2 | %89 | %0 | %0 |
| orta · combo 3 | %18 | %39 | %75 | %4 | %10 |
| orta · games 2 | %50 | %100 | %100 | %53 | %100 |
| zor · lines 50 | %0 | %6 | %86 | %0 | %0 |
| zor · puan (Klasik 1.500 / Eğlence 4.000, oranlı) | %0 | %0 | %4 | %0 | %0 |
| zor · multi 3 | %18 | %40 | %75 | %2 | %5 |
| zor · combo 4 | %3 | %5 | %15 | %0 | %1 |

### Hedef adaylarının tamamlanma oranı (bir günde, oynanan günlerde)

| Ölçü | Hedef | Az oynayan | Düzenli oynayan | Yoğun oynayan | Klasik · az | Klasik · düzenli |
|---|---:|---:|---:|---:|---:|---:|
| tek oyunda puan | 500 | %10 | %24 | %51 | %0 | %0 |
| tek oyunda puan | 750 | %1 | %1 | %4 | %0 | %0 |
| tek oyunda puan | 800 | %0 | %1 | %1 | %0 | %0 |
| tek oyunda puan | 1.000 | %0 | %1 | %1 | %0 | %0 |
| tek oyunda puan | 1.500 | %0 | %0 | %0 | %0 | %0 |
| tek oyunda puan | 2.000 | %0 | %0 | %0 | %0 | %0 |
| tek oyunda puan | 2.500 | %0 | %0 | %0 | %0 | %0 |
| gün içinde toplam puan | 1.000 | %1 | %33 | %99 | %0 | %0 |
| gün içinde toplam puan | 2.000 | %0 | %1 | %65 | %0 | %0 |
| gün içinde toplam puan | 3.000 | %0 | %0 | %14 | %0 | %0 |
| gün içinde toplam puan | 5.000 | %0 | %0 | %0 | %0 | %0 |
| kombo | 2 | %59 | %91 | %100 | %22 | %47 |
| kombo | 3 | %16 | %39 | %75 | %3 | %9 |
| kombo | 4 | %2 | %5 | %14 | %1 | %1 |
| kombo | 5 | %0 | %0 | %0 | %0 | %0 |
| kombo | 6 | %0 | %0 | %0 | %0 | %0 |
| tek hamlede hat | 2 | %64 | %94 | %100 | %23 | %52 |
| tek hamlede hat | 3 | %16 | %40 | %73 | %3 | %6 |
| tek hamlede hat | 4 | %2 | %6 | %17 | %0 | %0 |
| günlük hat | 10 | %46 | %89 | %100 | %2 | %22 |
| günlük hat | 20 | %14 | %65 | %100 | %0 | %1 |
| günlük hat | 25 | %6 | %51 | %99 | %0 | %0 |
| günlük hat | 40 | %0 | %18 | %94 | %0 | %0 |
| günlük hat | 50 | %0 | %6 | %85 | %0 | %0 |

### Başarımın açıldığı gün (medyan; "—" = oyuncuların yarısından azı bir yılda açıyor)

| Başarım | Hedef | ★ | Az oynayan | Düzenli oynayan | Yoğun oynayan | Klasik · az | Klasik · düzenli |
|---|---:|---:|---:|---:|---:|---:|---:|
| hat-1 | 100 | 25 | 40. gün | 5. gün | 2. gün | 129. gün | 19. gün |
| hat-2 | 1.000 | 75 | 337. gün | 46. gün | 14. gün | — (%0) | 183. gün |
| hat-3 | 5.000 | 200 | — (%0) | 224. gün | 71. gün | — (%0) | — (%0) |
| klasik-1 | 1.000 | 25 | — (%0) | — (%0) | — (%0) | — (%0) | — (%0) |
| klasik-2 | 2.500 | 75 | — (%0) | — (%0) | — (%0) | — (%0) | — (%0) |
| klasik-3 | 5.000 | 150 | — (%0) | — (%0) | — (%0) | — (%0) | — (%0) |
| eglence-1 | 1.000 | 25 | — (%15) | 197. gün | 57. gün | — (%0) | — (%0) |
| eglence-2 | 3.000 | 75 | — (%0) | — (%0) | — (%0) | — (%0) | — (%0) |
| eglence-3 | 6.000 | 150 | — (%0) | — (%0) | — (%0) | — (%0) | — (%0) |
| kombo-1 | 3 | 25 | 20. gün | 3. gün | 1. gün | 84. gün | 11. gün |
| kombo-2 | 5 | 50 | — (%0) | — (%0) | — (%0) | — (%0) | — (%0) |
| kombo-3 | 7 | 100 | — (%0) | — (%0) | — (%0) | — (%0) | — (%0) |
| bomba-1 | 10 | 25 | 43. gün | 5. gün | 2. gün | — (%0) | — (%0) |
| bomba-2 | 100 | 75 | 310. gün | 42. gün | 13. gün | — (%0) | — (%0) |
| bomba-3 | 500 | 150 | — (%0) | 205. gün | 62. gün | — (%0) | — (%0) |
| sans-1 | 10 | 25 | 65. gün | 8. gün | 3. gün | — (%0) | — (%0) |
| sans-2 | 50 | 75 | 263. gün | 36. gün | 11. gün | — (%0) | — (%0) |
| sans-3 | 200 | 150 | — (%0) | 136. gün | 39. gün | — (%0) | — (%0) |
| duzenli-1 | 3 | 25 | — (%0) | — (%10) | 7. gün | — (%0) | — (%0) |
| duzenli-2 | 7 | 75 | — (%0) | — (%0) | — (%30) | — (%0) | — (%0) |
| duzenli-3 | 30 | 200 | — (%0) | — (%0) | — (%0) | — (%0) | — (%0) |

## Beceri: orta (greedy bot)

### Harcayan oyuncu (her Eğlence oyununa 1/1/1 joker setiyle girer, parası yetiyorsa)

| | Az oynayan · görevli | Az oynayan · görevsiz | Düzenli oynayan · görevli | Düzenli oynayan · görevsiz | Yoğun oynayan · görevli | Yoğun oynayan · görevsiz | Klasik · az · görevli | Klasik · az · görevsiz | Klasik · düzenli · görevli | Klasik · düzenli · görevsiz |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Oynanan gün | 104 | 103 | 309 | 311 | 358 | 357 | 107 | 110 | 310 | 312 |
| Oyun | 157 | 154 | 1.234 | 1.242 | 3.573 | 3.571 | 165 | 166 | 1.236 | 1.253 |
| Oyun yıldızı (hat + oyun sonu + şanslı) | 21.547 | 20.609 | 165.144 | 163.027 | 533.336 | 531.605 | 8.228 | 8.572 | 64.545 | 65.806 |
| Görev ödülü (elle "Al") | 2.250 | 0 | 18.400 | 0 | 27.800 | 0 | 1.460 | 0 | 14.540 | 0 |
| Görev ödülü (gün sonu otomatik) | 1.600 | 0 | 2.110 | 0 | 0 | 0 | 930 | 0 | 1.540 | 0 |
| Başarım ödülü | 950 | 0 | 1.200 | 0 | 1.400 | 0 | 200 | 0 | 525 | 0 |
| Ödül payı (toplam kazancın) | %18 | %0 | %12 | %0 | %5 | %0 | %25 | %0 | %20 | %0 |
| Açılan başarım (21) | 14 | 0 | 17 | 0 | 18 | 0 | 5 | 0 | 8 | 0 |
| Üç görevi tamamlanan gün | 26 | 0 | 224 | 0 | 341 | 0 | 8 | 0 | 139 | 0 |
| En uzun seri (gün) | 2 | 0 | 12 | 0 | 54 | 0 | 1 | 0 | 6 | 0 |
| Satın alınan joker | 204 | 198 | 1.653 | 1.623 | 5.724 | 5.701 | 0 | 0 | 0 | 0 |
| Harcanan yıldız | 5.970 | 5.870 | 48.525 | 47.540 | 168.320 | 167.455 | 0 | 0 | 0 | 0 |
| Kullanılan satın alınmış joker | 204 | 198 | 1.653 | 1.622 | 5.724 | 5.701 | 0 | 0 | 0 | 0 |
| Yıl sonu bakiye (medyan, %10–%90) | 20.287 (17.058–21.597) | 14.546 (13.099–16.872) | 137.660 (131.367–143.054) | 114.765 (111.456–117.598) | 392.633 (386.334–398.778) | 363.553 (353.908–370.367) | 11.008 (9.825–12.041) | 8.572 (7.381–9.702) | 81.178 (78.848–84.411) | 65.806 (62.966–67.549) |

### Biriktiren oyuncu (hiç joker almaz)

| | Az oynayan · görevli | Az oynayan · görevsiz | Düzenli oynayan · görevli | Düzenli oynayan · görevsiz | Yoğun oynayan · görevli | Yoğun oynayan · görevsiz | Klasik · az · görevli | Klasik · az · görevsiz | Klasik · düzenli · görevli | Klasik · düzenli · görevsiz |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Oynanan gün | 104 | 103 | 309 | 311 | 358 | 357 | 107 | 110 | 310 | 312 |
| Oyun | 157 | 154 | 1.234 | 1.242 | 3.573 | 3.571 | 165 | 166 | 1.236 | 1.253 |
| Oyun yıldızı (hat + oyun sonu + şanslı) | 16.326 | 15.300 | 126.215 | 123.883 | 394.730 | 395.375 | 8.228 | 8.572 | 64.545 | 65.806 |
| Görev ödülü (elle "Al") | 2.020 | 0 | 16.440 | 0 | 26.660 | 0 | 1.460 | 0 | 14.540 | 0 |
| Görev ödülü (gün sonu otomatik) | 1.340 | 0 | 1.860 | 0 | 0 | 0 | 930 | 0 | 1.540 | 0 |
| Başarım ödülü | 650 | 0 | 1.200 | 0 | 1.200 | 0 | 200 | 0 | 525 | 0 |
| Ödül payı (toplam kazancın) | %19 | %0 | %13 | %0 | %7 | %0 | %25 | %0 | %20 | %0 |
| Açılan başarım (21) | 12 | 0 | 17 | 0 | 17 | 0 | 5 | 0 | 8 | 0 |
| Üç görevi tamamlanan gün | 15 | 0 | 186 | 0 | 319 | 0 | 8 | 0 | 139 | 0 |
| En uzun seri (gün) | 2 | 0 | 9 | 0 | 29 | 0 | 1 | 0 | 6 | 0 |
| Satın alınan joker | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Harcanan yıldız | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Kullanılan satın alınmış joker | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Yıl sonu bakiye (medyan, %10–%90) | 20.336 (17.265–21.289) | 15.300 (13.488–17.773) | 146.205 (138.285–149.263) | 123.883 (119.957–126.577) | 422.880 (416.869–429.316) | 395.375 (383.074–400.015) | 11.008 (9.825–12.041) | 8.572 (7.381–9.702) | 81.178 (78.848–84.411) | 65.806 (62.966–67.549) |

### Günlük görev türlerinin tamamlanma oranı (oynanan günlerde)

| Görev | Az oynayan | Düzenli oynayan | Yoğun oynayan | Klasik · az | Klasik · düzenli |
|---|---:|---:|---:|---:|---:|
| kolay · lines 10 | %93 | %100 | %100 | %82 | %100 |
| kolay · placed 25 | %95 | %100 | %100 | %90 | %100 |
| kolay · games 1 | %100 | %100 | %100 | %100 | %100 |
| orta · lines 25 | %73 | %99 | %100 | %37 | %99 |
| orta · puan (Klasik 750 / Eğlence 2.000, oranlı) | %46 | %99 | %100 | %31 | %97 |
| orta · combo 3 | %83 | %99 | %100 | %69 | %94 |
| orta · games 2 | %50 | %100 | %100 | %53 | %100 |
| zor · lines 50 | %49 | %97 | %100 | %6 | %70 |
| zor · puan (Klasik 1.500 / Eğlence 4.000, oranlı) | %5 | %78 | %100 | %4 | %57 |
| zor · multi 3 | %23 | %51 | %87 | %7 | %19 |
| zor · combo 4 | %57 | %87 | %100 | %25 | %58 |

### Hedef adaylarının tamamlanma oranı (bir günde, oynanan günlerde)

| Ölçü | Hedef | Az oynayan | Düzenli oynayan | Yoğun oynayan | Klasik · az | Klasik · düzenli |
|---|---:|---:|---:|---:|---:|---:|
| tek oyunda puan | 500 | %75 | %98 | %100 | %39 | %75 |
| tek oyunda puan | 750 | %62 | %93 | %100 | %15 | %36 |
| tek oyunda puan | 800 | %61 | %92 | %100 | %13 | %30 |
| tek oyunda puan | 1.000 | %51 | %87 | %100 | %7 | %14 |
| tek oyunda puan | 1.500 | %33 | %69 | %97 | %0 | %1 |
| tek oyunda puan | 2.000 | %20 | %44 | %83 | %0 | %0 |
| tek oyunda puan | 2.500 | %11 | %27 | %61 | %0 | %0 |
| gün içinde toplam puan | 1.000 | %59 | %98 | %100 | %15 | %88 |
| gün içinde toplam puan | 2.000 | %28 | %88 | %100 | %0 | %28 |
| gün içinde toplam puan | 3.000 | %11 | %69 | %100 | %0 | %3 |
| gün içinde toplam puan | 5.000 | %1 | %30 | %99 | %0 | %0 |
| kombo | 2 | %98 | %100 | %100 | %96 | %100 |
| kombo | 3 | %82 | %99 | %100 | %68 | %94 |
| kombo | 4 | %53 | %87 | %100 | %27 | %58 |
| kombo | 5 | %17 | %39 | %76 | %5 | %14 |
| kombo | 6 | %2 | %7 | %20 | %1 | %3 |
| tek hamlede hat | 2 | %89 | %100 | %100 | %76 | %98 |
| tek hamlede hat | 3 | %23 | %51 | %87 | %7 | %19 |
| tek hamlede hat | 4 | %0 | %2 | %6 | %0 | %0 |
| günlük hat | 10 | %92 | %100 | %100 | %84 | %100 |
| günlük hat | 20 | %80 | %100 | %100 | %56 | %100 |
| günlük hat | 25 | %73 | %100 | %100 | %41 | %99 |
| günlük hat | 40 | %58 | %98 | %100 | %15 | %85 |
| günlük hat | 50 | %48 | %96 | %100 | %8 | %70 |

### Başarımın açıldığı gün (medyan; "—" = oyuncuların yarısından azı bir yılda açıyor)

| Başarım | Hedef | ★ | Az oynayan | Düzenli oynayan | Yoğun oynayan | Klasik · az | Klasik · düzenli |
|---|---:|---:|---:|---:|---:|---:|---:|
| hat-1 | 100 | 25 | 8. gün | 2. gün | 1. gün | 19. gün | 2. gün |
| hat-2 | 1.000 | 75 | 59. gün | 9. gün | 3. gün | 143. gün | 18. gün |
| hat-3 | 5.000 | 200 | 294. gün | 38. gün | 12. gün | — (%0) | 92. gün |
| klasik-1 | 1.000 | 25 | 41. gün | 14. gün | 5. gün | 63. gün | 4. gün |
| klasik-2 | 2.500 | 75 | — (%0) | — (%0) | — (%0) | — (%0) | — (%0) |
| klasik-3 | 5.000 | 150 | — (%0) | — (%0) | — (%0) | — (%0) | — (%0) |
| eglence-1 | 1.000 | 25 | 6. gün | 1. gün | 1. gün | — (%0) | — (%0) |
| eglence-2 | 3.000 | 75 | 93. gün | 8. gün | 2. gün | — (%0) | — (%0) |
| eglence-3 | 6.000 | 150 | — (%0) | — (%0) | — (%0) | — (%0) | — (%0) |
| kombo-1 | 3 | 25 | 4. gün | 1. gün | 1. gün | 4. gün | 1. gün |
| kombo-2 | 5 | 50 | 12. gün | 2. gün | 1. gün | 74. gün | 5. gün |
| kombo-3 | 7 | 100 | 255. gün | 74. gün | 24. gün | — (%45) | 67. gün |
| bomba-1 | 10 | 25 | 10. gün | 2. gün | 1. gün | — (%0) | — (%0) |
| bomba-2 | 100 | 75 | 82. gün | 12. gün | 3. gün | — (%0) | — (%0) |
| bomba-3 | 500 | 150 | — (%20) | 51. gün | 15. gün | — (%0) | — (%0) |
| sans-1 | 10 | 25 | 12. gün | 3. gün | 1. gün | — (%0) | — (%0) |
| sans-2 | 50 | 75 | 58. gün | 8. gün | 3. gün | — (%0) | — (%0) |
| sans-3 | 200 | 150 | 222. gün | 28. gün | 9. gün | — (%0) | — (%0) |
| duzenli-1 | 3 | 25 | — (%10) | 10. gün | 3. gün | — (%0) | 14. gün |
| duzenli-2 | 7 | 75 | — (%0) | 35. gün | 10. gün | — (%0) | — (%45) |
| duzenli-3 | 30 | 200 | — (%0) | — (%0) | 107. gün | — (%0) | — (%0) |

## Beceri: güçlü (planlayıcı bot)

### Harcayan oyuncu (her Eğlence oyununa 1/1/1 joker setiyle girer, parası yetiyorsa)

| | Az oynayan · görevli | Az oynayan · görevsiz | Düzenli oynayan · görevli | Düzenli oynayan · görevsiz | Yoğun oynayan · görevli | Yoğun oynayan · görevsiz | Klasik · az · görevli | Klasik · az · görevsiz | Klasik · düzenli · görevli | Klasik · düzenli · görevsiz |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Oynanan gün | 104 | 103 | 309 | 311 | 358 | 357 | 107 | 110 | 310 | 312 |
| Oyun | 157 | 154 | 1.234 | 1.242 | 3.573 | 3.571 | 165 | 166 | 1.236 | 1.253 |
| Oyun yıldızı (hat + oyun sonu + şanslı) | 37.312 | 36.090 | 293.726 | 289.568 | 886.841 | 885.340 | 28.401 | 30.903 | 216.964 | 217.005 |
| Görev ödülü (elle "Al") | 3.660 | 0 | 20.790 | 0 | 28.540 | 0 | 2.730 | 0 | 17.950 | 0 |
| Görev ödülü (gün sonu otomatik) | 2.340 | 0 | 2.360 | 0 | 0 | 0 | 2.020 | 0 | 2.010 | 0 |
| Başarım ödülü | 1.250 | 0 | 1.325 | 0 | 1.525 | 0 | 500 | 0 | 575 | 0 |
| Ödül payı (toplam kazancın) | %16 | %0 | %8 | %0 | %3 | %0 | %16 | %0 | %9 | %0 |
| Açılan başarım (21) | 17 | 0 | 18 | 0 | 19 | 0 | 8 | 0 | 9 | 0 |
| Üç görevi tamamlanan gün | 58 | 0 | 277 | 0 | 356 | 0 | 37 | 0 | 214 | 0 |
| En uzun seri (gün) | 3 | 0 | 17 | 0 | 97 | 0 | 3 | 0 | 10 | 0 |
| Satın alınan joker | 180 | 181 | 1.434 | 1.431 | 5.015 | 4.972 | 0 | 0 | 0 | 0 |
| Harcanan yıldız | 5.505 | 5.510 | 43.985 | 43.675 | 153.100 | 152.075 | 0 | 0 | 0 | 0 |
| Kullanılan satın alınmış joker | 180 | 180 | 1.434 | 1.431 | 5.014 | 4.971 | 0 | 0 | 0 | 0 |
| Yıl sonu bakiye (medyan, %10–%90) | 39.017 (34.505–41.532) | 31.077 (28.158–35.784) | 273.315 (255.073–279.346) | 245.153 (241.992–253.813) | 764.561 (752.316–772.682) | 735.345 (722.479–741.440) | 33.511 (31.131–37.792) | 30.903 (24.820–32.918) | 237.709 (226.843–243.561) | 217.005 (211.640–231.602) |

### Biriktiren oyuncu (hiç joker almaz)

| | Az oynayan · görevli | Az oynayan · görevsiz | Düzenli oynayan · görevli | Düzenli oynayan · görevsiz | Yoğun oynayan · görevli | Yoğun oynayan · görevsiz | Klasik · az · görevli | Klasik · az · görevsiz | Klasik · düzenli · görevli | Klasik · düzenli · görevsiz |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Oynanan gün | 104 | 103 | 309 | 311 | 358 | 357 | 107 | 110 | 310 | 312 |
| Oyun | 157 | 154 | 1.234 | 1.242 | 3.573 | 3.571 | 165 | 166 | 1.236 | 1.253 |
| Oyun yıldızı (hat + oyun sonu + şanslı) | 36.119 | 34.860 | 281.191 | 277.713 | 844.386 | 845.344 | 28.401 | 30.903 | 216.964 | 217.005 |
| Görev ödülü (elle "Al") | 3.350 | 0 | 20.210 | 0 | 28.310 | 0 | 2.730 | 0 | 17.950 | 0 |
| Görev ödülü (gün sonu otomatik) | 2.140 | 0 | 2.280 | 0 | 0 | 0 | 2.020 | 0 | 2.010 | 0 |
| Başarım ödülü | 1.250 | 0 | 1.325 | 0 | 1.525 | 0 | 500 | 0 | 575 | 0 |
| Ödül payı (toplam kazancın) | %16 | %0 | %8 | %0 | %3 | %0 | %16 | %0 | %9 | %0 |
| Açılan başarım (21) | 17 | 0 | 18 | 0 | 19 | 0 | 8 | 0 | 9 | 0 |
| Üç görevi tamamlanan gün | 53 | 0 | 264 | 0 | 351 | 0 | 37 | 0 | 214 | 0 |
| En uzun seri (gün) | 3 | 0 | 16 | 0 | 78 | 0 | 3 | 0 | 10 | 0 |
| Satın alınan joker | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Harcanan yıldız | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Kullanılan satın alınmış joker | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Yıl sonu bakiye (medyan, %10–%90) | 42.774 (37.184–44.839) | 34.860 (31.149–39.949) | 304.930 (285.308–311.705) | 277.713 (270.739–286.492) | 874.141 (862.065–884.320) | 845.344 (829.001–853.873) | 33.511 (31.131–37.792) | 30.903 (24.820–32.918) | 237.709 (226.843–243.561) | 217.005 (211.640–231.602) |

### Günlük görev türlerinin tamamlanma oranı (oynanan günlerde)

| Görev | Az oynayan | Düzenli oynayan | Yoğun oynayan | Klasik · az | Klasik · düzenli |
|---|---:|---:|---:|---:|---:|
| kolay · lines 10 | %98 | %100 | %100 | %98 | %100 |
| kolay · placed 25 | %100 | %100 | %100 | %99 | %100 |
| kolay · games 1 | %100 | %100 | %100 | %100 | %100 |
| orta · lines 25 | %95 | %100 | %100 | %84 | %100 |
| orta · puan (Klasik 750 / Eğlence 2.000, oranlı) | %86 | %100 | %100 | %80 | %100 |
| orta · combo 3 | %94 | %100 | %100 | %84 | %99 |
| orta · games 2 | %50 | %100 | %100 | %53 | %100 |
| zor · lines 50 | %84 | %100 | %100 | %66 | %100 |
| zor · puan (Klasik 1.500 / Eğlence 4.000, oranlı) | %71 | %100 | %100 | %57 | %98 |
| zor · multi 3 | %42 | %75 | %98 | %13 | %31 |
| zor · combo 4 | %71 | %97 | %100 | %46 | %81 |

### Hedef adaylarının tamamlanma oranı (bir günde, oynanan günlerde)

| Ölçü | Hedef | Az oynayan | Düzenli oynayan | Yoğun oynayan | Klasik · az | Klasik · düzenli |
|---|---:|---:|---:|---:|---:|---:|
| tek oyunda puan | 500 | %92 | %100 | %100 | %86 | %100 |
| tek oyunda puan | 750 | %86 | %100 | %100 | %75 | %97 |
| tek oyunda puan | 800 | %86 | %100 | %100 | %73 | %97 |
| tek oyunda puan | 1.000 | %81 | %99 | %100 | %63 | %92 |
| tek oyunda puan | 1.500 | %74 | %98 | %100 | %47 | %81 |
| tek oyunda puan | 2.000 | %67 | %96 | %100 | %32 | %63 |
| tek oyunda puan | 2.500 | %61 | %94 | %100 | %19 | %43 |
| gün içinde toplam puan | 1.000 | %83 | %100 | %100 | %71 | %100 |
| gün içinde toplam puan | 2.000 | %71 | %100 | %100 | %43 | %95 |
| gün içinde toplam puan | 3.000 | %60 | %98 | %100 | %19 | %83 |
| gün içinde toplam puan | 5.000 | %44 | %94 | %100 | %3 | %49 |
| kombo | 2 | %100 | %100 | %100 | %100 | %100 |
| kombo | 3 | %92 | %100 | %100 | %85 | %99 |
| kombo | 4 | %69 | %96 | %100 | %47 | %81 |
| kombo | 5 | %29 | %60 | %92 | %12 | %28 |
| kombo | 6 | %2 | %5 | %13 | %2 | %5 |
| tek hamlede hat | 2 | %93 | %100 | %100 | %89 | %100 |
| tek hamlede hat | 3 | %39 | %75 | %98 | %12 | %32 |
| tek hamlede hat | 4 | %3 | %7 | %16 | %1 | %3 |
| günlük hat | 10 | %98 | %100 | %100 | %99 | %100 |
| günlük hat | 20 | %94 | %100 | %100 | %90 | %100 |
| günlük hat | 25 | %91 | %100 | %100 | %87 | %100 |
| günlük hat | 40 | %85 | %100 | %100 | %75 | %100 |
| günlük hat | 50 | %82 | %100 | %100 | %67 | %99 |

### Başarımın açıldığı gün (medyan; "—" = oyuncuların yarısından azı bir yılda açıyor)

| Başarım | Hedef | ★ | Az oynayan | Düzenli oynayan | Yoğun oynayan | Klasik · az | Klasik · düzenli |
|---|---:|---:|---:|---:|---:|---:|---:|
| hat-1 | 100 | 25 | 3. gün | 1. gün | 1. gün | 7. gün | 1. gün |
| hat-2 | 1.000 | 75 | 17. gün | 3. gün | 1. gün | 43. gün | 6. gün |
| hat-3 | 5.000 | 200 | 75. gün | 10. gün | 3. gün | 198. gün | 27. gün |
| klasik-1 | 1.000 | 25 | 9. gün | 1. gün | 1. gün | 5. gün | 1. gün |
| klasik-2 | 2.500 | 75 | 33. gün | 3. gün | 1. gün | 15. gün | 3. gün |
| klasik-3 | 5.000 | 150 | — (%0) | — (%0) | — (%0) | — (%0) | — (%0) |
| eglence-1 | 1.000 | 25 | 5. gün | 1. gün | 1. gün | — (%0) | — (%0) |
| eglence-2 | 3.000 | 75 | 5. gün | 1. gün | 1. gün | — (%0) | — (%0) |
| eglence-3 | 6.000 | 150 | 10. gün | 3. gün | 1. gün | — (%0) | — (%0) |
| kombo-1 | 3 | 25 | 3. gün | 1. gün | 1. gün | 3. gün | 1. gün |
| kombo-2 | 5 | 50 | 10. gün | 2. gün | 1. gün | 24. gün | 3. gün |
| kombo-3 | 7 | 100 | — (%0) | — (%0) | — (%0) | — (%0) | — (%0) |
| bomba-1 | 10 | 25 | 5. gün | 1. gün | 1. gün | — (%0) | — (%0) |
| bomba-2 | 100 | 75 | 20. gün | 4. gün | 1. gün | — (%0) | — (%0) |
| bomba-3 | 500 | 150 | 110. gün | 15. gün | 4. gün | — (%0) | — (%0) |
| sans-1 | 10 | 25 | 5. gün | 1. gün | 1. gün | — (%0) | — (%0) |
| sans-2 | 50 | 75 | 14. gün | 3. gün | 1. gün | — (%0) | — (%0) |
| sans-3 | 200 | 150 | 56. gün | 8. gün | 2. gün | — (%0) | — (%0) |
| duzenli-1 | 3 | 25 | 261. gün | 6. gün | 3. gün | 315. gün | 11. gün |
| duzenli-2 | 7 | 75 | — (%0) | 16. gün | 7. gün | — (%0) | 17. gün |
| duzenli-3 | 30 | 200 | — (%0) | — (%0) | 30. gün | — (%0) | — (%0) |

## Özet (harcayan oyuncu, medyan)

| Beceri | Profil | Oyun ★ / oynanan gün | Ödül ★ / oynanan gün | Ödül payı | Toplam ★ / oynanan gün | Yıl sonu bakiye (görevli) | Yıl sonu bakiye (görevsiz) | Alınan joker (görevli / görevsiz) |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| zayıf (rastgele bot) | Az oynayan | 38 | 16 | %29 | 53 | 294 | 99 | 184 / 121 |
| zayıf (rastgele bot) | Düzenli oynayan | 100 | 28 | %22 | 128 | 158 | 79 | 1.313 / 945 |
| zayıf (rastgele bot) | Yoğun oynayan | 279 | 53 | %16 | 331 | 163 | 89 | 4.001 / 3.158 |
| zayıf (rastgele bot) | Klasik · az | 7 | 8 | %51 | 15 | 1.616 | 781 | 0 / 0 |
| zayıf (rastgele bot) | Klasik · düzenli | 19 | 13 | %41 | 32 | 9.956 | 6.004 | 0 / 0 |
| orta (greedy bot) | Az oynayan | 198 | 44 | %18 | 243 | 20.287 | 14.546 | 204 / 198 |
| orta (greedy bot) | Düzenli oynayan | 532 | 71 | %12 | 601 | 137.660 | 114.765 | 1.653 / 1.623 |
| orta (greedy bot) | Yoğun oynayan | 1.493 | 81 | %5 | 1.574 | 392.633 | 363.553 | 5.724 / 5.701 |
| orta (greedy bot) | Klasik · az | 79 | 25 | %25 | 105 | 11.008 | 8.572 | 0 / 0 |
| orta (greedy bot) | Klasik · düzenli | 210 | 54 | %20 | 263 | 81.178 | 65.806 | 0 / 0 |
| güçlü (planlayıcı bot) | Az oynayan | 341 | 68 | %16 | 408 | 39.017 | 31.077 | 180 / 181 |
| güçlü (planlayıcı bot) | Düzenli oynayan | 936 | 79 | %8 | 1.016 | 273.315 | 245.153 | 1.434 / 1.431 |
| güçlü (planlayıcı bot) | Yoğun oynayan | 2.481 | 84 | %3 | 2.565 | 764.561 | 735.345 | 5.015 / 4.972 |
| güçlü (planlayıcı bot) | Klasik · az | 275 | 49 | %16 | 324 | 33.511 | 30.903 | 0 / 0 |
| güçlü (planlayıcı bot) | Klasik · düzenli | 705 | 67 | %9 | 771 | 237.709 | 217.005 | 0 / 0 |

Joker seti (1 Çekiç + 1 Yenile + 1 Döndür) = 85 ★.
