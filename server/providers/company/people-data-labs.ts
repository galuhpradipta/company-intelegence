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

    const params = new URLSearchParams()
    if (input.domain) params.set('website', input.domain)
    if (input.companyName) params.set('name', input.companyName)
    if (input.city) params.set('locality', input.city)
    if (input.state) params.set('region', input.state)
    if (input.country) params.set('country', input.country)

    const url = `https://api.peopledatalabs.com/v5/company/enrich?${params}`
    const res = await fetch(url, {
      signal: AbortSignal.timeout(env.PROVIDER_TIMEOUT_MS),
      headers: {
        'X-Api-Key': apiKey,
        Accept: 'application/json',
      },
    })

    if (res.status === 401 || res.status === 403) {
      console.warn('[PeopleDataLabs] Authentication failed. Check PEOPLE_DATA_LABS_API_KEY.')
      return []
    }
    if (res.status === 404) {
      return []
    }
    if (!res.ok) {
      console.warn(`[PeopleDataLabs] API error ${res.status}: ${await res.text()}`)
      return []
    }

    const data = await res.json() as Record<string, unknown>
    if (!data.id && !data.name) return []

    return [{
      providerName: this.name,
      providerRecordId: data.id as string | undefined,
      displayName: (data.legal_name as string) ?? (data.name as string) ?? input.companyName,
      legalName: data.legal_name as string | undefined,
      domain: data.website as string | undefined,
      industry: data.industry as string | undefined,
      employeeCount:
        typeof data.employee_count === 'number' ? data.employee_count : undefined,
      hqCity: (data.location as Record<string, string> | undefined)?.locality,
      hqState: (data.location as Record<string, string> | undefined)?.region,
      hqCountry: (data.location as Record<string, string> | undefined)?.country,
      rawPayload: data,
    }]
  }
}
