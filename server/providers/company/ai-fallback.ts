import OpenAI from 'openai'
import type { CompanyProvider, CandidateCompany, NormalizedInput } from './types.js'
import { env } from '../../env.js'
import { z } from 'zod'

export const aiFallbackResponseSchema = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          displayName: { type: 'string' },
          legalName: { type: 'string' },
          domain: { type: 'string' },
          industry: { type: 'string' },
          hqCity: { type: 'string' },
          hqState: { type: 'string' },
          hqCountry: { type: 'string' },
          confidence: { type: 'number' },
        },
        required: ['displayName', 'legalName', 'domain', 'industry', 'hqCity', 'hqState', 'hqCountry', 'confidence'],
        additionalProperties: false,
      },
    },
  },
  required: ['candidates'],
  additionalProperties: false,
} as const

const candidateSchema = z.object({
  candidates: z.array(
    z.object({
      displayName: z.string(),
      legalName: z.string(),
      domain: z.string(),
      industry: z.string(),
      hqCity: z.string(),
      hqState: z.string(),
      hqCountry: z.string(),
      confidence: z.number().min(0).max(100),
    })
  ),
})

export function normalizeOptionalText(value: string): string | undefined {
  const normalized = value.trim()
  return normalized ? normalized : undefined
}

/**
 * AI fallback provider — used when deterministic providers return no results.
 * Uses the lower reliability factor (0.6) and cannot auto-promote to confident
 * without a hard signal (domain or legal-name match).
 */
export class AiFallbackProvider implements CompanyProvider {
  name = 'ai_fallback'
  reliabilityFactor = 0.6

  private client = new OpenAI({ apiKey: env.OPENAI_API_KEY })

  async search(input: NormalizedInput): Promise<CandidateCompany[]> {
    try {
      const response = await this.client.responses.create({
        model: env.OPENAI_FALLBACK_MODEL,
        input: `You are a company data researcher. Based on the following signals, identify the most likely company matches.

Company name: ${input.companyName}
${input.domain ? `Domain: ${input.domain}` : ''}
${input.city ? `City: ${input.city}` : ''}
${input.country ? `Country: ${input.country}` : ''}
${input.industry ? `Industry: ${input.industry}` : ''}

Return up to 3 candidate matches with confidence scores (0-100). Only include companies you are highly confident about.
Use empty strings for any unknown string field.`,
        text: {
          format: {
            type: 'json_schema',
            name: 'company_candidates',
            schema: aiFallbackResponseSchema,
            strict: true,
          },
        },
      })

      const text = response.output_text
      const parsed = candidateSchema.parse(JSON.parse(text))

      return parsed.candidates.map((c) => ({
        providerName: this.name,
        displayName: c.displayName,
        legalName: normalizeOptionalText(c.legalName),
        domain: normalizeOptionalText(c.domain),
        industry: normalizeOptionalText(c.industry),
        hqCity: normalizeOptionalText(c.hqCity),
        hqState: normalizeOptionalText(c.hqState),
        hqCountry: normalizeOptionalText(c.hqCountry),
        rawPayload: c as Record<string, unknown>,
      }))
    } catch (err) {
      console.warn('[AiFallback] Failed:', err)
      return []
    }
  }
}
