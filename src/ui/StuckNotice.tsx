/**
 * Eğlence Modu: parçalar sığmıyor ama jokerle kurtuluş var. Oyun bitmez; oyuncu joker kullanır ya da bitirir.
 * Üst bölümün (skor/rekor) üstünde durur: tahtayı (Çekiç), tepsiyi (Döndür) ve joker çubuğunu kapatmaz.
 */
export function StuckNotice({ onGiveUp }: { onGiveUp(): void }) {
  return (
    <div className="stuck-card" role="alert">
      <div className="stuck-text">
        <strong>Sıkıştın!</strong>
        <span>Hiçbir parça sığmıyor. Bir joker kullan ya da oyunu bitir.</span>
      </div>
      <button type="button" className="btn-main stuck-end" onClick={onGiveUp}>
        Bitir
      </button>
    </div>
  )
}
