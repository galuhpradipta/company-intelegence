export function trpcSuccess<T>(data: T) {
  return { result: { data } }
}

export function parseTrpcInput<T>(requestUrl: string): T | undefined {
  const rawInput = new URL(requestUrl).searchParams.get('input')

  if (!rawInput) return undefined

  const parsed = JSON.parse(rawInput) as Record<string, T>
  return parsed['0']
}
