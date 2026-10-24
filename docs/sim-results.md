# POPGRID — Kurtarma şansı simülasyonu

Üretici sürümü 1 · hamle sınırı 3000 · her ayar aynı tohumlarla oynandı (1…N).

- **Planlayıcı bot:** tepsideki parçaları birlikte planlayan "iyi oyuncu" yaklaşımı.
- **Greedy bot:** yalnızca tek hamle ileriye bakan "orta oyuncu".
- **Rastgele bot:** geçerli hamlelerden rastgele seçen "zayıf oyuncu".
- **Yeni üçlüde kayıp:** oyun, yeni üçlü geldiği anda bitti (hiçbir yeni parça sığmadı).
- **Kurtarma oranı:** gelen üçlülerin yüzde kaçında kurtarma bir parçayı değiştirdi.
- **Kurtarmada 1×1:** kurtarma olan üçlülerin yüzde kaçında tepside 1×1 vardı.

## Planlayıcı bot — 100 oyun

| Ayar | Medyan hamle | P10–P90 hamle | Medyan skor | Ort. skor | Yeni üçlüde kayıp | Kurtarma oranı | Kurtarmada 1×1 | Sınıra ulaşan |
|---|---|---|---|---|---|---|---|---|
| Kapalı (0→0) | 110 | 43–269 | 1.090 | 1.471 | %1,0 | %0,0 | %0,0 | %0,0 |
| %30 → %10 | 110 | 43–269 | 1.090 | 1.471 | %0,0 | %0,0 | %0,0 | %0,0 |
| %50 → %15 | 110 | 43–269 | 1.090 | 1.471 | %0,0 | %0,0 | %0,0 | %0,0 |
| %70 → %25 | 110 | 43–269 | 1.090 | 1.471 | %0,0 | %0,0 | %0,0 | %0,0 |
| %85 → %40 | 110 | 43–269 | 1.090 | 1.471 | %0,0 | %0,0 | %0,0 | %0,0 |
| Kesin garanti (100) | 110 | 43–269 | 1.090 | 1.471 | %0,0 | %0,0 | %0,0 | %0,0 |

## Greedy bot — 300 oyun

| Ayar | Medyan hamle | P10–P90 hamle | Medyan skor | Ort. skor | Yeni üçlüde kayıp | Kurtarma oranı | Kurtarmada 1×1 | Sınıra ulaşan |
|---|---|---|---|---|---|---|---|---|
| Kapalı (0→0) | 38 | 20–80 | 347 | 424 | %2,3 | %0,0 | %0,0 | %0,0 |
| %30 → %10 | 38 | 20–80 | 347 | 424 | %1,3 | %0,1 | %0,0 | %0,0 |
| %50 → %15 | 38 | 20–80 | 347 | 424 | %1,3 | %0,1 | %0,0 | %0,0 |
| %70 → %25 | 38 | 20–80 | 347 | 424 | %1,0 | %0,2 | %0,0 | %0,0 |
| %85 → %40 | 38 | 20–80 | 347 | 424 | %0,3 | %0,2 | %0,0 | %0,0 |
| Kesin garanti (100) | 38 | 20–80 | 347 | 424 | %0,0 | %0,2 | %0,0 | %0,0 |

## Rastgele bot — 1000 oyun

| Ayar | Medyan hamle | P10–P90 hamle | Medyan skor | Ort. skor | Yeni üçlüde kayıp | Kurtarma oranı | Kurtarmada 1×1 | Sınıra ulaşan |
|---|---|---|---|---|---|---|---|---|
| Kapalı (0→0) | 13 | 8–19 | 56 | 69 | %3,4 | %0,0 | %0,0 | %0,0 |
| %30 → %10 | 13 | 8–19 | 56 | 69 | %2,4 | %0,2 | %0,0 | %0,0 |
| %50 → %15 | 13 | 8–19 | 56 | 69 | %1,8 | %0,3 | %0,0 | %0,0 |
| %70 → %25 | 13 | 8–19 | 57 | 69 | %1,1 | %0,5 | %0,0 | %0,0 |
| %85 → %40 | 13 | 8–19 | 57 | 69 | %0,5 | %0,6 | %0,0 | %0,0 |
| Kesin garanti (100) | 13 | 8–19 | 57 | 69 | %0,0 | %0,7 | %2,9 | %0,0 |

Süre: 662 sn.

## Yorum (Aşama 1, 24.10.2026)
- "En az bir parça sığar" kuralı yalnızca **yeni üçlü geldiği anda** devreye girebilir. Botlar oyunların %97–99'unu **üçlünün ortasında** kaybetti; o anı bu kural etkileyemez.
- Bu yüzden kurtarma çok seyrek tetiklendi (üçlülerin en fazla %0,7'si) ve oyun uzunluğu, skor gibi zorluk göstergeleri ayarlar arasında **neredeyse hiç değişmedi**.
- Kuralın tek ölçülebilir etkisi: "yeni üçlü gelir gelmez kaybetme" (haksız hissettiren an) oranını %1–3'ten %0'a indirmesi.
- Korkulan "sonsuz 1×1 sürünmesi" görülmedi; 1×1 yalnızca kesin garantide, rastgele botta, kurtarmaların %2,9'unda çıktı.
- Sınır: botlar iyi bir insan oyuncudan zayıf (planlayıcı medyan 110 hamle). Uzun oyunlarda tahta daha sık dolacağı için etki biraz artabilir.
- Zorluk dengesi için asıl kaldıraç kurtarma değil: parça ağırlıkları ve gerekirse "üçlünün tamamı bir sırayla yerleştirilebilir" kontrolü. Bu ikincisi ayrı bir deney olarak önerilir.
