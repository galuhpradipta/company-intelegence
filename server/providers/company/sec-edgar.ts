import type { CompanyProvider, CandidateCompany, NormalizedInput } from './types.js'
import { env } from '../../env.js'

/**
 * SEC EDGAR company search provider.
 * Completely free, no API key required.
 * US-only, registry-level data: legal name, CIK, state of incorporation, SIC industry.
 * EDGAR requires a descriptive User-Agent per their fair-use policy.
 */
export class SecEdgarProvider implements CompanyProvider {
  name = 'sec_edgar'
  reliabilityFactor = 1.0

  async search(input: NormalizedInput): Promise<CandidateCompany[]> {
    const params = new URLSearchParams({
      company: input.companyName,
      CIK: '',
      type: '10-K',
      dateb: '',
      owner: 'include',
      count: '10',
      search_text: '',
      action: 'getcompany',
      output: 'atom',
    })

    const url = `https://www.sec.gov/cgi-bin/browse-edgar?${params}`

    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(env.PROVIDER_TIMEOUT_MS),
        headers: {
          // EDGAR fair-use policy requires identifying User-Agent
          'User-Agent': 'merclex-company-intelligence contact@merclex.com',
          Accept: 'application/atom+xml',
        },
      })

      if (!res.ok) {
        console.warn(`[SecEdgar] API error ${res.status}`)
        return []
      }

      const xml = await res.text()
      return parseEdgarAtom(xml)
    } catch (err) {
      console.warn('[SecEdgar] Request failed:', err)
      return []
    }
  }
}

function extractTag(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]+)<\\/${tag}>`))
  return match?.[1]?.trim() || undefined
}

function parseEdgarAtom(xml: string): CandidateCompany[] {
  const results: CandidateCompany[] = []
  const seen = new Set<string>()

  // Each <entry> block in the EDGAR Atom feed represents one matching company
  const entries = xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)

  for (const [, entry] of entries) {
    const legalName = extractTag(entry, 'company-name')
    const cik = extractTag(entry, 'cik')

    if (!legalName) continue

    // Deduplicate by CIK — multiple 10-K filings may appear for the same company
    const key = cik ?? legalName
    if (seen.has(key)) continue
    seen.add(key)

    const stateOfInc = extractTag(entry, 'state-of-inc')
    const sicDesc = extractTag(entry, 'assigned-sic-desc')
    const ein = extractTag(entry, 'ein')

    results.push({
      providerName: 'sec_edgar',
      providerRecordId: cik,
      displayName: legalName,
      legalName,
      industry: sicDesc,
      hqState: stateOfInc,
      hqCountry: 'US',
      rawPayload: { legalName, cik, stateOfInc, sicDesc, ein },
    })

    if (results.length >= 5) break
  }

  return results
}
