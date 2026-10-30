# POPGRID — Claude için çalışma kuralları

Bu depoda çalışmaya başlamadan önce:

1. `popgrid-guardian` skill'ini yükle (kullanılabilir skill listesinde yoksa kullanıcıya söyle).
2. `RULES.md`'yi oku. Bu dosya, `RULES.md` ve Guardian çelişirse `RULES.md` geçerlidir; çelişkiyi kullanıcıya bildir.

## Korunacaklar (onay olmadan değiştirme)

- Oyun motoru `src/engine/`, puanlama, jokerler, yıldız ekonomisi `src/economy/` ve kayıt anahtarları `src/storage/`.
- Belirlenim: `GENERATOR_VERSION = 1` ve golden fingerprint `8f8b8146` (`tests/game.test.ts`). Golden ya da kural testlerini, kodu geçsin diye değiştirme.
- Oyuncu kayıtları (localStorage) ve 8×8 tahta / tepsi / sürükle-bırak düzeni.
- Bütçe 0 TL: ücretli servis, API ya da abonelik yok.

## Zorunlu kontroller (her değişiklikten sonra)

```
npm ci --ignore-scripts
npm run lint
npm test          # golden, ekonomi ve joker testleri dahil
npm run build     # tsc -b + vite build
```

Arayüz değişikliğinde telefon genişlikleri (320 / 375 / 390 / 430 px) tarayıcıda denenir. Emülasyon "gerçek cihaz testi" diye raporlanmaz; gerçek iPhone testini kullanıcı yapar.

## Onay gerektirenler

- `main`'e push, PR birleştirme, GitHub Pages yayını ve önizleme yayını: her seferinde kullanıcının sohbetteki açık onayı.
- Force push yok. Çalışma ayrı dalda yapılır, PR ile önerilir.
- Bağımlılık eklemek ya da güncellemek, GitHub ayarlarını değiştirmek, yeni erişim izni ya da harici bağlantı.

## Rapor

Türkçe ve kısa: değişen dosyalar, doğrulananlar, test sonuçları, riskler, sonraki adım.
