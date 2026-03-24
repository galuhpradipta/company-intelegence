import type { CompanyProvider, CandidateCompany, NormalizedInput } from './types.js'
import { env } from '../../env.js'

export class OpenCorporatesProvider implements CompanyProvider {
  name = 'opencorporates'
  reliabilityFactor = 1.0

  async search(input: NormalizedInput): Promise<CandidateCompany[]> {
    const apiToken = env.OPENCORPORATES_API_KEY

    const params = new URLSearchParams({
      q: input.companyName,
      jurisdiction_code: 'us', // v1 US-first
      ...(apiToken ? { api_token: apiToken } : {}),
    })

    const url = `https://api.opencorporates.com/v0.4/companies/search?${params}`

    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(env.PROVIDER_TIMEOUT_MS),
      })

      if (res.status === 401 || res.status === 403) {
        console.warn('[OpenCorporates] Auth failed or rate limited. Check OPENCORPORATES_API_KEY.')
        return []
      }
      if (!res.ok) {
        console.warn(`[OpenCorporates] API error ${res.status}`)
        return []
      }

      const data = await res.json() as {
        results?: {
          companies?: Array<{ company: Record<string, unknown> }>
        }
      }

      const results = data.results?.companies ?? []

      return results.slice(0, 5).map(({ company: r }) => {
        const address = r.registered_address as Record<string, unknown> | undefined
        return {
          providerName: this.name,
          providerRecordId: r.company_number as string | undefined,
          sourceUpdatedAt: firstString(
            r.updated_at,
            r.created_at,
            r.incorporation_date,
          ),
          displayName: (r.name as string) ?? input.companyName,
          legalName: r.name as string | undefined,
          domain: undefined, // OC does not provide domain directly
          industry: r.industry_codes as string | undefined,
          hqAddress: firstString(
            address?.street_address,
            address?.address_line_1,
            address?.address_line1,
            r.registered_address_in_full,
          ),
          hqCity: address?.locality as string | undefined,
          hqState: address?.region as string | undefined,
          hqCountry: address?.country as string | undefined,
          identifiers: r.company_number
            ? [{
              identifierType: 'company_number',
              identifierValue: r.company_number as string,
              source: this.name,
            }]
            : undefined,
          rawPayload: r,
        }
      })
    } catch (err) {
      console.warn('[OpenCorporates] Request failed:', err)
      return []
    }
  }
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return undefined
}
