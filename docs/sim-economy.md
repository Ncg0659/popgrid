# POPGRID — Yıldız ekonomisi simülasyonu (Aşama 7.1)

> **Bu bir bot simülasyonudur, gerçek kullanıcı davranışı değildir.** Botlar yalnızca kuralların büyüklük sırasını gösterir.
> Gerçek oyuncular jokeri daha erken kullanabilir, oyunu yarıda bırakabilir, daha az ya da daha çok oynayabilir.

## Yöntem

- Oyun motoru: üretici sürümü 1, varsayılan kurtarma ayarı, hamle sınırı 3.000. Motor bu aşamada değişmedi.
- Yıldızlar gerçek ekonomi defteriyle hesaplandı (`src/economy/ledger.ts`): her hamlede `awardMove`, joker sonrasında `syncUsage`, oyun sonunda `finishGame`.
- Kurallar: tek hamlede 1 hat = 2, 2 hat = 5, 3+ hat = 10 yıldız (birikmez); oyun sonunda `Math.floor(skor / 100) * 5`. Joker yıldız vermez.
- Yıldız tavanı (onaylı, defterde uygulanır): Eğlence Modu'nda bir oyunda en fazla 300 yıldız (hat + oyun sonu toplamı); Klasik'te tavan yok.
- Fiyatlar: Çekiç 25, Yenile 40, Döndür 20. Ücretsiz haklar her Eğlence oyununda 1 / 1 / 2.
- Botlar jokeri **yalnızca sıkışınca** kullanır (Aşama 6.1 ile aynı davranış). Önce ücretsiz hak, bitince satın alınmış hak harcanır (motor kuralı).
- Tohumlar: temel ölçüm ve satın alma deneyleri 1…N (her deney aynı tohumlarla, fark yalnızca envanterden gelir); kariyerler `100000 + kariyer × 1000 + oyun`. Rastgele botun kendi rastgeleliği: `createRng(tohum ^ 0xa5a5a5a5)`.
- Belirlenimli: aynı komut aynı tabloyu üretir. Yeniden üretmek için `npm run sim:economy`.
- Eğlence 0/0/0 (jokersiz Eğlence) Klasik ile birebir aynı oyunu verir (docs/sim-jokers.md kontrolü); bu yüzden "ücretsiz jokerin etkisi" Klasik ile Eğlence farkıdır.

| Profil | Bot | Temel oyun | Satın alma deneyi | Kariyer |
|---|---|---|---|---|
| Yeni başlayan | rastgele bot: geçerli hamlelerden rastgele birini oynar | 1.000 Klasik + 1.000 Eğlence | 1.000 oyun × 4 | 20 × 100 oyun × 2 politika |
| Ortalama | greedy bot: tek hamle ileriye bakar, temizlemeyi ve boş alanı sever | 500 Klasik + 500 Eğlence | 500 oyun × 4 | 10 × 100 oyun × 2 politika |
| Deneyimli | planlayıcı bot: tepsideki parçaların bütün sıralarını ışın aramasıyla planlar | 100 Klasik + 100 Eğlence | 50 oyun × 4 | 1 × 40 oyun × 2 politika |

## 1. Oyun başına yıldız

| Profil · mod | Ort. yıldız | Medyan | P10 – P25 – P75 – P90 | Hat yıldızı (ort.) | Oyun sonu yıldızı (ort.) | Ort. skor | Medyan skor | Ort. hamle |
|---|---|---|---|---|---|---|---|---|
| Yeni başlayan · Klasik | 4,0 | 2 | 0 – 0 – 4 – 13 | 3,0 | 1,0 | 69 | 57 | 13 |
| Yeni başlayan · Eğlence | 24,2 | 25 | 4 – 14 – 31 – 43 | 15,8 | 8,4 | 219 | 205 | 27 |
| Ortalama · Klasik | 51,8 | 43 | 14 – 26 – 69 – 109 | 33,5 | 18,3 | 414 | 343 | 44 |
| Ortalama · Eğlence | 125,9 | 117 | 51 – 79 – 163 – 210 | 80,0 | 46,0 | 976 | 902 | 91 |
| Deneyimli · Klasik | 202,7 | 148 | 48 – 89 – 292 – 402 | 131,8 | 71,0 | 1.471 | 1.090 | 142 |
| Deneyimli · Eğlence | 565,8 | 485 | 154 – 309 – 741 – 1.027 | 365,2 | 200,7 | 4.060 | 3.524 | 376 |

Oyun başına hat temizleme sayısı (ortalama): 1 hat / 2 hat / 3+ hat.

| Profil · mod | 1 hat | 2 hat | 3+ hat |
|---|---|---|---|
| Yeni başlayan · Klasik | 1,1 | 0,1 | 0,0 |
| Yeni başlayan · Eğlence | 4,7 | 1,0 | 0,1 |
| Ortalama · Klasik | 14,3 | 0,9 | 0,0 |
| Ortalama · Eğlence | 32,3 | 2,7 | 0,2 |
| Deneyimli · Klasik | 55,5 | 3,9 | 0,1 |
| Deneyimli · Eğlence | 151,1 | 11,5 | 0,6 |

## 2. Yıldız dağılımı (oyunların yüzdesi)

| Profil · mod | 0 | 1–9 | 10–24 | 25–49 | 50–99 | 100–199 | 200–499 | 500+ |
|---|---|---|---|---|---|---|---|---|
| Yeni başlayan · Klasik | %39,4 | %42,9 | %16,0 | %1,7 | %0,0 | %0,0 | %0,0 | %0,0 |
| Yeni başlayan · Eğlence | %1,0 | %10,9 | %37,5 | %44,9 | %5,7 | %0,0 | %0,0 | %0,0 |
| Ortalama · Klasik | %0,2 | %3,2 | %19,6 | %36,6 | %28,8 | %11,4 | %0,2 | %0,0 |
| Ortalama · Eğlence | %0,0 | %0,0 | %1,4 | %8,2 | %27,2 | %51,2 | %12,0 | %0,0 |
| Deneyimli · Klasik | %0,0 | %0,0 | %1,0 | %11,0 | %18,0 | %31,0 | %34,0 | %5,0 |
| Deneyimli · Eğlence | %0,0 | %0,0 | %0,0 | %0,0 | %3,0 | %12,0 | %36,0 | %49,0 |

## 3. Bir joker için gereken tahmini oyun sayısı

Fiyat ÷ oyun başına yıldız. Ortalamaya ve medyana göre ayrı verildi (dağılım sağa çarpık olduğu için ortalama daha iyimser).

| Profil · mod | Çekiç (25) ort. / medyan | Yenile (40) ort. / medyan | Döndür (20) ort. / medyan |
|---|---|---|---|
| Yeni başlayan · Klasik | 6,3 / 12,5 | 10,0 / 20,0 | 5,0 / 10,0 |
| Yeni başlayan · Eğlence | 1,0 / 1,0 | 1,7 / 1,6 | 0,8 / 0,8 |
| Ortalama · Klasik | 0,5 / 0,6 | 0,8 / 0,9 | 0,4 / 0,5 |
| Ortalama · Eğlence | 0,2 / 0,2 | 0,3 / 0,3 | 0,2 / 0,2 |
| Deneyimli · Klasik | 0,1 / 0,2 | 0,2 / 0,3 | 0,1 / 0,1 |
| Deneyimli · Eğlence | 0,0 / 0,1 | 0,1 / 0,1 | 0,0 / 0,0 |

## 4. Ücretsiz jokerlerin etkisi (Eğlence ÷ Klasik, aynı tohumlar)

| Profil | Ort. yıldız Klasik → Eğlence | Oran | Ort. skor oranı | Kullanılan ücretsiz hak / oyun |
|---|---|---|---|---|
| Yeni başlayan | 4,0 → 24,2 | ×6,07 | ×3,16 | 3,5 |
| Ortalama | 51,8 → 125,9 | ×2,43 | ×2,36 | 3,5 |
| Deneyimli | 202,7 → 565,8 | ×2,79 | ×2,76 | 3,0 |

## 5. Satın alınmış jokerin Eğlence skoruna ve yıldıza etkisi

Aynı tohumlarla, ücretsiz 1/1/2 hakka EK olarak satın alınmış joker getirilen oyunlar. **Geri ödeme** = ek kazanılan yıldız ÷ jokerin fiyatı; 1’in üzerindeyse joker kendi parasını çıkarıyor demektir (enflasyon riski).

| Profil | Envanter | Fiyat | Kullanılma oranı | Ort. skor farkı | Medyan skor farkı | Ort. yıldız farkı | Geri ödeme |
|---|---|---|---|---|---|---|---|
| Yeni başlayan | +1 Çekiç | 25 | %88,1 | +51 | +51 | +6,9 | 0,28 |
| Yeni başlayan | +1 Yenile | 40 | %100,0 | +51 | +52 | +7,0 | 0,18 |
| Yeni başlayan | +1 Döndür | 20 | %41,5 | +18 | +19 | +2,4 | 0,12 |
| Yeni başlayan | +1 / +1 / +1 | 85 | %100,0 | +131 | +131 | +17,7 | 0,21 |
| Ortalama | +1 Çekiç | 25 | %90,0 | +152 | +184 | +19,8 | 0,79 |
| Ortalama | +1 Yenile | 40 | %100,0 | +173 | +194 | +22,3 | 0,56 |
| Ortalama | +1 Döndür | 20 | %51,4 | +66 | +65 | +8,4 | 0,42 |
| Ortalama | +1 / +1 / +1 | 85 | %100,0 | +441 | +458 | +54,8 | 0,64 |
| Deneyimli | +1 Çekiç | 25 | %76,0 | +725 | +1.102 | +101,2 | 4,05 |
| Deneyimli | +1 Yenile | 40 | %100,0 | +1.074 | +1.148 | +151,1 | 3,78 |
| Deneyimli | +1 Döndür | 20 | %20,0 | +147 | +30 | +20,9 | 1,04 |
| Deneyimli | +1 / +1 / +1 | 85 | %100,0 | +2.217 | +2.099 | +310,5 | 3,65 |

## 6. Yıldız birikimi ve enflasyon (kariyer)

Aynı oyuncu art arda Eğlence oynar. **biriktir:** hiç satın almaz. **harca:** her oyundan sonra her jokerden 2 adede tamamlar (önce Yenile, sonra Çekiç, sonra Döndür) ve hepsini sonraki oyuna getirir.

| Profil · politika | Kazanılan / oyun | Harcanan / oyun | Son bakiye ort. (medyan) | Alınan Ç / Y / D (kariyer başına) | Kullanılan satın alınmış / oyun | Ort. skor | İlk yarı → ikinci yarı yıldız / oyun |
|---|---|---|---|---|---|---|---|
| Yeni başlayan · biriktir | 23,8 | 0,0 | 2.379 (2.352) | 0,0 / 0,0 / 0,0 | 0,0 | 216 | 24,3 → 23,3 |
| Yeni başlayan · harca | 30,4 | 30,3 | 9 (9) | 41,6 / 43,7 / 12,2 | 1,0 | 264 | 30,9 → 29,9 |
| Ortalama · biriktir | 118,2 | 0,0 | 11.818 (11.624) | 0,0 / 0,0 / 0,0 | 0,0 | 920 | 116,8 → 119,5 |
| Ortalama · harca | 227,0 | 161,3 | 6.572 (6.470) | 194,6 / 199,5 / 164,3 | 5,5 | 1.850 | 222,2 → 231,8 |
| Deneyimli · biriktir | 490,5 | 0,0 | 19.620 (19.620) | 0,0 / 0,0 / 0,0 | 0,0 | 3.513 | 515,6 → 465,4 |
| Deneyimli · harca | 1.029,8 | 150,0 | 35.193 (35.193) | 76,0 / 80,0 / 45,0 | 4,9 | 7.351 | 1.093,7 → 966,0 |

Ortalama bakiye eğrisi (her 10 oyunda bir):

- Yeni başlayan · biriktir: 10. oyun 238 · 20. oyun 480 · 30. oyun 719 · 40. oyun 965 · 50. oyun 1.215 · 60. oyun 1.460 · 70. oyun 1.688 · 80. oyun 1.912 · 90. oyun 2.135 · 100. oyun 2.379
- Yeni başlayan · harca: 10. oyun 9 · 20. oyun 7 · 30. oyun 9 · 40. oyun 8 · 50. oyun 6 · 60. oyun 5 · 70. oyun 8 · 80. oyun 6 · 90. oyun 7 · 100. oyun 9
- Ortalama · biriktir: 10. oyun 1.165 · 20. oyun 2.378 · 30. oyun 3.535 · 40. oyun 4.675 · 50. oyun 5.842 · 60. oyun 7.101 · 70. oyun 8.315 · 80. oyun 9.473 · 90. oyun 10.607 · 100. oyun 11.818
- Ortalama · harca: 10. oyun 472 · 20. oyun 1.126 · 30. oyun 1.758 · 40. oyun 2.349 · 50. oyun 3.054 · 60. oyun 3.778 · 70. oyun 4.485 · 80. oyun 5.205 · 90. oyun 5.948 · 100. oyun 6.572
- Deneyimli · biriktir: 10. oyun 5.155 · 20. oyun 10.312 · 30. oyun 15.021 · 40. oyun 19.620
- Deneyimli · harca: 10. oyun 9.217 · 20. oyun 18.819 · 30. oyun 27.274 · 40. oyun 35.193

Yorum ve öneriler: docs/asama-7.1-ekonomi.md.

Hamle sınırına ulaşan temel ölçüm oyunu: 0. Süre: Yeni başlayan 7 sn, Ortalama 445 sn, Deneyimli 1726 sn.

