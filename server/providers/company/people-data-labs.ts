import type { CompanyProvider, CandidateCompany, NormalizedInput } from './types.js'
import { env } from '../../env.js'

export class PeopleDataLabsProvider implements CompanyProvider {
  name = 'people_data_labs'
  reliabilityFactor = 0.9

  async search(input: NormalizedInput): Promise<CandidateCompany[]> {
    const apiKey = env.PEOPLE_DATA_LABS_API_KEY
    if (!apiKey) {
      console.warn('[PeopleDataLabs] PEOPLE_DATA_LABS_API_KEY not set, skipping provider')
      return []
    }

    const params = new URLSearchParams({
      api_key: apiKey,
      name: input.companyName,
      ...(input.domain ? { website: input.domain } : {}),
      ...(input.country ? { country: input.country } : {}),
      size: '5',
    })

    const url = `https://api.peopledatalabs.com/v5/company/search?${params}`
    const res = await fetch(url, {
      signal: AbortSignal.timeout(env.PROVIDER_TIMEOUT_MS),
    })

    if (res.status === 401 || res.status === 403) {
      console.warn('[PeopleDataLabs] Authentication failed. Check PEOPLE_DATA_LABS_API_KEY.')
      return []
    }
    if (!res.ok) {
      console.warn(`[PeopleDataLabs] API error ${res.status}`)
      return []
    }

    const data = await res.json() as { data?: unknown[] }
    if (!Array.isArray(data.data)) return []

    return data.data.map((r: Record<string, unknown>) => ({
      providerName: this.name,
      providerRecordId: r.id as string | undefined,
      displayName: (r.name as string) ?? input.companyName,
      legalName: r.legal_name as string | undefined,
      domain: r.website as string | undefined,
      industry: r.industry as string | undefined,
      employeeCount:
        typeof r.employee_count === 'number' ? r.employee_count : undefined,
      hqCity: (r.location as Record<string, string> | undefined)?.locality,
      hqState: (r.location as Record<string, string> | undefined)?.region,
      hqCountry: (r.location as Record<string, string> | undefined)?.country,
      rawPayload: r,
    }))
  }
}
