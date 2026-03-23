export function StatusBadge({ status, small }: { status: string; small?: boolean }) {
  const config: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    pending:    { bg: 'bg-stone-100',  text: 'text-stone-600',  dot: 'bg-stone-400',  label: 'Pending' },
    processing: { bg: 'bg-teal-50',   text: 'text-teal-700',   dot: 'bg-teal-500',   label: 'Processing' },
    completed:  { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Completed' },
    failed:     { bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500',    label: 'Failed' },
  }
  const c = config[status] ?? config['pending']
  const isProcessing = status === 'processing' || status === 'pending'

  const sizeClass = small
    ? 'text-xs px-2 py-0.5 gap-1.5'
    : 'text-sm px-3 py-1 gap-2'

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${sizeClass} ${c.bg} ${c.text}`}>
      <span
        className={`rounded-full shrink-0 ${small ? 'w-1.5 h-1.5' : 'w-2 h-2'} ${c.dot} ${isProcessing ? 'animate-pulse' : ''}`}
      />
      {c.label}
    </span>
  )
}
