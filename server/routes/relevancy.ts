import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { scoreArticleBatchForProfile, scoreArticleForProfile } from '../services/relevancy/index.js'

export const relevancyRoute = new Hono()

const companyProfileSchema = z.object({
  displayName: z.string().min(1).optional(),
  companyName: z.string().min(1).optional(),
  legalName: z.string().optional(),
  industry: z.string().optional(),
  employeeCount: z.number().int().optional(),
  hqCity: z.string().optional(),
  hqCountry: z.string().optional(),
}).refine((value) => Boolean(value.displayName || value.companyName), {
  message: 'displayName or companyName is required',
})

const articleSchema = z.object({
  articleId: z.string().optional(),
  title: z.string().min(1),
  snippet: z.string().optional(),
  fullText: z.string().optional(),
})

relevancyRoute.post(
  '/score',
  zValidator('json', z.object({
    company: companyProfileSchema,
    article: articleSchema,
  })),
  async (c) => {
    const { company, article } = c.req.valid('json')
    const score = await scoreArticleForProfile(
      {
        displayName: company.displayName ?? company.companyName!,
        legalName: company.legalName,
        industry: company.industry,
        employeeCount: company.employeeCount,
        hqCity: company.hqCity,
        hqCountry: company.hqCountry,
      },
      article,
    )

    if (!score) {
      return c.json({ error: 'Failed to score article' }, 502)
    }

    return c.json({
      relevancyScore: score.relevancyScore,
      category: score.category,
      explanation: score.explanation,
    })
  },
)

relevancyRoute.post(
  '/batch',
  zValidator('json', z.object({
    company: companyProfileSchema,
    articles: z.array(articleSchema).min(1),
  })),
  async (c) => {
    const { company, articles } = c.req.valid('json')
    const scores = await scoreArticleBatchForProfile(
      {
        displayName: company.displayName ?? company.companyName!,
        legalName: company.legalName,
        industry: company.industry,
        employeeCount: company.employeeCount,
        hqCity: company.hqCity,
        hqCountry: company.hqCountry,
      },
      articles,
    )

    return c.json({
      scores: scores.map((score, index) => ({
        articleId: articles[index].articleId ?? null,
        relevancyScore: score?.relevancyScore ?? null,
        category: score?.category ?? null,
        explanation: score?.explanation ?? null,
      })),
    })
  },
)
