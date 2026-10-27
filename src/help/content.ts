/**
 * Oyun rehberi ve ilk açılış eğitiminin içeriği — tek yerde, veri olarak.
 * Puan örnekleri elle yazılmaz; oyun motorunun puan fonksiyonlarından hesaplanır.
 * Böylece yardım metni oyunla hiçbir zaman çelişmez.
 *
 * Yeni bir mekanik (joker, özel blok…) eklendiğinde: HELP_SECTIONS listesine bir bölüm ekle.
 * availability: 'planlanan' olan bölümler ekranda GÖSTERİLMEZ; özellik oyuna girince 'oyunda' yapılır.
 */
import { DEFAULT_FREE_JOKERS, clearBasePoints, scoreMove } from '../engine'
import type { JokerKind } from '../engine/types'

export type Availability = 'oyunda' | 'planlanan'

export type HelpBlock =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'list'; readonly items: readonly string[] }
  | { readonly kind: 'scoreTable'; readonly rows: ReadonlyArray<{ readonly lines: number; readonly points: number }> }
  | { readonly kind: 'faq'; readonly items: ReadonlyArray<{ readonly q: string; readonly a: string }> }
  | { readonly kind: 'replayTutorial' }
  | { readonly kind: 'replayJokerIntro' }

export interface HelpSection {
  readonly id: string
  readonly title: string
  readonly availability: Availability
  readonly blocks: readonly HelpBlock[]
}

const fmt = (n: number) => n.toLocaleString('tr-TR')

/** Oyun başına joker hakları (motorun varsayılanından; metin oyunla çelişmesin). */
const J = DEFAULT_FREE_JOKERS
export const JOKER_RIGHTS_TEXT = `${J.cekic} Çekiç, ${J.yenile} Yenile ve ${J.dondur} Döndür`

/** Puan örnekleri (motordan). */
export const SCORE_EXAMPLES = {
  /** 4 bloklu parça, temizleme yok. */
  placeOnly: scoreMove(4, 0, 0).breakdown.total,
  /** 3 bloklu parça 1 satırı tamamlar (kombo yok). */
  oneLine: scoreMove(3, 1, 0).breakdown.total,
  /** 3 bloklu parça aynı anda 1 satır + 1 sütun tamamlar. */
  twoLines: scoreMove(3, 2, 0).breakdown.total,
  /** Bir önceki hamle de temizlemişti: 3 bloklu parça 1 satır tamamlar (kombo ×2). */
  comboSecond: scoreMove(3, 1, 1).breakdown.total,
} as const

export const HELP_SECTIONS: readonly HelpSection[] = [
  {
    id: 'kurallar',
    title: 'Temel kurallar',
    availability: 'oyunda',
    blocks: [
      {
        kind: 'list',
        items: [
          'Tahta 8 × 8 karedir.',
          'Altta her seferinde üç parça gelir. Klasik Mod’da parçalar döndürülemez.',
          'Üç parçayı da yerleştirince yeni üç parça gelir.',
          'Dolu bir satır ya da sütun patlar ve yer açılır.',
          'Hiçbir parça sığmayınca oyun biter.',
        ],
      },
    ],
  },
  {
    id: 'yerlestirme',
    title: 'Blok yerleştirme',
    availability: 'oyunda',
    blocks: [
      { kind: 'text', text: 'Parçayı parmağınla tut ve tahtaya sürükle. Parça parmağının biraz üstünde durur; gölgesi nereye oturacağını gösterir. Bırakınca yerleşir.' },
      { kind: 'text', text: 'Gölge gri görünüyorsa parça oraya sığmıyor demektir. Bırakırsan parça yerine geri döner.' },
      {
        kind: 'list',
        items: [
          'Dokunarak: parçaya dokun, tahtada bir yere dokun, sonra gölgeye tekrar dokun.',
          'Klavyeyle: Tab ile parçayı seç ve Enter’a bas, oklarla taşı, Enter ile yerleştir.',
        ],
      },
    ],
  },
  {
    id: 'temizleme',
    title: 'Satır ve sütun temizleme',
    availability: 'oyunda',
    blocks: [
      { kind: 'text', text: 'Bir satırı (soldan sağa) ya da sütunu (yukarıdan aşağı) tamamen doldurduğunda bloklar patlar.' },
      { kind: 'text', text: 'Aynı hamlede birden çok satır ve sütun birlikte temizlenebilir. Parçayı bırakmadan önce patlayacak hatlar parlar.' },
    ],
  },
  {
    id: 'puan',
    title: 'Puanlama ve kombolar',
    availability: 'oyunda',
    blocks: [
      { kind: 'text', text: 'Yerleştirdiğin her blok 1 puan. Aynı hamlede ne kadar çok hat temizlersen puan o kadar hızlı artar:' },
      {
        kind: 'scoreTable',
        rows: [1, 2, 3, 4].map((lines) => ({ lines, points: clearBasePoints(lines) })),
      },
      { kind: 'text', text: 'Kombo: art arda her hamlede temizleme yaparsan temizleme puanı 2 kat, 3 kat… olur. Temizlemeyen bir hamle komboyu bitirir.' },
      {
        kind: 'list',
        items: [
          `4 bloklu parça, temizleme yok: ${fmt(SCORE_EXAMPLES.placeOnly)} puan.`,
          `3 bloklu parça 1 satırı tamamlar: 3 + ${fmt(clearBasePoints(1))} = ${fmt(SCORE_EXAMPLES.oneLine)} puan.`,
          `Aynı parça 1 satır ve 1 sütunu birlikte tamamlar: 3 + ${fmt(clearBasePoints(2))} = ${fmt(SCORE_EXAMPLES.twoLines)} puan.`,
          `Önceki hamle de temizlemişse (kombo ×2): 3 + ${fmt(clearBasePoints(1))} × 2 = ${fmt(SCORE_EXAMPLES.comboSecond)} puan.`,
        ],
      },
    ],
  },
  {
    id: 'bitis',
    title: 'Oyun bitişi',
    availability: 'oyunda',
    blocks: [
      { kind: 'text', text: 'Altta kalan parçaların hiçbiri tahtada bir yere sığmıyorsa oyun biter. Hiçbir yere sığmayan parça tepside soluk görünür.' },
      { kind: 'text', text: 'Eğlence Modu’nda işe yarayacak bir jokerin varsa oyun hemen bitmez (aşağıdaki Jokerler bölümü).' },
      { kind: 'text', text: 'İpucu: büyük parçalar için tahtada açık alan bırak; köşeleri ve kenarları önce doldur.' },
    ],
  },
  {
    id: 'jokerler',
    title: 'Jokerler (Eğlence Modu)',
    availability: 'oyunda',
    blocks: [
      {
        kind: 'text',
        text: 'Klasik Mod jokersizdir. Eğlence Modu’nda her oyuna jokerlerle başlarsın. Modu “Yeni oyun” düğmesinden ya da oyun sonunda seçersin; oyun ortasında mod değişmez.',
      },
      {
        kind: 'list',
        items: [
          `Çekiç (${J.cekic} hak): düğmeye dokun, sonra kırmak istediğin dolu bloğa dokun. Vazgeç ile iptal edebilirsin; boş hücreye dokunmak hak harcamaz.`,
          `Yenile (${J.yenile} hak): tepsideki kullanılmamış parçaları yenileriyle değiştirir. Kullandığın yuvalar boş kalır.`,
          `Döndür (${J.dondur} hak): düğmeye dokun, sonra çevirmek istediğin parçaya dokun. İlk dönüş 1 hak harcar; aynı parça yerleşene kadar sonraki dönüşler ücretsizdir.`,
        ],
      },
      {
        kind: 'list',
        items: [
          'Jokerler puan vermez ve komboyu bozmaz; kombo yalnızca parça yerleştirince değişir.',
          `Joker hakların her yeni Eğlence oyununda yeniden verilir (${JOKER_RIGHTS_TEXT}); kullanılmayan haklar sonraki oyuna geçmez.`,
          'Klasik ve Eğlence rekorları ayrı tutulur.',
          'Hiçbir parça sığmadığında işe yarayacak bir jokerin varsa oyun bitmez: jokerini kullan ya da “Bitir”e dokun. İşe yarayan joker kalmadıysa oyun biter.',
        ],
      },
      { kind: 'replayJokerIntro' },
    ],
  },
  {
    id: 'dugmeler',
    title: 'Düğmeler',
    availability: 'oyunda',
    blocks: [
      {
        kind: 'list',
        items: [
          'Hoparlör: oyun seslerini açar veya kapatır. Seçimin bu cihazda hatırlanır.',
          'Döngü oku (Yeni oyun): mod seçimini açar (Klasik ya da Eğlence). Oyun sürerken iki kez dokunman gerekir; yanlışlıkla sıfırlanmasın diye.',
          'Taç: bu cihazdaki Klasik rekorun. Eğlence Modu’nda yerinde mor rozetle Eğlence rekorun görünür.',
          'Soru işareti: bu rehberi açar.',
        ],
      },
    ],
  },
  {
    id: 'sss',
    title: 'Sık sorulan sorular',
    availability: 'oyunda',
    blocks: [
      {
        kind: 'faq',
        items: [
          { q: 'Rekorum nerede saklanıyor?', a: 'Bu cihazda, tarayıcının hafızasında. Klasik ve Eğlence rekorları ayrı saklanır. Başka bir cihazda görünmez; tarayıcı verilerini silersen kaybolur.' },
          { q: 'Sayfayı yenilersem oyunum devam eder mi?', a: 'Hayır. Şimdilik süren oyun kaydedilmiyor; yalnızca rekorların, ses ve mod tercihin saklanır.' },
          { q: 'Klasik ve Eğlence Modu arasındaki fark nedir?', a: 'Klasik jokersizdir. Eğlence Modu’nda her oyuna Çekiç, Yenile ve Döndür jokerleriyle başlarsın. İki modun rekoru ayrıdır.' },
          { q: 'Joker hakları sonraki oyuna geçer mi?', a: `Hayır. Haklar her yeni Eğlence oyununda yeniden verilir: ${JOKER_RIGHTS_TEXT}.` },
          { q: 'Jokerler puan verir mi?', a: 'Hayır. Jokerler puan vermez ve komboyu bozmaz.' },
          { q: 'Ses gelmiyor, neden?', a: 'Hoparlör düğmesinin açık olduğundan emin ol. iPhone sessiz moddaysa oyun sesleri duyulmaz; sesi açmak için sessiz modu kapat.' },
          { q: 'Parçaları döndürebilir miyim?', a: 'Klasik Mod’da hayır: parçalar geldiği yönde yerleştirilir; bu oyunun zorluğunun bir parçası. Eğlence Modu’nda Döndür jokeriyle döndürebilirsin.' },
          { q: 'Eğitimi tekrar izleyebilir miyim?', a: 'Evet, aşağıdaki düğmeyle. Joker tanıtımını da Jokerler bölümünden tekrar açabilirsin.' },
        ],
      },
      { kind: 'replayTutorial' },
    ],
  },
]

/** Ekranda yalnızca oyunda gerçekten bulunan özellikler gösterilir. */
export function visibleSections(sections: readonly HelpSection[] = HELP_SECTIONS): HelpSection[] {
  return sections.filter((s) => s.availability === 'oyunda')
}

export type TutorialScene = 'drag' | 'clear' | 'refill' | 'gameover'

export interface TutorialCard {
  readonly id: string
  readonly title: string
  readonly text: string
  readonly scene: TutorialScene
}

export const TUTORIAL_CARDS: readonly TutorialCard[] = [
  {
    id: 'surukle',
    title: 'Sürükle ve bırak',
    text: 'Alttaki parçalardan birini tut ve tahtaya sürükle. Gölge, parçanın nereye oturacağını gösterir.',
    scene: 'drag',
  },
  {
    id: 'patlat',
    title: 'Doldur ve patlat',
    text: 'Bir satırı ya da sütunu tamamen doldur: bloklar patlar, puan kazanırsın.',
    scene: 'clear',
  },
  {
    id: 'uclu',
    title: 'Üç parça, sonra yenileri',
    text: 'Her seferinde üç parça gelir. Üçünü de yerleştirince yenileri gelir. Klasik Mod’da parçalar döndürülemez.',
    scene: 'refill',
  },
  {
    id: 'bitis',
    title: 'Yer kalmayınca biter',
    text: 'Kalan parçaların hiçbiri sığmazsa oyun biter. Aynı anda çok hat temizle, art arda temizleyip kombo yap!',
    scene: 'gameover',
  },
]

export interface JokerIntroItem {
  readonly kind: JokerKind
  readonly name: string
  readonly text: string
  /** Oyun başına hak (motorun varsayılanından). */
  readonly rights: number
}

/** Eğlence Modu'na ilk girişteki "Jokerlerle tanış!" kartı. */
export const JOKER_INTRO = {
  title: 'Jokerlerle tanış!',
  lead: 'Eğlence Modu’nda her oyuna üç jokerle başlarsın:',
  items: [
    { kind: 'cekic', name: 'Çekiç', text: 'Bir dolu bloğu siler.', rights: J.cekic },
    { kind: 'yenile', name: 'Yenile', text: 'Kullanılmamış parçaları yeniler.', rights: J.yenile },
    { kind: 'dondur', name: 'Döndür', text: 'Bir parçayı döndürür; aynı parça için sonraki dönüşler ücretsizdir.', rights: J.dondur },
  ] as readonly JokerIntroItem[],
  rights: `Başlangıç hakların: ${JOKER_RIGHTS_TEXT}. Haklar her yeni Eğlence oyununda yenilenir.`,
  note: 'Jokerler puan vermez ve komboyu bozmaz.',
  button: 'Hadi oyna!',
} as const
