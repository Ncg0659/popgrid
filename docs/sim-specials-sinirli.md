# Aşama 8.2 — joker sınırı (A seçeneği) sonrası ayrıştırma

Şanslı bloktan oyun başına en fazla 2 ücretsiz joker (sonrakiler +5 yıldız) uygulandıktan sonra, sınır öncesi ölçümle (docs/sim-specials-ayristirma.md) aynı tohumlar ve aynı yöntem. Commit 3a69872 motoru.

| Profil (tohum) | Varyant | Hamle ort. | Hamle p50 · p90 | Skor ort. | Yıldız ort. | Tavana ulaşan | Şanslı joker / oyun | Hamle sınırı |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Ortalama (greedy bot) (500) | Önce (özel bloksuz) | 91,1 | 85 · 146 | 976 | 125,9 | %1,8 | 0,0 | 0 |
| Ortalama (greedy bot) (500) | Sonra (tam) | 109,2 | 98 · 182 | 1.155 | 160,0 | %9,2 | 0,6 | 0 |
| Ortalama (greedy bot) (500) | Sonra, bombasız | 96,4 | 89 · 160 | 1.036 | 148,4 | %5,8 | 0,5 | 0 |
| Ortalama (greedy bot) (500) | Sonra, şanslı joker ödülü yok | 101,4 | 92 · 164 | 1.065 | 150,2 | %5,2 | 0,6 | 0 |
| Deneyimli (planlayıcı bot) (30) | Önce (özel bloksuz) | 434,4 | 368 · 761 | 4.710 | 277,6 | %83,3 | 0,0 | 0 |
| Deneyimli (planlayıcı bot) (30) | Sonra (tam) | 519,9 | 530 · 1.106 | 5.508 | 291,4 | %86,7 | 1,6 | 0 |
| Deneyimli (planlayıcı bot) (30) | Sonra, bombasız | 486,7 | 476 · 989 | 5.299 | 280,8 | %83,3 | 1,6 | 0 |
| Deneyimli (planlayıcı bot) (30) | Sonra, şanslı joker ödülü yok | 432,4 | 353 · 872 | 4.577 | 291,4 | %86,7 | 1,5 | 0 |
