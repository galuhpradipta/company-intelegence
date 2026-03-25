import OpenAI from 'openai'
import pLimit from 'p-limit'
import { z } from 'zod'
import { db } from '../../db/client.js'
import { articleRelevancyScores, companyArticles, newsArticles, companies } from '../../db/schema/index.js'
import { and, eq } from 'drizzle-orm'
import { env } from '../../env.js'
import { getMockArticleScore } from '../../testing/mock-fixtures.js'
import { buildRelevancyPrompt } from './prompt-builder.js'
import { getDefaultViewerCompanyProfile, type ViewerCompanyProfile } from './viewer-company-profile.js'

export const PROMPT_VERSION = 'v3'
const CONCURRENCY = 5
const MAX_RETRIES = 2

const CATEGORIES = [
  'financial_performance',
  'litigation_legal',
  'leadership_change',
  'operational_risk',
  'market_expansion',
  'industry_sector',
] as const

type Category = typeof CATEGORIES[number]

const relevancyOutputSchema = z.object({
  relevancyScore: z.number().int().min(0).max(100),
  category: z.enum(CATEGORIES),
  explanation: z.string().max(160),
})

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY })

export interface CompanyProfileSummary {
  displayName: string
  legalName?: string | null
  industry?: string | null
  employeeCount?: number | null
  hqCity?: string | null
  hqCountry?: string | null
}

export interface RelevancyArticleInput {
  articleId?: string
  title: string
  snippet?: string | null
  fullText?: string | null
}

export interface ArticleScore {
  articleId: string
  relevancyScore: number
  category: Category
  explanation: string
}

async function scoreOneArticle(
  companyContext: CompanyProfileSummary,
  article: { id: string; title: string; snippet?: string | null; fullText?: string | null },
  viewerCompanyOverride?: ViewerCompanyProfile,
  retryCount = 0
): Promise<ArticleScore | null> {
  const viewerCompany = viewerCompanyOverride ?? await getDefaultViewerCompanyProfile()

  if (env.COMPANY_INTELLIGENCE_MOCK_EXTERNAL_PROVIDERS) {
    const mockScore = getMockArticleScore(article, viewerCompany)
    return {
      articleId: article.id,
      relevancyScore: mockScore.relevancyScore,
      category: mockScore.category,
      explanation: mockScore.explanation,
    }
  }

  const articleText = article.fullText ?? article.snippet ?? article.title

  const prompt = buildRelevancyPrompt({
    companyContext,
    article: {
      title: article.title,
      text: articleText.slice(0, 1000),
    },
    viewerCompany,
  })

  try {
    const response = await client.responses.create({
      model: env.OPENAI_MODEL,
      input: prompt,
      text: {
        format: {
          type: 'json_schema',
          name: 'relevancy_score',
          schema: {
            type: 'object',
            properties: {
              relevancyScore: { type: 'integer', minimum: 0, maximum: 100 },
              category: { type: 'string', enum: CATEGORIES },
              explanation: { type: 'string' },
            },
            required: ['relevancyScore', 'category', 'explanation'],
            additionalProperties: false,
          },
          strict: true,
        },
      },
    })

    const text = response.output_text
    const parsed = relevancyOutputSchema.parse(JSON.parse(text))

    return {
      articleId: article.id,
      relevancyScore: parsed.relevancyScore,
      category: parsed.category,
      explanation: parsed.explanation.slice(0, 160),
    }
  } catch (err) {
    if (retryCount < MAX_RETRIES) {
      const delay = Math.pow(2, retryCount) * 500
      await new Promise((r) => setTimeout(r, delay))
      return scoreOneArticle(companyContext, article, viewerCompanyOverride, retryCount + 1)
    }
    console.warn(`[Relevancy] Failed to score article ${article.id}:`, err)
    return null
  }
}

export async function scoreArticleForProfile(
  companyContext: CompanyProfileSummary,
  article: RelevancyArticleInput,
  viewerCompany?: ViewerCompanyProfile,
): Promise<ArticleScore | null> {
  return scoreOneArticle(companyContext, {
    id: article.articleId ?? crypto.randomUUID(),
    title: article.title,
    snippet: article.snippet,
    fullText: article.fullText,
  }, viewerCompany)
}

export async function scoreArticleBatchForProfile(
  companyContext: CompanyProfileSummary,
  articles: RelevancyArticleInput[],
  viewerCompany?: ViewerCompanyProfile,
): Promise<Array<ArticleScore | null>> {
  const limit = pLimit(CONCURRENCY)

  return Promise.all(
    articles.map((article) =>
      limit(() => scoreArticleForProfile(companyContext, article, viewerCompany))
    )
  )
}

export async function scoreArticlesForCompany(
  companyId: string,
  viewerCompany?: ViewerCompanyProfile,
  options?: { forceRescore?: boolean },
): Promise<ArticleScore[]> {
  const [company] = await db
    .select({
      id: companies.id,
      displayName: companies.displayName,
      legalName: companies.legalName,
      industry: companies.industry,
      employeeCount: companies.employeeCount,
      hqCity: companies.hqCity,
      hqCountry: companies.hqCountry,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1)

  if (!company) throw new Error(`Company ${companyId} not found`)

  const rows = await db
    .select({
      articleId: newsArticles.id,
      title: newsArticles.title,
      snippet: newsArticles.snippet,
      fullText: newsArticles.fullText,
      scoreStatus: articleRelevancyScores.status,
      promptVersion: articleRelevancyScores.promptVersion,
    })
    .from(companyArticles)
    .innerJoin(newsArticles, eq(companyArticles.articleId, newsArticles.id))
    .leftJoin(
      articleRelevancyScores,
      and(
        eq(articleRelevancyScores.companyId, companyId),
        eq(articleRelevancyScores.articleId, companyArticles.articleId),
      ),
    )
    .where(eq(companyArticles.companyId, companyId))

  if (rows.length === 0) return []

  const articlesById = new Map<string, {
    id: string
    title: string
    snippet: string | null
    fullText: string | null
    scoreStatus: string | null
    promptVersion: string | null
  }>()

  for (const row of rows) {
    const existing = articlesById.get(row.articleId)

    if (!existing) {
      articlesById.set(row.articleId, {
        id: row.articleId,
        title: row.title,
        snippet: row.snippet,
        fullText: row.fullText,
        scoreStatus: row.scoreStatus,
        promptVersion: row.promptVersion,
      })
      continue
    }

    if (getScoreStatusPriority(row.scoreStatus) > getScoreStatusPriority(existing.scoreStatus)) {
      existing.scoreStatus = row.scoreStatus
    }
  }

  const validArticles = [...articlesById.values()].filter(
    (article) => options?.forceRescore || article.scoreStatus !== 'scored' || article.promptVersion !== PROMPT_VERSION,
  )

  if (validArticles.length === 0) return []

  const limit = pLimit(CONCURRENCY)
  const results = await Promise.all(
    validArticles.map((article) =>
      limit(async () => {
        const score = await scoreOneArticle(company, article, viewerCompany)
        if (!score) {
          // Persist failed score
          await db
            .insert(articleRelevancyScores)
            .values({
              companyId,
              articleId: article.id,
              model: env.OPENAI_MODEL,
              promptVersion: PROMPT_VERSION,
              status: 'failed',
            })
            .onConflictDoUpdate({
              target: [articleRelevancyScores.companyId, articleRelevancyScores.articleId],
              set: {
                model: env.OPENAI_MODEL,
                promptVersion: PROMPT_VERSION,
                status: 'failed',
                relevancyScore: null,
                category: null,
                explanation: null,
                scoredAt: null,
              },
            })
          return null
        }

        // Persist scored result
        await db
          .insert(articleRelevancyScores)
          .values({
            companyId,
            articleId: article.id,
            model: env.OPENAI_MODEL,
            promptVersion: PROMPT_VERSION,
            relevancyScore: score.relevancyScore,
            category: score.category,
            explanation: score.explanation,
            status: 'scored',
            scoredAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [articleRelevancyScores.companyId, articleRelevancyScores.articleId],
            set: {
              model: env.OPENAI_MODEL,
              promptVersion: PROMPT_VERSION,
              relevancyScore: score.relevancyScore,
              category: score.category,
              explanation: score.explanation,
              status: 'scored',
              scoredAt: new Date(),
            },
          })

        return score
      })
    )
  )

  return results.filter(Boolean) as ArticleScore[]
}

function getScoreStatusPriority(status: string | null): number {
  if (status === 'scored') return 2
  if (status === 'failed') return 1
  return 0
}
