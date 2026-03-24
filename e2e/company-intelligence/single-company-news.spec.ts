import { expect, test, type Page } from '@playwright/test'
import { parseTrpcInput, trpcSuccess } from './test-helpers'

const COMPANY_ID = '11111111-1111-4111-8111-111111111111'
const COMPANY_DETAIL = {
  id: COMPANY_ID,
  displayName: 'Apple Inc.',
  legalName: 'Apple Inc.',
  domain: 'apple.com',
  industry: 'Technology',
  employeeCount: 161000,
  hqAddress: '1 Apple Park Way',
  hqCity: 'Cupertino',
  hqState: 'CA',
  hqCountry: 'US',
  matchTier: 'confident',
  confidenceScore: 96,
  sourceRecords: [
    { provider: 'people_data_labs' },
    { provider: 'sec_edgar' },
  ],
  identifiers: [],
}

async function mockCompanyTrpc(
  page: Page,
  options: {
    initialNews: {
      meta: {
        totalArticles: number
        lastIngestedAt: string | null
        hasUnscoredArticles: boolean
      }
      articles: Array<Record<string, unknown>>
    }
    showAllNews: {
      meta: {
        totalArticles: number
        lastIngestedAt: string | null
        hasUnscoredArticles: boolean
      }
      articles: Array<Record<string, unknown>>
    }
    onStandaloneNewsList?: () => void
  },
) {
  await page.route(/\/trpc\/.+/, async (route) => {
    const url = route.request().url()
    const requestUrl = new URL(url)
    const procedurePath = requestUrl.pathname.split('/trpc/')[1] ?? ''

    const parseBatchInputs = () => {
      const rawInput = requestUrl.searchParams.get('input')
      if (!rawInput) return {} as Record<string, unknown>
      return JSON.parse(rawInput) as Record<string, unknown>
    }

    const responseForProcedure = (procedure: string, input: unknown) => {
      if (procedure === 'company.resolve') {
        return trpcSuccess({
          resolutionInputId: '22222222-2222-4222-8222-222222222222',
          topTier: 'confident',
          candidates: [
            {
              companyId: COMPANY_ID,
              displayName: 'Apple Inc.',
              domain: 'apple.com',
              confidenceScore: 96,
              matchTier: 'confident',
              sourceProviders: ['people_data_labs', 'sec_edgar'],
            },
          ],
        })
      }

      if (procedure === 'company.getById') {
        return trpcSuccess(COMPANY_DETAIL)
      }

      if (procedure === 'news.listByCompany') {
        options.onStandaloneNewsList?.()
        const payload =
          typeof input === 'object'
          && input !== null
          && 'showAll' in input
          && (input as { showAll?: boolean }).showAll
            ? options.showAllNews
            : options.initialNews

        return trpcSuccess({
          companyId: COMPANY_ID,
          meta: payload.meta,
          articles: payload.articles,
        })
      }

      if (procedure === 'news.refreshForCompany') {
        return trpcSuccess({
          companyId: COMPANY_ID,
          articlesIngested: options.showAllNews.articles.length,
          scoresCreated: options.showAllNews.articles.length,
        })
      }

      throw new Error(`Unhandled tRPC procedure in test: ${procedure}`)
    }

    if (procedurePath.includes(',')) {
      const procedures = procedurePath.split(',')
      const inputs = parseBatchInputs()

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          procedures.map((procedure, index) =>
            responseForProcedure(procedure, inputs[String(index)]),
          ),
        ),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(responseForProcedure(procedurePath, parseTrpcInput(url))),
    })
  })
}

test('single-company resolve opens the company detail view and shows address plus scored news', async ({ page }) => {
  let newsListCalls = 0

  await mockCompanyTrpc(page, {
    initialNews: {
      meta: {
        totalArticles: 2,
        lastIngestedAt: '2026-03-24T00:00:00.000Z',
        hasUnscoredArticles: false,
      },
      articles: [
        {
          articleId: 'article-1',
          title: 'Apple expands supply chain',
          source: 'Example News',
          publishedAt: '2026-03-24T00:00:00.000Z',
          url: 'https://example.com/apple-expands',
          snippet: 'Expansion continues across the supply chain.',
          relevancyScore: 92,
          category: 'market_expansion',
          explanation: 'Expansion supports services growth.',
        },
      ],
    },
    showAllNews: {
      meta: {
        totalArticles: 2,
        lastIngestedAt: '2026-03-24T00:00:00.000Z',
        hasUnscoredArticles: false,
      },
      articles: [
        {
          articleId: 'article-1',
          title: 'Apple expands supply chain',
          source: 'Example News',
          publishedAt: '2026-03-24T00:00:00.000Z',
          url: 'https://example.com/apple-expands',
          snippet: 'Expansion continues across the supply chain.',
          relevancyScore: 92,
          category: 'market_expansion',
          explanation: 'Expansion supports services growth.',
        },
        {
          articleId: 'article-2',
          title: 'Supplier filing rumor',
          source: 'Trade Journal',
          publishedAt: '2026-03-23T00:00:00.000Z',
          url: 'https://example.com/supplier-rumor',
          snippet: 'A low-signal rumor with limited direct impact.',
          relevancyScore: 18,
          category: 'industry_sector',
          explanation: 'Mention is indirect and low relevance.',
        },
      ],
    },
    onStandaloneNewsList: () => {
      newsListCalls += 1
    },
  })

  await page.goto('/')

  await page.getByPlaceholder('e.g. Apple Inc.').fill('Apple Inc.')
  await page.getByPlaceholder('e.g. apple.com').fill('apple.com')
  await page.getByPlaceholder('1 Apple Park Way').fill('1 Apple Park Way')
  await page.getByRole('button', { name: 'Resolve Company' }).click()

  await expect(page.getByText('Confident Match Found')).toBeVisible()
  await expect(page.getByText('Apple Inc.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'View Company Details' })).toBeVisible()

  await page.getByRole('button', { name: 'View Company Details' }).click()

  await expect(page).toHaveURL(new RegExp(`/company/${COMPANY_ID}$`))
  await expect(page.getByRole('heading', { name: 'Apple Inc.' })).toBeVisible()
  await expect(page.getByText('161,000')).toBeVisible()
  await expect(page.getByText('1 Apple Park Way, Cupertino, CA, US')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Apple expands supply chain' })).toBeVisible()
  await expect(page.getByText('Expansion supports services growth.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Supplier filing rumor' })).toHaveCount(0)

  await page.getByLabel('Show low-relevance').check()

  await expect(page.getByRole('link', { name: 'Supplier filing rumor' })).toBeVisible()
  expect(newsListCalls).toBeGreaterThanOrEqual(2)
})

test('detail view exposes low-relevance articles even when the default filtered list is empty', async ({ page }) => {
  await mockCompanyTrpc(page, {
    initialNews: {
      meta: {
        totalArticles: 1,
        lastIngestedAt: '2026-03-24T00:00:00.000Z',
        hasUnscoredArticles: false,
      },
      articles: [],
    },
    showAllNews: {
      meta: {
        totalArticles: 1,
        lastIngestedAt: '2026-03-24T00:00:00.000Z',
        hasUnscoredArticles: false,
      },
      articles: [
        {
          articleId: 'article-2',
          title: 'Supplier filing rumor',
          source: 'Trade Journal',
          publishedAt: '2026-03-23T00:00:00.000Z',
          url: 'https://example.com/supplier-rumor',
          snippet: 'A low-signal rumor with limited direct impact.',
          relevancyScore: 18,
          category: 'industry_sector',
          explanation: 'Mention is indirect and low relevance.',
        },
      ],
    },
  })

  await page.goto('/')

  await page.getByPlaceholder('e.g. Apple Inc.').fill('Apple Inc.')
  await page.getByRole('button', { name: 'Resolve Company' }).click()

  await expect(page).toHaveURL(new RegExp(`/company/${COMPANY_ID}$`))
  await expect(page.getByText('All fetched articles are hidden by the low-relevance filter.')).toBeVisible()
  await expect(page.getByLabel('Show low-relevance')).toBeVisible()

  await page.getByLabel('Show low-relevance').check()

  await expect(page.getByRole('link', { name: 'Supplier filing rumor' })).toBeVisible()
})
