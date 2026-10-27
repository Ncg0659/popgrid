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

## Durum (Aşama 6.2 sonu)
Kısaltmalar: **B** = birim testi (Vitest, depoda, CI'da çalışır) · **T** = tarayıcı testi (Playwright, telefon emülasyonu, CDP dokunma olayları; bu çalışma ortamında çalıştırıldı, depoda değil) · **K** = kod incelemesi · **G** = gerçek cihaz (kullanıcı).

| # | Durum | Nasıl doğrulandı |
|---|---|---|
| 1 | ✔ | T: joker düğmeleri yalnızca `onClick` kullanır; tek dokunuş → tek Yenile |
| 2 | ✔ | T: 40 ms arayla iki dokunuş → tek Yenile (450 ms koruma), envanter kaydı değişmedi |
| 3 | ✔ | B (aynı durumdan iki uygulama) + K: `useGame` jokerleri her zaman son durumdan (`gameRef`) hesaplar |
| 4 | ✔ | T: Çekiç seçiliyken 25 ms arayla iki farklı bloğa dokunuş → yalnızca ilki kırıldı |
| 5 | ✔ | T + B: ilk dönüş 1 hak, ikinci ücretsiz; ilk dönüşten sonra yönerge "Ücretsiz: aynı parçaya dokun." olur; parça yerleşince ücretsiz dönüş biter |
| 6 | ✔ | T: Çekiç ve Döndür seçiliyken sürükleme → joker iptal, hak harcanmadı, parça yerleşti |
| 7 | → 6.3 | K: jokerler ara durumu değil son durumu okur. Joker animasyonları 6.3'te gelecek; bu madde o aşamada test edilecek (kullanıcı kararı) |
| 8 | ✔ | T: oyun sonunda bütün joker düğmeleri kapalı; B: motor `gameOver` reddeder |
| 9 | ✔ | T: boş hücreye Çekiç ve kare parçaya Döndür hak harcamaz; B: `noCharge`/`emptyCell`/`notRotatable` |
| 10 | ✔ | T + B: Eğlence rekoru ayrı anahtarda; Klasik rekoru (66) değişmedi |
| 11 | ✔ | T: mevcut `popgrid:v1:best` Klasik rekoru olarak görünüyor |
| 12 | ✔ | T: `localStorage` yazmaları kaydedildi: rekor yalnızca skor arttığında, yalnızca Eğlence anahtarına yazıldı (4 → 8 → 12 → 16 → 19), Bitir/oyun sonu tekrar yazmadı, Klasik anahtarı hiç yazılmadı |
| 13 | ✔ | T: Bitir → oyun sonu, "Yeni rekor!", Eğlence rekoru kaydedildi |
| 14 | ✔ | T + B: seçilen mod kaydedilir, yeniden açılışta korunur; oyun ortasında yalnızca "Yeni oyun" ile değişir |
| 15 | ✔ | T: "Yeniden oyna" → haklar yeniden 1/1/2 |
| 16 | ✔ | B + T: ücretsiz önce, sonra envanter; kayıt ve oyun durumu aynı; sayfa yenilenince harcanan hak geri gelmez |
| 17 | ✔ | B + T: `localStorage` erişimi hata verirken (gizli pencere benzeri) eğitim, mod seçimi, oynama, sıkıştın ve Yenile çalıştı; rekor oturumda gösterildi; konsol hatası yok |
| 18 | ✔ | T: eğitim/rehber (29) ve ses (9) tarayıcı testleri değişmeden geçti |
| 19 | ✔ | T (320 ve 390 px): sıkıştın kartı, Bitir 71×48 px, açık jokerler motorun "işe yarar" hesabıyla aynı |
| 20 | ✔ | T: 2 Döndür hakkı dururken kurtuluş yok → kart çıkmadan doğrudan oyun sonu |
| 21 | ✔ | B + T: Yenile harcanmışken sıkışıldı; son Çekiç kurtarmayan bir bloğa vurulunca (2 Döndür hakkı dururken) sıkıştın kartı kalktı ve oyun sonu açıldı |
| 22 | ✔ | T: 4 genişlikte Klasik ekran main ile **piksel piksel aynı**; joker öğesi yok |
| 23 | ✔ | T: 320/375/390/430 px'te yatay kaydırma yok, sayfa ekrana sığıyor; tahta yalnızca 320×568'de 19 px küçülüyor |
| 24 | ✔ | T: 320–430 px'te üç düğme eşit genişlikte, 52 px yüksek, simge her düğmede aynı konumda; adlar üçünde birlikte görünür (≥ 375 px) ya da birlikte gizlenir (320 px); hak rozeti her zaman görünür; ekran okuyucu etiketi "Çekiç, 1 hak kaldı" |
| 25 | ✔ | T: seçili joker satırında yönerge + Vazgeç/Tamam (en az 83×44 px); bütün yönergeler 320 ve 390 px'te en fazla 2 satırla çubuğa sığıyor; Esc kapatır. (Tasarım: seçiliyken çubuk bu satıra dönüştüğü için "aynı düğmeye tekrar dokunma" yerine Vazgeç düğmesi var) |
| 26 | ✔ | T: azaltılmış harekette Çekiç çalışıyor, geçişler 0 sn |
| 27 | ✔ | T: sürükleme (33), efekt (15), ses (9), rehber (29), eğitim (9) ve Aşama 2 oynanış testleri geçti. Performans: aynı 20 Klasik hamlede tarayıcının ölçtüğü toplam iş main ile %0,2 farkla aynı; yavaşlatılmış işlemci kare ölçümü oynak (iki sürüm de ara sıra sınırı aşıyor) |
| 28 | ✔ | T: her senaryoda arayüzdeki tahta/tepsi her adımda motorun aynı hamle + joker dizisiyle karşılaştırıldı |
| 29 | ✔ | K: bu aşamada joker efekti yok; jokerler tohumlu motor üzerinden çalışır |
| G | bekliyor | Kullanıcının iPhone'da denemesi |

Ek bulgu (düzeltildi): oyunu bitiren son dokunuşun tarayıcı tıklaması, yeni açılan oyun sonu penceresinin düğmesine denk gelip oyunu sıfırlayabiliyordu. Pencere açıldıktan sonraki 450 ms'de gelen dokunuşlar artık yok sayılıyor (klavye hemen çalışır).
- T: "Yeniden oyna"ya 101, 231 ve 332 ms'de gelen tıklamalar yok sayıldı, sonuç ekranı açık kaldı.
- T: bilinçli dokunuşlar engellenmedi: 495 ms'de "Yeniden oyna" ve 527 ms'de "Mod değiştir" çalıştı; klavyede Enter 47 ms'de çalıştı.
- T: Aşama 2 testi (390 px, 50 hamle, son hamle dokunarak) artık oyun sonu ekranını görüyor; korumadan önce bu senaryoda oyun kendiliğinden sıfırlanıyordu.

Ek bulgu (düzeltildi): Çekiç vurgusundaki `:has()` seçicileri tahtadaki her değişiklikte ek stil hesabına yol açabiliyordu; hücreye doğrudan `data-empty` işareti konuldu.
