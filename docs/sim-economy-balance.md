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
| E · dondurma (öneri adayı) | 23,8 ± 0,6 | 22,5 | %0 | 4,0 | 2,0 | %0 | 0,0% / 0,0% | 1,11 / 1,78 / 0,89 |
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
| E · dondurma (öneri adayı) | -0,13 ± 0,01 | -0,00 ± 0,00 | -0,09 ± 0,01 | -0,05 ± 0,00 |
| E · dondurma + tavan 200 | -0,13 ± 0,01 | -0,00 ± 0,00 | -0,09 ± 0,01 | -0,05 ± 0,00 |
| E · dondurma + yumuşak tavan 200 (üstü %25) | -0,13 ± 0,01 | -0,00 ± 0,00 | -0,09 ± 0,01 | -0,05 ± 0,00 |

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
| E · dondurma (öneri adayı) | 252 / 969 / 2.380 | 7 / 9 / 8 | 21,9 / 21,8 | 0,8 | %0 | 216 → 255 |
| E · dondurma + tavan 200 | 252 / 969 / 2.380 | 7 / 9 / 8 | 21,9 / 21,8 | 0,8 | %0 | 216 → 255 |
| E · dondurma + yumuşak tavan 200 (üstü %25) | 252 / 969 / 2.380 | 7 / 9 / 8 | 21,9 / 21,8 | 0,8 | %0 | 216 → 255 |

Yorum ve öneri: docs/asama-7.1-dengeleme.md.

Süre (en uzun parça): Yeni başlayan 9 sn / 1 parça.
