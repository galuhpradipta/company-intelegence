const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504])
const BASE_BACKOFF_MS = 250
const MAX_BACKOFF_MS = 5000
const MAX_RETRIES = 2

export async function fetchWithBackoff(
  providerName: string,
  url: string,
  timeoutMs: number,
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!shouldRetry(response.status, attempt)) {
      return response
    }

    const delayMs = getRetryDelayMs(response.headers.get('retry-after'), attempt)
    console.warn(
      `[${providerName}] Temporary provider limit (${response.status}). Retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_RETRIES}).`,
    )
    await sleep(delayMs)
  }
}

export function getRetryDelayMs(retryAfterHeader: string | null, attempt: number): number {
  const retryAfterDelay = parseRetryAfterHeader(retryAfterHeader)
  if (retryAfterDelay !== undefined) {
    return clampDelay(retryAfterDelay)
  }

  return clampDelay(BASE_BACKOFF_MS * 2 ** attempt)
}

function shouldRetry(status: number, attempt: number): boolean {
  return RETRYABLE_STATUS_CODES.has(status) && attempt < MAX_RETRIES
}

function parseRetryAfterHeader(headerValue: string | null): number | undefined {
  if (!headerValue) return undefined

  const seconds = Number(headerValue)
  if (!Number.isNaN(seconds)) {
    return seconds * 1000
  }

  const timestamp = Date.parse(headerValue)
  if (Number.isNaN(timestamp)) {
    return undefined
  }

  return Math.max(0, timestamp - Date.now())
}

function clampDelay(delayMs: number): number {
  return Math.min(Math.max(delayMs, 0), MAX_BACKOFF_MS)
}

async function sleep(delayMs: number) {
  await new Promise((resolve) => setTimeout(resolve, delayMs))
}
