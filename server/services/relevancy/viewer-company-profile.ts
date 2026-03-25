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
      input: `Write a concise 1-2 sentence company profile for downstream business-news prompting.

Company name: ${profile.name}
Domain: ${profile.domain}
Role/function consuming the output: ${profile.roleFunction}

Focus on what a finance and AR team would care about. Keep it high-level and do not invent exact metrics.`,
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
  return `${profile.name} uses ${profile.domain} and needs finance and AR visibility into customer health, payment timing, collections exposure, and cash-flow risk.`
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
