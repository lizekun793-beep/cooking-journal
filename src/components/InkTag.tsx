import type { InkKind } from '../types'

export function InkTag({
  label,
  kind,
  dashed,
  onClick,
}: {
  label: string
  kind?: InkKind
  dashed?: boolean
  onClick?: () => void
}) {
  const cls = `ink ${dashed ? 'add' : kind ?? 'plain'}`
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick}>
        {label}
      </button>
    )
  }
  return <span className={cls}>{label}</span>
}
