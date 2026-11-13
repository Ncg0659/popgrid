interface Props {
  /** Alınmayı bekleyen ödül sayısı (0: rozet yok). */
  pending: number
  onOpen(): void
}

/** Aşama 10.4: Görevler düğmesi (44×44). Yıldız düğmesinin yanında; alınacak ödül varsa küçük sayı rozeti. */
export function GoalsButton({ pending, onOpen }: Props) {
  const label = pending > 0 ? `Görevler. Alınacak ${pending} ödül var` : 'Görevler'
  return (
    <button type="button" className="goals-btn" onClick={onOpen} aria-label={label} title="Görevler ve başarımlar">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4.5" y="4" width="15" height="17" rx="3.5" />
        <path className="goals-clip" d="M9 4.2V3.4c0-.8.6-1.4 1.4-1.4h3.2c.8 0 1.4.6 1.4 1.4v.8" />
        <path className="goals-check" d="M8.4 12.6l2.4 2.4 4.8-5" />
      </svg>
      {pending > 0 && (
        <span className="goals-badge" aria-hidden="true">
          {pending > 9 ? '9+' : pending}
        </span>
      )}
    </button>
  )
}
