export interface CompanyNewsMeta {
  totalArticles: number
  lastIngestedAt: string | null
  hasUnscoredArticles: boolean
}

export const COMPANY_NEWS_AUTO_REFRESH_AFTER_MS = 6 * 60 * 60 * 1000

export function shouldAutoRefreshCompanyNews(
  meta: CompanyNewsMeta | null | undefined,
  now = Date.now(),
): boolean {
  if (!meta) return false
  if (meta.totalArticles === 0) return true
  if (meta.hasUnscoredArticles) return true
  if (!meta.lastIngestedAt) return true

  const lastIngestedAt = Date.parse(meta.lastIngestedAt)
  if (Number.isNaN(lastIngestedAt)) return true

  return now - lastIngestedAt >= COMPANY_NEWS_AUTO_REFRESH_AFTER_MS
}
