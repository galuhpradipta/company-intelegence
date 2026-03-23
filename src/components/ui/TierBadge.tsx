export function TierBadge({ tier }: { tier: string }) {
  const config: Record<string, { bg: string; text: string; border: string; dot: string; label: string }> = {
    confident: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      dot: 'bg-emerald-500',
      label: 'Confident',
    },
    suggested: {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
      dot: 'bg-amber-400',
      label: 'Suggested',
    },
    not_found: {
      bg: 'bg-red-50',
      text: 'text-red-600',
      border: 'border-red-200',
      dot: 'bg-red-400',
      label: 'Not Found',
    },
  }

  const c = config[tier] ?? {
    bg: 'bg-stone-50',
    text: 'text-stone-600',
    border: 'border-stone-200',
    dot: 'bg-stone-400',
    label: tier,
  }

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium border ${c.bg} ${c.text} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
      {c.label}
    </span>
  )
}
