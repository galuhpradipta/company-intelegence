import OpenAI from 'openai'
import { z } from 'zod'
import { env } from '../../env.js'

export const viewerCompanyProfileSeedSchema = z.object({
  name: z.string().min(1),
  domain: z.string().min(1),
  roleFunction: z.string().min(1),
  description: z.string().optional(),
})

export const viewerCompanyProfileSchema = viewerCompanyProfileSeedSchema.extend({
  description: z.string().min(1),
})

export type ViewerCompanyProfileSeed = z.infer<typeof viewerCompanyProfileSeedSchema>
export type ViewerCompanyProfile = z.infer<typeof viewerCompanyProfileSchema>

export const DEFAULT_VIEWER_COMPANY_PROFILE_SEED: ViewerCompanyProfileSeed = {
  name: 'Merclex',
  domain: 'merclex.example',
  roleFunction: 'Finance Manager / AR Manager',
}

let cachedDefaultViewerCompanyProfile: ViewerCompanyProfile | null = null

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY })

export async function getDefaultViewerCompanyProfile(): Promise<ViewerCompanyProfile> {
  if (cachedDefaultViewerCompanyProfile) {
    return { ...cachedDefaultViewerCompanyProfile }
  }

  const profileSeed = { ...DEFAULT_VIEWER_COMPANY_PROFILE_SEED }
  const description = profileSeed.description?.trim()
    ? profileSeed.description.trim()
    : shouldUseDeterministicDescription()
      ? buildDeterministicViewerCompanyDescription(profileSeed)
      : await generateViewerCompanyDescription(profileSeed)

  cachedDefaultViewerCompanyProfile = {
    ...profileSeed,
    description,
  }

  return { ...cachedDefaultViewerCompanyProfile }
}

export async function generateViewerCompanyDescription(profile: ViewerCompanyProfileSeed): Promise<string> {
  try {
    const response = await client.responses.create({
      model: env.OPENAI_MODEL,
      input: buildViewerCompanyDescriptionPrompt(profile),
    })

    const normalized = normalizeDescription(response.output_text)
    return normalized || buildDeterministicViewerCompanyDescription(profile)
  } catch (err) {
    console.warn('[ViewerCompanyProfile] Failed to generate AI description:', err)
    return buildDeterministicViewerCompanyDescription(profile)
  }
}

export function resetDefaultViewerCompanyProfileCache() {
  cachedDefaultViewerCompanyProfile = null
}

export function buildDeterministicViewerCompanyDescription(profile: ViewerCompanyProfileSeed): string {
  return `${profile.name} is a company operating through ${profile.domain}. For finance/AR relevance, key exposure areas are customer exposure, payment timing, collections pressure, cash-flow sensitivity, operational dependency, and legal/regulatory risk.`
}

function shouldUseDeterministicDescription(): boolean {
  return env.NODE_ENV === 'test' || Boolean(env.COMPANY_INTELLIGENCE_MOCK_EXTERNAL_PROVIDERS)
}

function normalizeDescription(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240)
}

function buildViewerCompanyDescriptionPrompt(profile: ViewerCompanyProfileSeed): string {
  return `Write a concise company summary for downstream finance/AR news relevancy prompting.

Company name: ${profile.name}
Domain: ${profile.domain}
Role/function consuming the output: ${profile.roleFunction}

Return exactly 2 short sentences and no bullets.
Sentence 1: only include stable company or business-model context if it is clear with high confidence from the company name and domain. If it is unclear, use conservative wording like "${profile.name} is a company operating through ${profile.domain}."
Sentence 2: begin with "For finance/AR relevance, key exposure areas are" and describe reusable cues such as customer exposure, payment timing, collections pressure, cash-flow sensitivity, operational dependency, and legal/regulatory risk.

Do not use marketing language or slogans.
Do not invent exact metrics, dates, recent claims, or named customers, products, or geographies unless they are directly obvious from the company name or domain.
Do not speculate. When uncertain, stay generic, durable, and useful for later relevancy analysis.
Keep the total output under 240 characters.
Return plain text only.`
}
