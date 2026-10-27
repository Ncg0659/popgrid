# Aşama 6.2 — Joker arayüzü için test gereksinimleri

Bu liste Aşama 6.2'ye (mod seçimi, joker çubuğu, Çekiç/Yenile/Döndür etkileşimleri) **başlamadan önce** yazıldı.
6.2 bitti sayılmadan önce her madde otomatik testle (Vitest veya Playwright) ya da açıkça "elle" etiketli kontrolle karşılanır.
Motor tarafı Aşama 6.1'de hazır; buradaki maddeler arayüzün motoru doğru kullanmasını güvenceye alır.

## A. Çift kullanım (bir dokunuş = en fazla bir joker)
1. **Tek dokunuş tek hak:** Joker düğmesine bir dokunuş, `pointerup` + `click` (iOS'ta ikisi birden gelir) ve klavye `Enter`/`Space` dahil, en fazla **bir** `applyJoker` çağrısı üretir. Test: olayları ardışık tetikle, hak sayısı yalnızca 1 düşmeli.
2. **Hızlı çift dokunuş:** 50 ms arayla iki dokunuşta Yenile bir kez uygulanır. İkinci dokunuş ya yok sayılır ya da ikinci hakkı bilerek harcar; ama asla **aynı eski durumdan** iki kez hesaplanıp birini kaybetmez.
3. **Hep son durum:** Arayüz joker sonucunu her zaman en güncel oyun durumundan hesaplar (React'ta fonksiyonel `setState` ya da reducer). Motor testi: aynı eski durumla iki çağrı aynı sonucu verir (`tests/jokers.test.ts`). Arayüz testi: iki çağrıdan sonra hak sayısı ve tepsi tutarlıdır.
4. **Çekiç hedef modu:** Çekiç seçiliyken bir hücreye çift dokunmak **tek** hücreyi kırar. İlk vuruştan sonra hedef modu kapanır (yeniden seçmeden ikinci vuruş yok).
5. **Döndür:** İlk dönüş 1 hak harcar. Aynı parçaya sonraki dokunuşlar ücretsiz döner, hak sayısı değişmez. Parça yerleşince ya da Yenile ile değişince bir sonraki dönüş yeniden hak ister.
6. **Sürükleme ile çakışma:** Joker modu açıkken sürükleme başlarsa joker modu iptal olur ve hak harcanmaz. Sürüklenen parça bırakılırken Döndür düğmesine dokunmak hiçbir şeyi bozmaz.
7. **Animasyon sırasında:** Önceki joker ya da yerleştirme animasyonu sürerken gelen joker dokunuşu ya güvenle sıraya alınır ya da reddedilir. Hiçbir zaman ara (eski) durum üzerinden uygulanmaz.
8. **Oyun bittikten / Bitir'den sonra:** Hiçbir joker düğmesi çalışmaz; motor da reddeder (`gameOver`).
9. **Geçersiz kullanım hak harcamaz:** boş hücreye Çekiç, 1×1 / 2×2 / 3×3 parçaya Döndür, hakkı 0 olan joker. Düğme devre dışı görünür, dokunuş hak düşürmez.

## B. Kayıt tutarlılığı
10. **Rekorlar ayrı:** Klasik rekoru `popgrid:v1:best`, Eğlence rekoru `popgrid:v1:best:eglence`. Eğlence oyunu bitince Klasik rekoru **değişmez**; tersi de geçerli.
11. **Mevcut rekor korunur:** Aşama 6 öncesinden kalan `popgrid:v1:best` değeri güncellemeden sonra Klasik rekoru olarak görünür (geçiş testi).
12. **Rekor yalnızca bir kez yazılır:** Oyun sonu ekranı iki kez açılsa da (ör. `gameOver` olayı + Bitir) rekor tek kez ve doğru moda kaydedilir.
13. **Bitir ile biten oyun:** Bitir'le biten Eğlence oyununun skoru normal oyun sonu gibi Eğlence rekoruna yazılır.
14. **Mod tercihi:** Seçilen mod (Klasik/Eğlence) kaydedilir ve yeniden açılışta korunur. Oyun ortasında mod değiştirilemez.
15. **Haklar oyuna ait:** Oyun başına ücretsiz haklar her yeni Eğlence oyununda baştan verilir (Çekiç 1, Yenile 1, Döndür 2) ve sonraki oyuna geçmez. Sayfa yenilenince süren oyun kaybolur (bugünkü davranış).
16. **Kalıcı envanter ayrı:** Envanter (şimdilik 0) ücretsiz haklardan ayrı saklanır. Ücretsiz haklar envantere eklenmez. Envanterden harcama yalnızca `jokerUsed.source === 'inventory'` olayıyla ve tam bir kez düşülür. *(Market/yıldız yokken bu test envanter 0 ile ve sahte envanterle çalışır.)*
17. **Depolama yoksa:** Gizli pencere ya da kapalı `localStorage` durumunda oyun çalışmaya devam eder; rekor ve mod oturum içinde kalır, hata fırlatılmaz.
18. **Eğitim/rehber kayıtları etkilenmez:** `popgrid:v1:tutorial` ve `popgrid:v1:sound` anahtarları joker değişikliklerinden etkilenmez.

## C. Oyun sonu ve "sıkıştın" akışı
19. **Sıkıştı ekranı:** `stuck` olayında oyun bitmez. "Hiçbir parça sığmıyor. Bir joker kullan ya da oyunu bitir." mesajı ve **Bitir** düğmesi görünür; yalnızca işe yarayabilecek jokerler etkin.
20. **Kurtuluş yoksa doğrudan oyun sonu:** Hak kalmış olsa bile kurtuluş yoksa oyun sonu ekranı açılır (motor `gameOver` döndürür; arayüz "sıkıştı" göstermez).
21. **Boşa giden son joker:** Son hak işe yaramayan bir yere kullanılırsa oyun sonu ekranı açılır.
22. **Klasik Mod'da hiçbir joker öğesi görünmez;** ekran düzeni Aşama 5.2 ile aynıdır (ekran görüntüsü karşılaştırması).

## D. Mobil ve erişilebilirlik (mobil-oyun-test skill'i ile)
23. 320×568, 375×667, 390×844, 430×932 emülasyonunda joker çubuğu ekrana sığar, tahta ve tepsi kesilmez, sayfa kaymaz.
24. Joker düğmeleri en az 44×44 px; hak rozeti okunur; hakkı 0 olan düğme devre dışıdır ve ekran okuyucuya bildirilir.
25. Çekiç/Döndür hedef modunda açık bir durum yazısı vardır; Esc ve aynı düğmeye tekrar dokunmak modu kapatır.
26. Azaltılmış harekette joker animasyonları sadeleşir; işlev değişmez.
27. Sürükleme testleri (Aşama 3) ve ses testleri (Aşama 4) joker çubuğu eklendikten sonra yeniden çalıştırılır ve geçer.

## E. Belirlenim
28. Arayüzden oynanan bir Eğlence oyununun hamle + joker kaydı, motorda tekrar oynatılınca aynı parmak izini verir (arayüz motorun yanında ayrı rastgelelik kullanmaz).
29. Joker efektleri (parçacık, titreşim, ses) oyunun tohumlu rastgeleliğini tüketmez (RULES.md 11).

## Gerçek cihaz (kullanıcı)
- iPhone Safari'de çift dokunuş, Çekiç hedefleme, Döndür ve Bitir akışını kullanıcı dener ve sonucu bildirir. Bu madde kullanıcı denemeden "yapıldı" sayılmaz.
