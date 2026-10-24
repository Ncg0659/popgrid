# POPGRID — Proje Kuralları

Bu dosya POPGRID'in değişmez kurallarıdır. Kod değiştirmeden önce okunur.
`popgrid-guardian` skill'i bu kuralları korur; çelişki olursa bu dosya geçerlidir ve kullanıcıya bildirilir.

## Köken
1. POPGRID sıfırdan geliştirilir.
2. Eski BLOK PATLAT (block-blast-fusion) ve Lovable projelerinden hiçbir kod, bağımlılık, tasarım veya bileşen kullanılmaz.

## Görsel kimlik
3. Onaylanan 3D logo (`public/logo.png`) korunur: yeniden çizilmez, rengi değiştirilmez, kırpılmaz. Açılış görseli `public/splash.png`'dir.
4. Ana tema açık, sıcak, renkli ve eğlencelidir: turkuaz, mercan, sarı, mavi, mor, yeşil. Koyu lacivert, karanlık dashboard veya aşırı neon ana tema olarak kullanılmaz.
5. Bloklar görsel dosyayla değil CSS ile üretilir: yuvarlak köşe, hafif bevel, üstte ışık yansıması, yumuşak iç/dış gölge — parlak plastik oyuncak hissi.

## Bütçe
6. Başlangıç bütçesi 0 TL. Ücretli API, sunucu, veritabanı veya abonelik yok. Para gerektirebilecek her adım öncesinde kullanıcıdan izin alınır.

## Mimari
7. Oyun motoru (`src/engine/`) React'ten ve tarayıcıdan bağımsızdır: React, DOM, `window`, `document`, `localStorage`, zamanlayıcı veya ses içermez.
8. Motor eski durumu değiştirmez; `play(durum, hamle)` yeni durum ve olay listesi döndürür. Arayüz ve animasyonlar yalnızca olaylara tepki verir.
9. Motorda `Math.random` yasaktır (ESLint ve test ile denetlenir). Tüm rastgelelik `src/engine/rng.ts` üzerinden, tohumludur.
10. Belirlenim sözleşmesi: **aynı seed + aynı hamleler = birebir aynı tahta, parçalar ve skor.** Bu sözleşmeyi değiştiren her değişiklik `GENERATOR_VERSION`'ı artırır.
11. Görsel efektler ayrı, tohumsuz rastgelelik kullanır; oyun akışının rastgeleliğini asla tüketmez.

## Deneyim
12. Mobil dokunmatik deneyim önceliklidir: önce dikey telefon (320–430px), sonra masaüstü.

## Çalışma şekli
13. Test edilmeden "tamamlandı" raporu verilmez. Rapor, neyin nerede çalıştırıldığını açıkça yazar. Gerçek telefonda test, yalnızca kullanıcı denediyse "yapıldı" sayılır.
14. Çalışan özellikler gereksiz yere değiştirilmez; en küçük geri alınabilir değişiklik yapılır.
15. Aşamalar sırayla ilerler; bir sonraki aşamaya kullanıcı onayı olmadan geçilmez.
16. GitHub'a gönderme ve yayınlama her seferinde kullanıcı onayıyla yapılır.
17. Kurtarma şansı oranları deneyseldir; yalnızca simülasyon verisiyle (`npm run sim`) değiştirilir.
