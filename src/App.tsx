import { GENERATOR_VERSION, newGame } from './engine'

/**
 * Aşama 1 yer tutucu sayfası. Oyun arayüzü Aşama 2'de gelecek.
 * Burada yalnızca motorun tarayıcıda çalıştığı gösterilir.
 */
export default function App() {
  const game = newGame(12345)
  const pieces = game.tray.map((p) => p?.shapeId ?? '—').join(', ')
  return (
    <main className="stage1">
      <img className="logo" src={`${import.meta.env.BASE_URL}logo.png`} alt="POPGRID" />
      <p className="note">Yapım aşamasında — Aşama 1: oyun motoru</p>
      <p className="detail">
        Motor sürümü {GENERATOR_VERSION} · Seed 12345 ilk parçalar: {pieces}
      </p>
    </main>
  )
}
