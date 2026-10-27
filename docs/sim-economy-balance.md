# POPGRID — Ekonomi dengeleme karşılaştırması (Aşama 7.1 ek)

> **Bot simülasyonudur, gerçek kullanıcı davranışı değildir.** Tablolar senaryoların birbirine göre etkisini gösterir.
> Onaylı değerler (hat 2/5/10, oyun sonu ⌊skor/100⌋×5, fiyatlar 25/40/20) DEĞİŞMEDİ; senaryolar yalnızca simülasyonda hesaplandı.

## Yöntem

- Her profilde bütün senaryolar **aynı oyunlar** üzerinde hesaplanır: oyunlar bir kez oynanır, her senaryonun yıldız kuralı aynı ham veriye uygulanır (`scripts/economy-policy.ts` → `gameStars`).
- Tavan, oyunun **hat + oyun sonu toplamına** uygulanır (oyun içinde adım adım uygulaması `policyMove` / `policyEnd`; kapalı biçimle eşitliği testli).
- Temel ölçüm: tohum 1 … (kariyer × 100), Klasik ve Eğlence, satın alınmış joker yok. Satın alma deneyi: aynı tohumlar 1 … N, ücretsiz 1/1/2 hakka ek envanter; geri ödeme **eşleştirilmiş** farklardan (aynı tohum, envanterli − envantersiz) hesaplanır, ± %95 güven aralığı.
- Kariyer: kariyer c, tohum c×100+1 … c×100+100 oyunlarını sırayla oynar. **Biriktir:** hiç almaz (temel Eğlence oyunlarının aynısı). **Harca:** her oyundan sonra her jokerden 2 adede tamamlar (Yenile → Çekiç → Döndür, bakiye yettiği kadar) ve hepsini sonraki oyuna getirir.
- Botlar jokeri yalnızca sıkışınca kullanır; ücretsiz hak önce harcanır (motor kuralı). Belirlenimli: aynı komut aynı tabloyu verir.
- Senaryolar: **A** mevcut · **B** satın alınmış joker kullanılan oyunda oyun sonu yıldızı yok · **C** oyun başı tavan · **D** B + tavan · **E** dondurma: satın alınmış ilk joker kullanıldığı anda o oyunun yıldız hesabı kapanır (o ana kadarki hat yıldızı + o anki skora göre oyun sonu; sonrası yıldız vermez) · **E200y** E + yumuşak tavan (200 üstü %25).

| Profil | Bot | Temel oyun (Klasik + Eğlence) | Deney oyunu (her tür) | Kariyer (harca, her senaryo) |
|---|---|---|---|---|
| Yeni başlayan | rastgele bot | 2.000 + 2.000 | 2.000 | 20 × 100 |
| Ortalama | greedy bot | 1.000 + 1.000 | 500 | 10 × 100 |

## Yeni başlayan (rastgele bot)

### Oyun başına yıldız (satın alınmış joker yok)

| Senaryo | Eğlence ort. ± %95 | Eğlence medyan | Eğlence tavana ulaşan | Klasik ort. | Klasik medyan | Klasik tavana ulaşan | Satın almayan oyuncuya etki (Eğlence / Klasik) | Bir joker için oyun Ç / Y / D (medyan) |
|---|---|---|---|---|---|---|---|---|
| A · mevcut, tavan yok | 23,8 ± 0,6 | 22,5 | %0 | 4,0 | 2,0 | %0 | 0,0% / 0,0% | 1,11 / 1,78 / 0,89 |
| B · satın alınmışta oyun sonu yok | 23,8 ± 0,6 | 22,5 | %0 | 4,0 | 2,0 | %0 | 0,0% / 0,0% | 1,11 / 1,78 / 0,89 |
| C · tavan 150 | 23,8 ± 0,6 | 22,5 | %0 | 4,0 | 2,0 | %0 | 0,0% / 0,0% | 1,11 / 1,78 / 0,89 |
| C · tavan 200 | 23,8 ± 0,6 | 22,5 | %0 | 4,0 | 2,0 | %0 | 0,0% / 0,0% | 1,11 / 1,78 / 0,89 |
| C · tavan 250 | 23,8 ± 0,6 | 22,5 | %0 | 4,0 | 2,0 | %0 | 0,0% / 0,0% | 1,11 / 1,78 / 0,89 |
| C · tavan 300 | 23,8 ± 0,6 | 22,5 | %0 | 4,0 | 2,0 | %0 | 0,0% / 0,0% | 1,11 / 1,78 / 0,89 |
| D · B + tavan 150 | 23,8 ± 0,6 | 22,5 | %0 | 4,0 | 2,0 | %0 | 0,0% / 0,0% | 1,11 / 1,78 / 0,89 |
| D · B + tavan 200 | 23,8 ± 0,6 | 22,5 | %0 | 4,0 | 2,0 | %0 | 0,0% / 0,0% | 1,11 / 1,78 / 0,89 |
| D · B + tavan 250 | 23,8 ± 0,6 | 22,5 | %0 | 4,0 | 2,0 | %0 | 0,0% / 0,0% | 1,11 / 1,78 / 0,89 |
| D · B + tavan 300 | 23,8 ± 0,6 | 22,5 | %0 | 4,0 | 2,0 | %0 | 0,0% / 0,0% | 1,11 / 1,78 / 0,89 |
| E · dondurma | 23,8 ± 0,6 | 22,5 | %0 | 4,0 | 2,0 | %0 | 0,0% / 0,0% | 1,11 / 1,78 / 0,89 |
| E · dondurma + tavan 200 | 23,8 ± 0,6 | 22,5 | %0 | 4,0 | 2,0 | %0 | 0,0% / 0,0% | 1,11 / 1,78 / 0,89 |
| E · dondurma + yumuşak tavan 200 (üstü %25) | 23,8 ± 0,6 | 22,5 | %0 | 4,0 | 2,0 | %0 | 0,0% / 0,0% | 1,11 / 1,78 / 0,89 |

### Joker maliyetini geri kazanma oranı (ek yıldız ÷ fiyat; 1 üstü = joker kendini finanse ediyor)

| Senaryo | +1 Çekiç | +1 Yenile | +1 Döndür | +1/+1/+1 |
|---|---|---|---|---|
| A · mevcut, tavan yok | 0,28 ± 0,02 | 0,18 ± 0,01 | 0,12 ± 0,01 | 0,21 ± 0,01 |
| B · satın alınmışta oyun sonu yok | -0,12 ± 0,02 | -0,09 ± 0,01 | -0,11 ± 0,01 | 0,03 ± 0,01 |
| C · tavan 150 | 0,28 ± 0,02 | 0,18 ± 0,01 | 0,12 ± 0,01 | 0,21 ± 0,01 |
| C · tavan 200 | 0,28 ± 0,02 | 0,18 ± 0,01 | 0,12 ± 0,01 | 0,21 ± 0,01 |
| C · tavan 250 | 0,28 ± 0,02 | 0,18 ± 0,01 | 0,12 ± 0,01 | 0,21 ± 0,01 |
| C · tavan 300 | 0,28 ± 0,02 | 0,18 ± 0,01 | 0,12 ± 0,01 | 0,21 ± 0,01 |
| D · B + tavan 150 | -0,12 ± 0,02 | -0,09 ± 0,01 | -0,11 ± 0,01 | 0,03 ± 0,01 |
| D · B + tavan 200 | -0,12 ± 0,02 | -0,09 ± 0,01 | -0,11 ± 0,01 | 0,03 ± 0,01 |
| D · B + tavan 250 | -0,12 ± 0,02 | -0,09 ± 0,01 | -0,11 ± 0,01 | 0,03 ± 0,01 |
| D · B + tavan 300 | -0,12 ± 0,02 | -0,09 ± 0,01 | -0,11 ± 0,01 | 0,03 ± 0,01 |
| E · dondurma | -0,13 ± 0,01 | 0,00 ± 0,00 | -0,09 ± 0,01 | -0,05 ± 0,00 |
| E · dondurma + tavan 200 | -0,13 ± 0,01 | 0,00 ± 0,00 | -0,09 ± 0,01 | -0,05 ± 0,00 |
| E · dondurma + yumuşak tavan 200 (üstü %25) | -0,13 ± 0,01 | 0,00 ± 0,00 | -0,09 ± 0,01 | -0,05 ± 0,00 |

### Bakiye eğilimi ve kariyer

| Senaryo | Biriktir bakiye 10 / 40 / 100 oyun | Harca bakiye 10 / 40 / 100 oyun | Harca: kazanılan / harcanan yıldız (oyun başı) | Harca: kullanılan satın alınmış / oyun | Harca: tavana ulaşan | Ort. skor biriktir → harca |
|---|---|---|---|---|---|---|
| A · mevcut, tavan yok | 252 / 969 / 2.380 | 8 / 8 / 8 | 30,7 / 30,7 | 1,0 | %0 | 216 → 267 |
| B · satın alınmışta oyun sonu yok | 252 / 969 / 2.380 | 7 / 7 / 6 | 21,8 / 21,7 | 0,8 | %0 | 216 → 257 |
| C · tavan 150 | 252 / 969 / 2.380 | 8 / 8 / 8 | 30,7 / 30,7 | 1,0 | %0 | 216 → 267 |
| C · tavan 200 | 252 / 969 / 2.380 | 8 / 8 / 8 | 30,7 / 30,7 | 1,0 | %0 | 216 → 267 |
| C · tavan 250 | 252 / 969 / 2.380 | 8 / 8 / 8 | 30,7 / 30,7 | 1,0 | %0 | 216 → 267 |
| C · tavan 300 | 252 / 969 / 2.380 | 8 / 8 / 8 | 30,7 / 30,7 | 1,0 | %0 | 216 → 267 |
| D · B + tavan 150 | 252 / 969 / 2.380 | 7 / 7 / 6 | 21,8 / 21,7 | 0,8 | %0 | 216 → 257 |
| D · B + tavan 200 | 252 / 969 / 2.380 | 7 / 7 / 6 | 21,8 / 21,7 | 0,8 | %0 | 216 → 257 |
| D · B + tavan 250 | 252 / 969 / 2.380 | 7 / 7 / 6 | 21,8 / 21,7 | 0,8 | %0 | 216 → 257 |
| D · B + tavan 300 | 252 / 969 / 2.380 | 7 / 7 / 6 | 21,8 / 21,7 | 0,8 | %0 | 216 → 257 |
| E · dondurma | 252 / 969 / 2.380 | 7 / 9 / 8 | 21,9 / 21,8 | 0,8 | %0 | 216 → 255 |
| E · dondurma + tavan 200 | 252 / 969 / 2.380 | 7 / 9 / 8 | 21,9 / 21,8 | 0,8 | %0 | 216 → 255 |
| E · dondurma + yumuşak tavan 200 (üstü %25) | 252 / 969 / 2.380 | 7 / 9 / 8 | 21,9 / 21,8 | 0,8 | %0 | 216 → 255 |

## Ortalama (greedy bot)

### Oyun başına yıldız (satın alınmış joker yok)

| Senaryo | Eğlence ort. ± %95 | Eğlence medyan | Eğlence tavana ulaşan | Klasik ort. | Klasik medyan | Klasik tavana ulaşan | Satın almayan oyuncuya etki (Eğlence / Klasik) | Bir joker için oyun Ç / Y / D (medyan) |
|---|---|---|---|---|---|---|---|---|
| A · mevcut, tavan yok | 126,2 ± 4,2 | 114,0 | %0 | 50,9 | 44,0 | %0 | 0,0% / 0,0% | 0,22 / 0,35 / 0,18 |
| B · satın alınmışta oyun sonu yok | 126,2 ± 4,2 | 114,0 | %0 | 50,9 | 44,0 | %0 | 0,0% / 0,0% | 0,22 / 0,35 / 0,18 |
| C · tavan 150 | 109,2 ± 2,4 | 114,0 | %29,5 | 50,3 | 44,0 | %2,5 | −13,4% / −1,2% | 0,22 / 0,35 / 0,18 |
| C · tavan 200 | 119,1 ± 3,2 | 114,0 | %11,7 | 50,9 | 44,0 | %0,2 | −5,6% / −0,0% | 0,22 / 0,35 / 0,18 |
| C · tavan 250 | 123,3 ± 3,7 | 114,0 | %5,3 | 50,9 | 44,0 | %0 | −2,3% / 0,0% | 0,22 / 0,35 / 0,18 |
| C · tavan 300 | 125,3 ± 3,9 | 114,0 | %2,1 | 50,9 | 44,0 | %0 | −0,7% / 0,0% | 0,22 / 0,35 / 0,18 |
| D · B + tavan 150 | 109,2 ± 2,4 | 114,0 | %29,5 | 50,3 | 44,0 | %2,5 | −13,4% / −1,2% | 0,22 / 0,35 / 0,18 |
| D · B + tavan 200 | 119,1 ± 3,2 | 114,0 | %11,7 | 50,9 | 44,0 | %0,2 | −5,6% / −0,0% | 0,22 / 0,35 / 0,18 |
| D · B + tavan 250 | 123,3 ± 3,7 | 114,0 | %5,3 | 50,9 | 44,0 | %0 | −2,3% / 0,0% | 0,22 / 0,35 / 0,18 |
| D · B + tavan 300 | 125,3 ± 3,9 | 114,0 | %2,1 | 50,9 | 44,0 | %0 | −0,7% / 0,0% | 0,22 / 0,35 / 0,18 |
| E · dondurma | 126,2 ± 4,2 | 114,0 | %0 | 50,9 | 44,0 | %0 | 0,0% / 0,0% | 0,22 / 0,35 / 0,18 |
| E · dondurma + tavan 200 | 119,1 ± 3,2 | 114,0 | %11,7 | 50,9 | 44,0 | %0,2 | −5,6% / −0,0% | 0,22 / 0,35 / 0,18 |
| E · dondurma + yumuşak tavan 200 (üstü %25) | 120,8 ± 3,4 | 114,0 | %11,7 | 50,9 | 44,0 | %0,2 | −4,2% / −0,0% | 0,22 / 0,35 / 0,18 |

### Joker maliyetini geri kazanma oranı (ek yıldız ÷ fiyat; 1 üstü = joker kendini finanse ediyor)

| Senaryo | +1 Çekiç | +1 Yenile | +1 Döndür | +1/+1/+1 |
|---|---|---|---|---|
| A · mevcut, tavan yok | 0,81 ± 0,16 | 0,59 ± 0,08 | 0,44 ± 0,14 | 0,69 ± 0,06 |
| B · satın alınmışta oyun sonu yok | -1,18 ± 0,15 | -0,78 ± 0,08 | -1,03 ± 0,15 | -0,11 ± 0,05 |
| C · tavan 150 | 0,45 ± 0,09 | 0,33 ± 0,05 | 0,23 ± 0,08 | 0,31 ± 0,03 |
| C · tavan 200 | 0,67 ± 0,13 | 0,48 ± 0,07 | 0,33 ± 0,11 | 0,49 ± 0,04 |
| C · tavan 250 | 0,76 ± 0,15 | 0,53 ± 0,08 | 0,39 ± 0,13 | 0,59 ± 0,05 |
| C · tavan 300 | 0,79 ± 0,16 | 0,56 ± 0,08 | 0,42 ± 0,14 | 0,64 ± 0,06 |
| D · B + tavan 150 | -0,68 ± 0,10 | -0,47 ± 0,06 | -0,60 ± 0,10 | -0,02 ± 0,03 |
| D · B + tavan 200 | -0,97 ± 0,12 | -0,65 ± 0,07 | -0,86 ± 0,13 | -0,07 ± 0,04 |
| D · B + tavan 250 | -1,11 ± 0,14 | -0,74 ± 0,08 | -0,98 ± 0,14 | -0,09 ± 0,05 |
| D · B + tavan 300 | -1,17 ± 0,15 | -0,78 ± 0,08 | -1,03 ± 0,15 | -0,11 ± 0,05 |
| E · dondurma | -0,84 ± 0,12 | -0,14 ± 0,04 | -0,59 ± 0,11 | -0,30 ± 0,04 |
| E · dondurma + tavan 200 | -0,70 ± 0,10 | -0,11 ± 0,03 | -0,51 ± 0,10 | -0,26 ± 0,03 |
| E · dondurma + yumuşak tavan 200 (üstü %25) | -0,73 ± 0,10 | -0,12 ± 0,03 | -0,53 ± 0,10 | -0,27 ± 0,03 |

### Bakiye eğilimi ve kariyer

| Senaryo | Biriktir bakiye 10 / 40 / 100 oyun | Harca bakiye 10 / 40 / 100 oyun | Harca: kazanılan / harcanan yıldız (oyun başı) | Harca: kullanılan satın alınmış / oyun | Harca: tavana ulaşan | Ort. skor biriktir → harca |
|---|---|---|---|---|---|---|
| A · mevcut, tavan yok | 1.310 / 5.050 / 12.615 | 778 / 3.398 / 8.709 | 249,5 / 162,4 | 5,6 | %0 | 974 → 1.903 |
| B · satın alınmışta oyun sonu yok | 1.310 / 5.050 / 12.615 | 109 / 208 / 242 | 151,5 / 149,1 | 5,0 | %0 | 974 → 1.834 |
| C · tavan 150 | 1.092 / 4.357 / 10.921 | 11 / 11 / 14 | 144,5 / 144,4 | 4,7 | %82,1 | 974 → 1.786 |
| C · tavan 200 | 1.197 / 4.772 / 11.906 | 195 / 892 / 2.245 | 184,5 / 162,1 | 5,6 | %67,9 | 974 → 1.902 |
| C · tavan 250 | 1.253 / 4.946 / 12.328 | 439 / 2.032 / 5.092 | 213,4 / 162,4 | 5,6 | %46,7 | 974 → 1.903 |
| C · tavan 300 | 1.289 / 5.025 / 12.527 | 598 / 2.777 / 6.957 | 232,0 / 162,4 | 5,6 | %27,2 | 974 → 1.903 |
| D · B + tavan 150 | 1.092 / 4.357 / 10.921 | 8 / 6 / 12 | 119,7 / 119,6 | 3,7 | %36,4 | 974 → 1.652 |
| D · B + tavan 200 | 1.197 / 4.772 / 11.906 | 36 / 72 / 28 | 138,3 / 138,0 | 4,5 | %16,9 | 974 → 1.755 |
| D · B + tavan 250 | 1.253 / 4.946 / 12.328 | 89 / 160 / 157 | 147,7 / 146,1 | 4,9 | %4,5 | 974 → 1.808 |
| D · B + tavan 300 | 1.289 / 5.025 / 12.527 | 105 / 200 / 221 | 151,1 / 148,9 | 5,0 | %1,7 | 974 → 1.834 |
| E · dondurma | 1.310 / 5.050 / 12.615 | 50 / 31 / 21 | 107,9 / 107,7 | 3,4 | %0 | 974 → 1.555 |
| E · dondurma + tavan 200 | 1.197 / 4.772 / 11.906 | 22 / 12 / 14 | 104,5 / 104,4 | 3,2 | %6,5 | 974 → 1.535 |
| E · dondurma + yumuşak tavan 200 (üstü %25) | 1.225 / 4.840 / 12.079 | 23 / 19 / 13 | 105,7 / 105,6 | 3,3 | %6,8 | 974 → 1.542 |

Yorum ve öneri: docs/asama-7.1-dengeleme.md.

Süre (en uzun parça): Yeni başlayan 9 sn / 1 parça, Ortalama 989 sn / 1 parça.
