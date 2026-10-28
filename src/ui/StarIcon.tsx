/** Yıldız simgesi (bakiye, mağaza). Hacimli görünüm CSS'te (.star-icon). */
export function StarIcon({ className = 'star-icon' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.6l2.75 5.75 6.3.8-4.62 4.36 1.18 6.24L12 16.7l-5.61 3.05 1.18-6.24L2.95 9.15l6.3-.8z" />
    </svg>
  )
}
