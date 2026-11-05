# Aşama 8.2 — Bombalı ve Parlayan Şanslı Bloklar simülasyonu

Kaynak: `scripts/simulate-specials.ts`, SIM_SCALE=1. Her tohum iki kez oynandı: **Önce** = Aşama 8 öncesi Eğlence (`specials: false`), **Sonra** = özel bloklu Eğlence. Aynı bot, aynı tohum (1…N), joker yalnızca sıkışınca (`jokerRescueAction`), ücretsiz haklar 1/1/2, satın alınmış joker yok. Yıldızlar gerçek ekonomi defteriyle (300 tavanı dahil). Hamle sınırı 3000.

> Botlar gerçek oyuncu değildir ve özel blokları hedeflemez (bombayı bilerek doldurmaz, şanslı bloğu bilerek temizlemez). Süreler bu bilgisayarda Node.js ile ölçülen motor süresidir; telefon performansını ölçmez.

## Yeni başlayan (rastgele bot) — 1000 tohum

| Ölçü | Önce | Sonra | Fark |
|---|---:|---:|---:|
| Hamle (ortalama) | 27,3 | 29,5 | %8,1 |
| Hamle p10 / p50 / p90 | 17 / 26 / 38 | 19 / 29 / 41 | |
| Skor (ortalama) | 219 | 236 | %8,0 |
| Skor p10 / p50 / p90 | 91 / 206 / 356 | 101 / 223 / 386 | |
| Patlama puanı / oyun (skordaki payı) | — | 5,3 (%2,3) | |
| Toplam yıldız / oyun | 24,2 | 28,9 | %19,6 |
| Yıldız p10 / p50 / p90 / en çok | 4 / 25 / 43 / 95 | 10 / 27 / 53 / 101 | |
| — hat yıldızı | 15,8 | 16,6 | %5,1 |
| — şanslı yıldız (tavan öncesi) | 0,0 | 3,1 | |
| — oyun sonu yıldızı | 8,4 | 9,3 | %10,3 |
| 300 tavanına ulaşan oyun | %0,0 | %0,0 | |
| 300'ü aşan oyun (olmamalı) | 0 | 0 | |
| Şanslıdan +1 ücretsiz joker / oyun | — | 0,1 (Ç 34 · Y 23 · D 70) | |
| Ücretsiz joker kullanımı / oyun (gerçek) | 3,5 | 3,6 | |
| Defterin saydığı ücretsiz kullanım / oyun | 3,5 | 3,5 | |
| Defterin eksik saydığı oyun | 0 | 93 | |
| Hamle sınırına takılan oyun | 0 | 0 | |

| Özel blok | Değer |
|---|---:|
| Üretilen tepsi | 10.298 |
| Bombalı tepsi oranı (hedef %12) | %12,3 |
| Şanslı tepsi oranı (hedef %10) | %10,1 |
| Bomba / oyun: tepside · konan · patlayan | 1,3 · 1,2 · 1,1 |
| Patlayanların erken (hatla) payı · zincir payı | %23,7 · %0,6 |
| Şanslı / oyun: tepside · konan · ödül veren | 1,0 · 1,0 · 0,6 |
| Konan şanslının ödüle dönüşme oranı · patlamayla gelen pay | %60,1 · %2,5 |
| Çekiçle söndürülen özel blok / oyun | 0,0 |

| Motor süresi: play() (µs, bu bilgisayar) | Önce | Sonra |
|---|---:|---:|
| ortalama · p50 · p99 · en uzun | 9,0 · 4,4 · 60,0 · 4.728 | 12,4 · 6,5 · 70,5 · 5.716 |

## Ortalama (greedy bot) — 500 tohum

| Ölçü | Önce | Sonra | Fark |
|---|---:|---:|---:|
| Hamle (ortalama) | 91,1 | 109,4 | %20,1 |
| Hamle p10 / p50 / p90 | 44 / 85 / 146 | 50 / 98 / 182 | |
| Skor (ortalama) | 976 | 1.157 | %18,6 |
| Skor p10 / p50 / p90 | 421 / 908 / 1.629 | 485 / 1.068 / 2.004 | |
| Patlama puanı / oyun (skordaki payı) | — | 17,2 (%1,5) | |
| Toplam yıldız / oyun | 125,9 | 159,8 | %26,9 |
| Yıldız p10 / p50 / p90 / en çok | 51 / 117 / 211 / 300 | 68 / 147 / 290 / 300 | |
| — hat yıldızı | 80,0 | 93,5 | %16,9 |
| — şanslı yıldız (tavan öncesi) | 0,0 | 18,0 | |
| — oyun sonu yıldızı | 46,0 | 49,2 | %7,1 |
| 300 tavanına ulaşan oyun | %1,8 | %9,0 | |
| 300'ü aşan oyun (olmamalı) | 0 | 0 | |
| Şanslıdan +1 ücretsiz joker / oyun | — | 0,7 (Ç 92 · Y 70 · D 175) | |
| Ücretsiz joker kullanımı / oyun (gerçek) | 3,5 | 4,0 | |
| Defterin saydığı ücretsiz kullanım / oyun | 3,5 | 3,4 | |
| Defterin eksik saydığı oyun | 0 | 200 | |
| Hamle sınırına takılan oyun | 0 | 0 | |

| Özel blok | Değer |
|---|---:|
| Üretilen tepsi | 18.447 |
| Bombalı tepsi oranı (hedef %12) | %12,4 |
| Şanslı tepsi oranı (hedef %10) | %10,3 |
| Bomba / oyun: tepside · konan · patlayan | 4,6 · 4,5 · 4,4 |
| Patlayanların erken (hatla) payı · zincir payı | %56,4 · %1,3 |
| Şanslı / oyun: tepside · konan · ödül veren | 3,8 · 3,7 · 3,4 |
| Konan şanslının ödüle dönüşme oranı · patlamayla gelen pay | %91,1 · %1,9 |
| Çekiçle söndürülen özel blok / oyun | 0,0 |

| Motor süresi: play() (µs, bu bilgisayar) | Önce | Sonra |
|---|---:|---:|
| ortalama · p50 · p99 · en uzun | 5,9 · 4,2 · 31,3 · 1.182 | 7,4 · 5,4 · 38,8 · 2.413 |

## Deneyimli (planlayıcı bot) — 100 tohum

| Ölçü | Önce | Sonra | Fark |
|---|---:|---:|---:|
| Hamle (ortalama) | 375,7 | 816,2 | %117,2 |
| Hamle p10 / p50 / p90 | 104 / 332 / 689 | 200 / 636 / 1.847 | |
| Skor (ortalama) | 4.060 | 8.702 | %114,3 |
| Skor p10 / p50 / p90 | 1.116 / 3.567 / 7.570 | 2.068 / 6.653 / 19.692 | |
| Patlama puanı / oyun (skordaki payı) | — | 117,7 (%1,4) | |
| Toplam yıldız / oyun | 270,4 | 291,1 | %7,7 |
| Yıldız p10 / p50 / p90 / en çok | 155 / 300 / 300 / 300 | 300 / 300 / 300 / 300 | |
| — hat yıldızı | 365,2 | 772,8 | %111,6 |
| — şanslı yıldız (tavan öncesi) | 0,0 | 151,6 | |
| — oyun sonu yıldızı | 23,0 | 8,8 | %-61,7 |
| 300 tavanına ulaşan oyun | %76,0 | %90,0 | |
| 300'ü aşan oyun (olmamalı) | 0 | 0 | |
| Şanslıdan +1 ücretsiz joker / oyun | — | 5,5 (Ç 186 · Y 108 · D 255) | |
| Ücretsiz joker kullanımı / oyun (gerçek) | 3,0 | 7,1 | |
| Defterin saydığı ücretsiz kullanım / oyun | 3,0 | 2,9 | |
| Defterin eksik saydığı oyun | 0 | 81 | |
| Hamle sınırına takılan oyun | 0 | 4 | |

| Özel blok | Değer |
|---|---:|
| Üretilen tepsi | 27.250 |
| Bombalı tepsi oranı (hedef %12) | %12,3 |
| Şanslı tepsi oranı (hedef %10) | %10,5 |
| Bomba / oyun: tepside · konan · patlayan | 33,4 · 33,4 · 33,3 |
| Patlayanların erken (hatla) payı · zincir payı | %76,9 · %1,0 |
| Şanslı / oyun: tepside · konan · ödül veren | 28,7 · 28,6 · 28,2 |
| Konan şanslının ödüle dönüşme oranı · patlamayla gelen pay | %98,5 · %1,6 |
| Çekiçle söndürülen özel blok / oyun | 0,0 |

| Motor süresi: play() (µs, bu bilgisayar) | Önce | Sonra |
|---|---:|---:|
| ortalama · p50 · p99 · en uzun | 6,9 · 5,2 · 30,5 · 1.146 | 9,5 · 7,3 · 39,3 · 1.935 |

