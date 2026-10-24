# POPGRID — Deney: üçlünün tamamı yerleştirilebilir mi?

Bu deney oyun kurallarını değiştirmez. "Tam üçlü" satırları varsayımsal bir kuralı yalnızca simülasyonda dener.
Üretici sürümü 1 · hamle sınırı 3000 · her satır aynı tohumlarla (1…N) oynandı.

- **Tam yerleştirilebilir üçlü:** üç parçanın hepsini, bir sırayla (temizlemeler dahil) koyabilmenin mümkün olduğu üçlü.
- **Kaçınılabilir kayıp:** oyunu bitiren üçlü, geldiği anda tam yerleştirilebilirdi; yani kayıp oyuncu hatası.
- **Kural uygulandı:** varsayımsal kural gelen üçlüyü değiştirdi.

## Planlayıcı bot — 60 oyun

| Ayar | Medyan hamle | P10–P90 hamle | Medyan skor | Tam yerleştirilebilir üçlü | Kaçınılabilir kayıp | Kural uygulandı | Ort. parça boyu |
|---|---|---|---|---|---|---|---|
| Kurtarma kapalı | 119 | 47–278 | 1.181 | %98,2 | %1,7 | %0,0 | 3,84 |
| Mevcut (≥1 sığar, %70→%25) | 119 | 47–278 | 1.181 | %98,2 | %1,7 | %0,0 | 3,84 |
| Tam üçlü %10 | 119 | 47–299 | 1.181 | %98,2 | %1,7 | %0,1 | 3,84 |
| Tam üçlü %25 | 146 | 50–344 | 1.466 | %98,4 | %1,7 | %0,5 | 3,83 |
| Tam üçlü %50 | 190 | 77–436 | 1.939 | %98,8 | %6,7 | %1,3 | 3,83 |
| Tam üçlü %75 | 259 | 97–986 | 2.696 | %99,3 | %8,3 | %2,0 | 3,82 |
| Tam üçlü %100 | 3.000 | 446–3.000 | 32.746 | %100,0 | %100,0 | %2,9 | 3,81 |

## Greedy bot — 300 oyun

| Ayar | Medyan hamle | P10–P90 hamle | Medyan skor | Tam yerleştirilebilir üçlü | Kaçınılabilir kayıp | Kural uygulandı | Ort. parça boyu |
|---|---|---|---|---|---|---|---|
| Kurtarma kapalı | 38 | 20–80 | 347 | %95,5 | %30,7 | %0,0 | 3,85 |
| Mevcut (≥1 sığar, %70→%25) | 38 | 20–80 | 347 | %95,5 | %31,3 | %0,0 | 3,84 |
| Tam üçlü %10 | 40 | 20–83 | 362 | %95,9 | %34,3 | %0,5 | 3,84 |
| Tam üçlü %25 | 41 | 20–88 | 378 | %96,3 | %39,0 | %1,2 | 3,83 |
| Tam üçlü %50 | 44 | 20–95 | 430 | %97,2 | %50,7 | %2,8 | 3,82 |
| Tam üçlü %75 | 47 | 23–110 | 461 | %98,4 | %68,3 | %4,8 | 3,80 |
| Tam üçlü %100 | 56 | 26–146 | 547 | %100,0 | %100,0 | %7,7 | 3,78 |

Süre: 1456 sn.

## Yorum (24.10.2026)
- İyi oyuncu (planlayıcı) kayıplarının yalnızca %1,7'si kendi hatası; geri kalan %98'i, geldiği anda tamamı yerleştirilemeyen bir üçlüden. Yani iyi oyuncu için oyunu bitiren şey neredeyse her zaman "imkânsız üçlü".
- Bu yüzden "tam üçlü" kuralı zorluğu güçlü biçimde değiştiriyor: planlayıcıda medyan oyun uzunluğu %25'te +%23, %50'de +%60, %75'te +%118. %100'de oyun fiilen bitmiyor (medyan 3.000 hamle sınırı).
- Kural nadiren devreye giriyor (üçlülerin en fazla %3'ü) ama tam belirleyici anda giriyor.
- Parça boyu neredeyse değişmiyor (3,84 → 3,81 blok): kural küçük parçalara kaymıyor.
- Orta oyuncuda (greedy) etki daha küçük (+%5 ile +%47), çünkü kayıplarının üçte biri kendi hatası. Kural iyi oynamayı daha çok ödüllendiriyor.
- Mevcut "≥1 sığar" kuralının planlayıcıda ölçülebilir etkisi yok (satırlar "kapalı" ile aynı).
- Sınırlar: planlayıcıda 60 oyun (küçük örnek, P90 geniş), botlar insan değil. Kural değişikliği yapılmadı.
