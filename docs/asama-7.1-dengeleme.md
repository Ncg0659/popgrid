# Aşama 7.1 ek — Ekonomi dengeleme: karşılaştırma, öneri ve risk raporu

Ham tablolar: `docs/sim-economy-balance.md` (araç: `scripts/simulate-economy-balance.ts`, kurallar: `scripts/economy-policy.ts`).
**Onaylı değerler ve `src/economy/` kodu değişmedi.** Senaryolar yalnızca simülasyonda hesaplandı.

> Bot simülasyonudur, gerçek kullanıcı davranışı değildir. "Yeni başlayan" rastgele oynayan bottur (gerçek yeni oyuncu muhtemelen daha iyi oynar),
> "ortalama" tek hamle ileriye bakar, "deneyimli" planlar. Botlar jokeri yalnızca sıkışınca kullanır.

## Deneyimli botun örneklem sınırı
Planlayıcı bot hamle başına yaklaşık 9 ms harcıyor. Bu yüzden deneyimli profilde:
- 200 temel oyun (Klasik + Eğlence),
- satın alma deneyi başına 100 oyun,
- yalnızca 2 kariyer (2 × 100 oyun)

çalıştırıldı. Bu, 7.1 raporundaki örneklemin iki katı. Eğlence ortalamasının %95 aralığı ±44 yıldız (ortalama 540). Geri ödeme oranlarının aralıkları tablolarda var. Kariyer bakiyeleri yalnızca 2 dizinin ortalaması; **eğilim olarak okunmalı, kesin değer olarak değil.**

## Özet karşılaştırma (Eğlence Modu)
Geri ödeme = satın alınmış jokerin kazandırdığı ek yıldız ÷ fiyatı. 1 üstü: joker kendi parasını çıkarıyor (enflasyon döngüsü). 0 altı: joker almak yıldız kaybettiriyor (tuzak).
Satın almayan oyuncuya etki = jokersiz Eğlence oyunlarında A'ya göre yıldız değişimi.

| Senaryo | Geri ödeme: yeni / ortalama / deneyimli (Ç · Y · üçü) | Satın almayana etki: yeni / ortalama / deneyimli | Tavana ulaşan Eğlence oyunu: ortalama / deneyimli | Deneyimli "harca" kazanç / harcama (oyun başı) |
|---|---|---|---|---|
| A · mevcut | 0,28·0,18·0,21 / 0,81·0,59·0,69 / **4,45·3,48·3,88** | 0 / 0 / 0 | – | 1.072 / 151 |
| B · satın alınmışta oyun sonu yok | −0,12·−0,09·0,03 / **−1,18·−0,78**·−0,11 / **−3,94·−2,78**·0,14 | 0 / 0 / 0 | – | 693 / 151 |
| C · tavan 150 | aynı / 0,45·0,33·0,31 / 0,03·0,10·0,05 | 0 / −13,4% / −72,9% | %29,5 / %92 | 150 / 149 |
| C · tavan 200 | aynı / 0,67·0,48·0,49 / 0,11·0,21·0,10 | 0 / −5,6% / −64,8% | %11,7 / %84 | 199 / 151 |
| C · tavan 250 | aynı / 0,76·0,53·0,59 / 0,22·0,33·0,17 | 0 / −2,3% / −57,2% | %5,3 / %80,5 | 248 / 151 |
| **C · tavan 300** | aynı / 0,79·0,56·0,64 / 0,39·0,47·0,26 | 0 / **−0,7%** / −49,9% | %2,1 / %76,5 | 297 / 151 |
| C · yumuşak tavan 300 (üstü %25) | aynı / 0,80·0,56·0,66 / **1,40·1,22·1,16** | 0 / −0,5% / −37,5% | %2,1 / %76,5 | 490 / 151 |
| D · B + tavan 200 | B ile aynı / −0,97·−0,65·−0,07 / −0,07·0,06·0,06 | 0 / −5,6% / −64,8% | %11,7 / %84 | 198 / 151 |
| D · B + tavan 150 / 250 / 300 | ortalamada tek joker deneylerinde −0,47 ile −1,17 arası (tuzak) | C ile aynı | C ile aynı | 149 / 246 / 292 |
| E · dondurma | −0,13·0,00·−0,05 / −0,84·−0,14·−0,30 / **−2,90**·0,00·−0,92 | 0 / 0 / 0 | – | 464 / 151 |
| E · dondurma + tavan 200 | aynı / −0,70·−0,11·−0,26 / −0,25·0,00·−0,08 | 0 / −5,6% / −64,8% | %11,7 / %84 | 183 / 151 |

"aynı": yeni başlayanın 2.000 Eğlence oyununun hiçbiri 150 yıldıza ulaşmadı; değerler A ile aynı.

### Bakiye eğilimi (10 / 40 / 100 oyun sonunda ortalama bakiye)
| Senaryo | Ortalama · biriktir | Ortalama · harca | Deneyimli · biriktir | Deneyimli · harca |
|---|---|---|---|---|
| A | 1.310 / 5.050 / 12.615 | 778 / 3.398 / 8.709 | 4.709 / 23.735 / 53.993 | 7.939 / 38.935 / **92.062** |
| B | aynı (A) | 109 / 208 / 242 | aynı (A) | 4.869 / 23.270 / 54.222 |
| C 200 | 1.197 / 4.772 / 11.906 | 195 / 892 / 2.245 | 1.954 / 7.829 / 18.983 | 493 / 2.108 / 4.809 |
| C 300 | 1.289 / 5.025 / 12.527 | 598 / 2.777 / 6.957 | 2.797 / 11.356 / 27.034 | 1.493 / 6.108 / 14.599 |
| D 200 | C 200 ile aynı | 36 / 72 / 28 | C 200 ile aynı | 493 / 2.108 / 4.694 |
| E | aynı (A) | 50 / 31 / 21 | aynı (A) | 2.732 / 14.686 / 31.348 |

Yeni başlayan bütün senaryolarda aynı: biriktirirse 252 / 969 / 2.380. Harcarsa bakiyesi 6–9'da kalıyor, çünkü kazandığı her yıldızı jokere veriyor.

### Bir joker için gereken oyun (Eğlence, medyana göre: Çekiç / Yenile / Döndür)
| Profil | A | C 300 | C 200 |
|---|---|---|---|
| Yeni başlayan | 1,11 / 1,78 / 0,89 | aynı | aynı |
| Ortalama | 0,22 / 0,35 / 0,18 | aynı | aynı |
| Deneyimli | 0,05 / 0,08 / 0,04 | 0,08 / 0,13 / 0,07 | 0,13 / 0,20 / 0,10 |

### Skora etki
Senaryolar oyunun kurallarını değiştirmez; skor yalnızca alınabilen joker sayısı değişirse değişir.
- Deneyimli: bütün senaryolarda "harca" skoru 7.676–7.758 (biriktir 3.879). Bakiye hiçbir senaryoda kısıtlayıcı olmadı.
- Ortalama: A 1.903 → C 300 1.903, C 200 1.902, C 150 1.786, D 200 1.755, E 1.555.
  Tavan 150, D ve E, ortalama oyuncunun alabildiği joker sayısını azaltıyor.

## Bulgular
1. **Yalnız B (oyun sonu yıldızı yok) döngüyü kırmıyor, tuzak kuruyor.**
   - Deneyimli oyuncunun bakiyesi yine sınırsız büyüyor (100 oyunda ~54.000).
   - Ortalama ve deneyimli oyuncu için joker almak yıldız kaybettiriyor: Çekiç ortalamada −1,18, deneyimlide −3,94.
   - Oyuncu "joker aldım, ödülüm gitti" hisseder.
2. **D (B + tavan) de tuzak kuruyor.**
   - Ortalama oyuncuda tek joker deneylerinde geri ödeme −0,47 ile −1,17 arasında.
   - Döngüyü kesen şey tavanın kendisi; B kısmı yalnızca cezayı ekliyor.
3. **E (dondurma) satın almayanı hiç etkilemiyor ama tuzak kuruyor.**
   - Çekiç'te deneyimli −2,90, ortalama −0,84.
   - Neden: satın alınmış ilk joker kullanıldığı anda hesap kapanınca, o oyunda ücretsiz jokerlerle gelecek yıldızlar da kayboluyor.
   - Genel sonuç: **satın alma anına bağlı her kural bir sıçrama yaratıyor; sıçrama da ceza demek.**
4. **Herkese aynı uygulanan sert tavan (C) döngüyü kırıyor ve tuzak kurmuyor.**
   - Her profilde ve her tavanda geri ödeme 0 ile 1 arasında. Deneyimlide en yüksek üst sınır C 300'de: Yenile 0,47 + 0,24 = 0,71.
   - Bedeli: deneyimli, satın almadan da Eğlence yıldızının yarısını kaybediyor (C 300'de −%50).
   - Bu kaçınılmaz: döngüyü besleyen şey zaten deneyimlinin uzun oyunları.
5. **Yumuşak tavan (300 üstü %25) döngüyü geri getiriyor.**
   - Deneyimlide geri ödeme 1,16–1,40; "harca" bakiyesi 100 oyunda ~34.000 (sert 300'de ~14.600).
   - Önerilmez.
6. **Klasik'te döngü yok** (joker yok).
   - Tavan Klasik'e de uygulanırsa deneyimli Klasik yıldızı C 300'de −%15, C 200'de −%30 düşüyor.
   - Bunun hiçbir dengeleme faydası yok.
7. **Bakiye her senaryoda doğrusal büyüyor.**
   - Ancak C ile, harcamak artık daha çok kazandırmıyor: deneyimli "harca" bakiyesi 92.000 yerine 14.600.
   - Biriktiren oyuncunun bakiyesi her durumda büyür. Joker dışında harcama yeri olmadıkça bu engellenemez; bu bir ürün kararı.

## Önerim: C · sert tavan 300, yalnızca Eğlence Modu'nda
**Kural:** Eğlence Modu'nda bir oyunda kazanılan toplam yıldız (hat + oyun sonu) en fazla 300. Klasik'te tavan yok. Ödüller ve fiyatlar aynı kalır.

**Gerekçe:**
- Döngüyü kırıyor: deneyimlide geri ödeme 0,26–0,47 (önceden 3,5–4,5).
- Tuzak yok: hiçbir profilde negatif geri ödeme yok. Joker almak yıldız kaybettirmiyor, sadece kendini finanse etmiyor.
- Satın almayan yeni başlayan hiç etkilenmiyor; ortalama oyuncu %0,7 etkileniyor (Eğlence oyunlarının %2'si tavana ulaşıyor).
- Klasik hiç etkilenmiyor.
- Açıklaması tek cümle: "Bir Eğlence oyunundan en fazla 300 yıldız kazanılır."

**Bedeli (açıkça):**
- Deneyimli oyuncunun Eğlence oyunlarının yaklaşık %77'si tavana ulaşıyor; satın almasa da Eğlence yıldızı yarıya iniyor.
- Yine de oyun başına ~270 yıldız ve joker başına 0,1 oyun: mağazayı rahatça kullanıyor.

**Alternatif:** daha sıkı istenirse C 250 (ortalama oyuncuya −%2,3, deneyimlide geri ödeme ≤ 0,33).
C 200 ve altı ortalama oyuncuyu belirgin etkiliyor (−%5,6 ve üstü); önermiyorum.

**Uygulama notu (7.2, onaydan sonra):**
- Tavan defterde adım adım uygulanmalı: hamle ödülü kalan paya kadar, oyun sonu ödülü kalan paya kadar. Kazanılmış yıldız asla geri alınmaz.
- Bu davranış prototipte testli (`tests/economyPolicy.test.ts`): toplam = kapalı biçim, ödül hiç negatif değil, sert tavan aşılmıyor, tavan sonrası hamleler 0, oyun sonu tek kez.
- Arayüzde "Bu oyunun yıldız sınırına ulaştın" gibi bir bilgi gerekecek.

## Birlikte çalışan kuralların güvenliği (madde 5)
`tests/economyPolicy.test.ts` (21 test) bütün senaryolar için şunları denetler:
- ödüller hiç negatif değil;
- adım adım toplam, simülasyonun kapalı biçimiyle aynı (300 rastgele akış + 6 gerçek motor oyunu, her senaryo);
- sert tavan aşılmıyor;
- oyun sonu ödülü tek kez; bitmiş oyuna yazılmıyor;
- satın alma yapmayan için B/D/E kuralları hiçbir şeyi değiştirmiyor;
- D'de satın alınmış joker kazanılmış hat yıldızlarını sıfırlamıyor;
- tavandan sonra kazanılan geri alınmıyor;
- yumuşak tavan azalmıyor;
- dondurmada sonraki hatlar 0 veriyor.

Mevcut kayıtlarla uyum: tavan, defterde yeni bir alan gerektirmez; etkin oyunda zaten `lineStars` tutuluyor. Şema sürümü 1 kalabilir. Bu, uygulama anında testle doğrulanmalı.

## Risk incelemesi (madde 6) — bulunan kusurlar
Testler `tests/economy.test.ts` → "risk senaryoları" (13 test). Mevcut davranışı belgeliyor; "BİLİNEN SINIRLAMA" testleri düzeltme onaylanınca bilerek değiştirilecek. **Kod düzeltilmedi** (talimat gereği).

| # | Risk | Bugünkü davranış | Önem | Önerilen çözüm |
|---|---|---|---|---|
| K1 | **İki sekme, iki oyun** | İkinci sekmede yeni oyun açılınca birinci sekmenin oyunu artık yıldız kazanamaz (`wrongGame`), oyun sonu ödülü de verilmez. | Orta (sessiz kayıp) | Birden çok etkin oyun (ör. en fazla 3, kimliğe göre); en eskisi bırakılmış sayılır. |
| K2 | **Aynı satın alınmış joker iki sekmede** | Envanter oyuna getirilirken ayrılmıyor; iki sekme aynı jokeri kullanabiliyor, envanter bir kez düşüyor. | Orta (dürüst oyunda bile) | Oyun başında getirilen jokerleri envanterden **ayırmak (emanet)**; oyun bitince ya da bırakılınca kullanılmayanları geri koymak. |
| K3 | **Hamle numarası atlama** | Atlama sorun değil. Ama yanlışlıkla çok büyük bir numara gelirse o oyunun kalan hamleleri ödül alamaz (oyun sonu ödülü yine verilir). | Düşük (yalnızca arayüz hatasıyla) | 7.2'de numara her zaman motorun `moveCount`'undan verilmeli (testle); istenirse bir sıçramada en fazla +1 kabul edilir. |
| K4 | **Yinelenen oyun kimliği** | Bitmiş oyunun kimliği reddediliyor (doğru). Ama etkin oyunun kimliği yeni oyunda tekrar kullanılırsa aynı oyun sayılıyor; ilk hamleler ödül almıyor. Son 20 oyundan eski kimlik yeniden kabul ediliyor. | Düşük–orta (kimlik tohumdan üretilirse gerçek) | Kimlik her oyunda kripto rastgele olmalı (`crypto.randomUUID`); **tohum kullanılmamalı** (`?seed=` testlerinde aynı tohum tekrarlanır). |
| K5 | **Yarıda bırakılan oyun** | Bildirilmiş kullanım düşülmüş kalıyor (doğru), bırakılan oyun sonradan bitirilemiyor (doğru). Joker kullanıldı ama bildirilmeden sayfa kapandıysa satın alınmış hak düşmüyor (oyuncu lehine). | Düşük | `syncUsage` joker uygulandığı anda, çizimden önce çağrılmalı; K2'deki emanet modeli bunu da kapatır. |
| K6 | **Satın alma sırasında yenileme** | Kusur yok. Tek yazma: ya ikisi birlikte kalıcı ya hiçbiri. Aynı istek kimliği yenilemeden sonra da reddediliyor. Yazma kota yüzünden başarısızsa alım yalnızca bellekte kalıyor ve yenilemede ikisi birlikte geri dönüyor. | – | 7.2'de alım yalnızca `persisted: true` ise "tamam" gösterilmeli. |
| K7 | **İki sekmede kayıt uyuşmazlığı** | Sırayla yapılan işlemler birbirini silmiyor (her işlem kaydı yeniden okuyor; testli). Aynı anda (aynı milisaniye) iki sekmeden yazma için tarayıcı kilidi yok; biri ötekini ezebilir. | Çok düşük | Gerekirse `storage` olayıyla diğer sekmeyi bilgilendirmek ya da Web Locks API (ücretsiz, tarayıcıda). |

Önceden bilinen, değişmeyen sınır: localStorage sunucu güvenliği sağlamaz (bkz. `docs/asama-7.1-ekonomi.md`).

## Test raporu
- Yeni:
  - `tests/economyPolicy.test.ts`: 21 test.
  - `tests/economy.test.ts`: 13 yeni risk testi (dosyada toplam 47).
- Bütün testler yerelde (Node test çalıştırıcısı, vitest uyumlu katman): geçti.
- CI: lint, TypeScript, testler ve build GitHub Actions'ta çalışır.
- Oyun motoru, `src/economy/`, `src/storage/`, arayüz: **değişmedi** (bu ek yalnızca `scripts/`, `tests/`, `docs/` ve `package.json`'a dokundu).

---

## Onaylanan karar ve uygulama (Aşama 7.1 son)
Karar: **yalnızca Eğlence Modu'nda oyun başına en fazla 300 yıldız** (hat + oyun sonu toplamı). Klasik'te tavan yok.
- Ödüller (2 / 5 / 10, oyun sonu ⌊skor/100⌋×5) ve fiyatlar (25 / 40 / 20) değişmedi.
- Satın alınmış joker kullanana ek kesinti ya da dondurma yok.
- Tavan dolunca oyun, skor ve jokerler normal sürüyor; kazanılmış yıldız geri alınmıyor.

Uygulama:
- `src/economy/rules.ts` → `FUN_STAR_CAP = 300`, `starCapFor(mode)`.
- `src/economy/ledger.ts` → hamle ve oyun sonu ödülü kalan pay kadar (`starsLeftThisGame`).

### Simülasyonla tutarlılık
`npm run sim:economy`, artık tavanlı gerçek defterle çalıştırıldı (`docs/sim-economy.md`). Aynı tohumlarda prototip kuralla karşılaştırıldı: Eğlence için `C300`, Klasik için `A`.

| Profil | Klasik ort. / medyan — defter · prototip | Eğlence ort. / medyan — defter · prototip |
|---|---|---|
| Yeni başlayan (1.000 oyun) | 3,985 / 2 · 3,985 / 2 | 24,182 / 25 · 24,182 / 25 |
| Ortalama (500) | 51,750 / 43 · 51,750 / 43 | 125,944 / 117 · 125,944 / 117 |
| Deneyimli (100) | 202,740 / 148 · 202,740 / 148 | 270,390 / 300 · 270,390 / 300 |

Birebir aynı. Ayrıca `tests/economy.test.ts` her derlemede bunu denetliyor ("gerçek oyunlar: defter = simülasyonun onaylı kuralı", 12 tohum × 2 mod, en az bir oyun tavana ulaşıyor).

Tavanlı defterle geri ödeme:
- deneyimli 0,00–0,31 (önceden 1,20–4,45),
- ortalama 0,42–0,79,
- yeni başlayan 0,12–0,28.

Deneyimli için 50 tohumlu bu ölçüm, dengeleme raporundaki 100 tohumlu C300 değerleriyle (0,26–0,47 ± 0,24) güven aralığı içinde uyumlu.

Deneyimli oyuncu her oyun joker alırsa:
- 40 oyunda bakiye 5.903 (tavansız 7.1 ölçümünde ~35.000),
- skor yine ikiye katlanıyor (3.513 → 7.351).

## K1–K7: çözümler
**Seçilen model: tek yazıcı (tek sahip sekme).** Çoklu etkin oyun + rezervasyon yerine seçildi.

Çoklu oyun + rezervasyon modelinin sorunları:
- Kapanmış bir sekmenin oyunu ile açık ama boşta bekleyen sekme ayırt edilemiyor.
- Bu yüzden ayrılmış jokerlerin ne zaman geri verileceği bir zamanlayıcıya bağlanmak zorunda.
- Geri verilen jokeri hâlâ açık olan eski sekme kullanırsa çoğalma riski doğuyor.

Tek yazıcı modelinde aynı anda yalnızca bir sekme ekonomiyi değiştirebildiği için rezervasyona gerek kalmıyor.

| # | Çözüm | Test |
|---|---|---|
| K1 | Kayıtta `owner` (sekme kimliği + 15 sn kira). Yalnızca sahip yazar; öbür sekme okur, işlemleri `otherTab` ile reddedilir. Arayüz (7.2) açıklama gösterir. Sahip kapanırken bırakır (hemen devir). Kira dolarsa (çökme, arka planda dondurma) devralınır. Kullanıcı isterse zorla alınır. Saat geri alınırsa kira boş sayılır. | ikinci sekme yazamaz; birinci sekmenin oyunu ikinci açıldı diye yıldız kaybetmez; bırakma, kira, zorla alma, saat geri alma |
| K2 | Satın alınmış joker yalnızca sahip sekmede ve yalnızca etkin oyunda harcanır. Sahipliğini kaybeden sekmenin isteğinde motor sonucu bile verilmez. | aynı joker iki sekmede harcanamaz; 400 adımlık rastgele iki sekme akışında her adımda `envanter = satın alınan − uygulanan kullanım` |
| K3 | `recordMove`: hamle numarası motorun durumundan alınır. Ham `awardMove` için doğrulama testleri eklendi. | sıra, aynı/eski numara, geçersiz numaralar, atlama, gerçek oyunda her hamle tam bir kez |
| K4 | `newGameId()` kripto rastgele (`g-<uuid>`), tohumdan türetilmez. Bitmiş kimlik reddi ve çift başlatmanın etkisizliği korundu. | 5.000 benzersiz kimlik; aynı tohumla iki oyun, ikincisi de baştan ödül alır |
| K5 | `useJoker`: joker uygulanır ve satın alınmış hakkın düşülmesi **aynı senkron çağrıda** yazılır. Yazılamazsa (kota, başka sahip, yanlış oyun) motor sonucu verilmez, envanter aynen kalır. Bırakılan oyunda kullanılmamış jokerler zaten envanterde. | yenilemeden sonra düşük kalır; yazma hatasında uygulanmaz; yanlış oyun; geçersiz joker; bırakılan oyunda kaybolmaz |
| K6 | Değişmedi: tek yazma; aynı istek kimliği yenilemeden sonra da reddedilir; kota hatasında alım yalnızca bellekte, yenilemede bakiye ve envanter birlikte geri döner. | üç test korundu |
| K7 | Tek yazıcı nedeniyle olağan işlemlerde eşzamanlı yazan yok. Tek yarış penceresi sahiplik alma: Web Locks varsa `claimWithLock` bunu tarayıcı kilidiyle sıraya koyar. | kilitli sıra; kilitsiz çalışma; kilitsiz en kötü durum (sahiplik birinde kalır, öteki yazamaz, veri kaybolmaz) |

### Web Locks (K7)
- **Destek** (caniuse): Chrome 69+, Edge 79+, Firefox 96+, Safari ve iOS Safari 15.4+, Samsung Internet 10.1+.
- **Koşul:** Yalnızca güvenli bağlamda (HTTPS) çalışır. GitHub Pages HTTPS olduğu için sorun yok.
- **Desteklenmeyen tarayıcıda:** Sahiplik kilitsiz alınır. İki sekme aynı milisaniyede almaya çalışırsa son yazan sahip olur; öteki bir sonraki işleminde `otherTab` alır. Henüz yazmadığı için veri kaybı yok (testli).
- **Kilitlenmeyen işlemler:** Ödül, satın alma ve joker kilide alınmadı. Kilit eşzamansızdır (async) ve jokerin uygulanmasıyla kaydın yazılmasını ayırırdı; bu da K5'i bozardı.

### Şema
- Kayıt şeması 1 → 2: `owner` alanı eklendi.
- Şema 1 kayıtları bütün alanlarıyla okunuyor; ilk yazmada şema 2 oluyor (testli).
- Rekor, mod, eğitim, ses ve joker tanıtımı anahtarlarına dokunulmuyor (testli).

## Çözülemeyen / açık riskler
1. **Hile:** localStorage sunucu seviyesinde hile koruması sağlamaz (kabul edildi).
2. **Arka plan:** iOS'ta sahip sekme 15 sn'den uzun arka planda kalırsa başka bir sekme devralabilir. Eski sekme dönünce o oyunda yıldız kazanamaz ve satın alınmış joker harcayamaz; oyun normal sürer. Arayüz bunu açıklamalı (7.2).
3. **Kilitsiz tarayıcılar:** Web Locks olmayan tarayıcıda, kirası dolmuş sahibin bir işlemi ile başka sekmenin sahiplik alması işlemciler arasında aynı mikrosaniyeye denk gelirse kuramsal bir ezme penceresi var. Olasılığı çok düşük.
4. **Kalıcılık kaybı:** Kayıt yazılamıyorsa (kota) o oturumun yıldızları ve alımları yenilemede geri döner (tutarlı geri alma). Satın alınmış joker bu durumda kullanılamaz. Arayüz uyarı göstermeli (7.2).
5. **K3 kalıntısı:** Ham `awardMove`'a yanlış ve çok büyük numara verilirse o oyunun hamle ödülleri kapanır. Arayüz yalnızca `recordMove` kullanmalı (7.2'de testle).
6. **Arayüz bağlantısı yok:**
   - `useGame` hâlâ eski `popgrid:v1:inventory` anahtarını kullanıyor.
   - 7.2'de tek kaynağa (ekonomi kaydı) geçilmeli. Bugün kimse joker satın alamadığı için eski anahtar herkes için 0.
   - Sahiplik alma, kira yenileme (~5 sn) ve sayfa kapanırken bırakma arayüzde yapılacak.
7. **Cihazlar arası eşitleme yok:** Bakiye cihaza ve tarayıcıya bağlı.
8. **Deneyimli örneklem sınırı:** Deneyimli botun örneklemi sınırlı; sonuçlar eğilimdir.
