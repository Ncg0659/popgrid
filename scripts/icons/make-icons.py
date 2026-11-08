# Kullanım (proje kökünde; Python 3 + numpy + scipy + Pillow, projenin bağımlılığı değildir):
#   python3 scripts/icons/make-icons.py  → public/icons/*.png ve favicon (public/favicon.ico'ya ayrıca kopyalanır)
# POPGRID ikonları: onaylı kaynak görselden (yeniden çizim YOK). Yapılanlar yalnızca:
# 1) dış beyaz çerçeve ve siyah köşeler (görselin dışı) ayıklanır,
# 2) bu dış bölge, kenardaki arka plan renginin merkezden dışa doğru uzatılmasıyla doldurulur (ışınlar merkezden
#    çıktığı için devam eder; iOS/Android köşe maskesi bu bölgenin çoğunu zaten keser),
# 3) kare kırpılıp boyutlandırılır. Küp, ünlemler, renkler ve yerleşim değişmez.
import numpy as np
from PIL import Image
from scipy import ndimage
import json, sys, os
SRC = sys.argv[1] if len(sys.argv) > 1 else 'docs/ikon/popgrid-ikon-kaynak.png'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'public/icons'
os.makedirs(OUT, exist_ok=True)
im = Image.open(SRC).convert('RGB')
a = np.asarray(im).astype(np.int32)
H, W, _ = a.shape
mx, mn = a.max(2), a.min(2)
whiteish = (mn > 200) & (mx - mn < 40)
blackish = mx < 40
bg = whiteish | blackish
# Dışarıdan erişilen beyaz/siyah bölge (çerçeve + köşeler); içteki beyaz parlamalar ve ünlem kenarları hariç.
lab, _ = ndimage.label(bg)
outer_labels = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
outer = np.isin(lab, list(outer_labels))
outer = ndimage.binary_dilation(outer, iterations=4)  # kenar yumuşatma pikselleri (beyaz karışımı) de
cy, cx = (H - 1) / 2, (W - 1) / 2
out = a.copy()
ys, xs = np.nonzero(outer)
for y, x in zip(ys, xs):
    dy, dx = cy - y, cx - x
    d = (dy * dy + dx * dx) ** 0.5
    sy, sx = dy / d, dx / d
    t = 1.0
    while True:
        yy, xx = int(round(y + sy * t)), int(round(x + sx * t))
        if not outer[yy, xx]:
            break
        t += 1.0
    # sınırdan 3 px içeriden örnekle (yumuşak kenar karışımı olmasın)
    yy, xx = int(round(y + sy * (t + 3))), int(round(x + sx * (t + 3)))
    out[y, x] = a[yy, xx]
full = Image.fromarray(out.astype(np.uint8))
# Çerçevenin içindeki sanat alanı yaklaşık 27..1226; kare kırpım merkezde 1200 px.
half = 600
c = int(round(cx))
box = (c - half + 1, c - half + 1, c + half + 1, c + half + 1)
art = full.crop(box)
def save(size, name, rounded=False):
    img = art.resize((size, size), Image.LANCZOS)
    if rounded:
        # Tarayıcı sekmesi için görselin kendi yuvarlak köşeli biçimi (köşeler saydam).
        s = 4 * size
        m = Image.new('L', (s, s), 0)
        from PIL import ImageDraw
        ImageDraw.Draw(m).rounded_rectangle((0, 0, s - 1, s - 1), radius=int(s * 0.225), fill=255)
        m = m.resize((size, size), Image.LANCZOS)
        img = img.convert('RGBA'); img.putalpha(m)
    img.save(f'{OUT}/{name}', optimize=True)
save(1024, 'icon-1024.png')
save(180, 'apple-touch-icon.png')
save(192, 'icon-192.png')
save(512, 'icon-512.png')
save(32, 'favicon-32.png', rounded=True)
save(48, 'favicon-48.png', rounded=True)
fav = Image.open(f'{OUT}/favicon-48.png')
fav.save(os.path.join(OUT, '..', 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])
print('ok', box, outer.sum())
