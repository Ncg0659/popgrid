# Aşama 7.1 — Ekonomi motoru: rapor ve öneriler

Ham tablolar: `docs/sim-economy.md` (yeniden üretmek için `npm run sim:economy`). Bu dosya yorumdur.

> **Bu sonuçlar bot simülasyonudur, gerçek kullanıcı davranışı değildir.** "Yeni başlayan" rastgele oynayan bir bottur
> (gerçek bir yeni oyuncu muhtemelen daha iyi oynar); "ortalama" tek hamle ileriye bakan, "deneyimli" ise planlayan bottur.
> Botlar jokeri yalnızca sıkışınca kullanır. Deneyimli profilin örneklemi küçüktür (100 temel oyun, 50 deney oyunu,
> 1 × 40 oyunluk kariyer); bu satırlar büyüklük sırası olarak okunmalıdır.

## Ne yapıldı
- `src/economy/` (saf): yıldız kuralları, değişmez ödül defteri, sürümlü kayıt biçimi. Oyun motoru, üretici ve golden parmak izi değişmedi.
- `src/storage/economy.ts`: tek anahtar (`popgrid:v1:economy`), işlem başına tek yazma. Bozuk kayıt yedeklenir, yeni sürüm kaydı korunur.
- Arayüze bağlı değil: canlı oyun henüz yıldız kazandırmaz (Aşama 7.2).

## Güvenlik sınırı (açıkça)
- Bakiye ve envanter oyuncunun tarayıcısında (localStorage) durur. Geliştirici araçlarıyla değiştirilebilir, silinebilir; tarayıcı verisi temizlenince kaybolur; cihazlar arasında taşınmaz.
- Bu kayıt **hileye karşı koruma sağlamaz**. Yalnızca dürüst oyunda çift ödül, yarım satın alma ve bozuk kayıtla çökme gibi hataları önler.
- Bu yüzden ileride çevrimiçi liderlik tablosu yapılırsa, buradaki skorlar sunucu doğrulaması olmadan güvenilir sayılmamalıdır.
- İki sekme aynı anda açıksa: her işlem kaydı yeniden okuduğu için sırayla yapılan işlemler birbirini silmez (testli). Aynı milisaniyedeki eşzamanlı yazmalar için tarayıcı kilidi yok; gerçekte olasılığı çok düşük.
- Oyun devam kaydı yok: sayfa ya da sekme oyun ortasında kapanırsa o ana kadarki hat yıldızları kalır, oyun sonu ödülü verilmez.

## Simülasyon bulguları

**1. Oyun başına yıldız (ortalama / medyan)**
- Yeni başlayan: Klasik 4,0 / 2 · Eğlence 24,2 / 25
- Ortalama: Klasik 51,8 / 43 · Eğlence 126,2 / 117
- Deneyimli: Klasik 202,7 / 148 · Eğlence 565,8 / 485
- Yıldızların yaklaşık üçte ikisi hat temizlemeden, üçte biri oyun sonu ödülünden geliyor. Tek hatlık temizlemeler baskın; 3+ hat çok nadir.

**2. Bir joker için gereken oyun (Eğlence, medyana göre)**
- Yeni başlayan: Çekiç 1,0 · Yenile 1,6 · Döndür 0,8 oyun (Klasik'te 10–20 oyun).
- Ortalama: her joker bir oyundan kısa sürede (0,2–0,4 oyun).
- Deneyimli: tek bir oyun 5–20 joker parası kazandırıyor.

**3. Ücretsiz jokerlerin etkisi:** aynı tohumlarda Eğlence, Klasik'e göre ×2,4 (ortalama) ile ×6 (yeni başlayan) kat yıldız veriyor; çünkü oyunu uzatıyorlar ve yıldız oyun uzunluğuyla artıyor.

**4. Satın alınmış jokerin skora etkisi (ücretsiz haklara ek, aynı tohumlar)**
- +1 Yenile ortalama skoru yeni başlayanda +51, ortalamada +173, deneyimlide +1.074 (yaklaşık %26) artırıyor.
- +1/+1/+1 (85 yıldız) ortalama oyuncuda +441 (%45), deneyimlide +2.217 (%55).
- "Harca" kariyerinde ortalama skor ikiye katlandı (ortalama: 920 → 1.850, deneyimli: 3.513 → 7.351).
- Sonuç: satın alınmış joker Eğlence skorunu belirgin biçimde değiştiriyor. Ayrı işaretleme (`usedPurchased`) ve ayrı rekor (`funBests.withPurchased`) gerekli; Klasik ile hiçbir şekilde karıştırılmamalı.

**5. Enflasyon riski — en önemli bulgu**
- **Geri ödeme** (jokerin kazandırdığı ek yıldız ÷ fiyatı):
  - yeni başlayan 0,1–0,3, ortalama 0,4–0,8 → joker kendi parasını çıkarmıyor;
  - deneyimli: Çekiç 4,05, Yenile 3,78, Döndür 1,04, üçü birden 3,65 → **joker kendi fiyatının ~4 katını geri kazandırıyor.**
- Deneyimli "harca" oyuncusu oyun başına 1.030 yıldız kazanıp 150 harcadı; 40 oyunda bakiye 35.193'e çıktı (hiç harcamayan: 19.620).
- Ortalama oyuncu bile her oyun 2'şer joker alıp 242 kazanırken 161 harcıyor; 100 oyunda 8.101 yıldız birikiyor.
- Neden: yıldız, oyun uzunluğuyla doğrusal artıyor; joker oyunu uzatıyor; uzayan oyun daha çok yıldız veriyor. İyi oyuncu için bu kendi kendini besleyen bir döngü. Jokerden başka harcama yeri olmadığı için bakiye sınırsız büyüyor ve mağaza 20–40 oyundan sonra anlamsızlaşıyor.

## Öneriler (UYGULANMADI — onayın gerekir)
Değerler değiştirilmedi. Aşağıdakiler, istersen önce simülasyonla denenebilecek seçeneklerdir:

1. **Satın alınmış joker kullanılan oyunda oyun sonu ödülünü kaldırmak ya da yarıya indirmek.** Döngüyü doğrudan zayıflatır, kuralı açıklaması kolaydır. Tek başına yetmeyebilir: genel oranla, ek yıldızın büyük kısmının (yaklaşık üçte ikisi) hat yıldızından gelmesi beklenir; bu ayrıca ölçülmedi.
2. **Oyun başına yıldız tavanı** (ör. 150–200). Eğlence'de yeni başlayan hiç etkilenmez (P90 = 43), ortalama oyuncunun oyunlarının yaklaşık %10'u etkilenir (P90 = 210). Deneyimli oyuncunun birikimini sınırlar; geri ödemeyi 1'in altına çekip çekmediği simülasyonla doğrulanmalı. Dezavantajı: çok iyi oyunlar "boşa" gidiyormuş gibi hissettirebilir.
3. **Yalnızca fiyat artırmak önerilmez.** Deneyimliyi durdurmak için fiyatları 4–5 kat artırmak gerekir; bu, yeni başlayanın tek bir joker için Eğlence'de 5–8, Klasik'te 50–100 oyun oynaması demek.
4. **Uzun vade:** jokerden başka yıldız harcama yerleri (ör. kozmetik temalar) enflasyonu emer. Bu, ürün kararıdır; 7.1 kapsamında değil.

Benim önerim 1 + 2'nin birlikte denenmesi (örneğin satın alınmış joker kullanılan oyunda oyun sonu ödülü yok + oyun başına 200 tavan). Ödüllerin ve fiyatların kesinleştirilmesi senin onayınla, 7.2'den önce yapılmalı.
