import { expect, test, type Page } from '@playwright/test'
import { parseTrpcInput, trpcSuccess } from './test-helpers'

const COMPANY_ID = '11111111-1111-4111-8111-111111111111'
const RECENT_INGESTED_AT = '2099-01-01T00:00:00.000Z'
const VIEWER_COMPANY_PROFILE = {
  name: 'Merclex',
  domain: 'merclex.example',
  roleFunction: 'Finance Manager / AR Manager',
  description: 'Merclex is a company operating through merclex.example. For finance/AR relevance, key exposure areas are customer exposure, payment timing, collections pressure, cash-flow sensitivity, operational dependency, and legal/regulatory risk.',
}
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

type NewsPayload = {
  meta: {
    totalArticles: number
    lastIngestedAt: string | null
    hasUnscoredArticles: boolean
  }
  articles: Array<Record<string, unknown>>
}

async function mockCompanyTrpc(
  page: Page,
  options: {
    initialNews: NewsPayload
    showAllNews?: NewsPayload
    refreshedNews?: NewsPayload
    onStandaloneNewsList?: () => void
    onRefreshInput?: (input: unknown) => void
    generatedDescription?: string
  },
) {
  let didRefresh = false

  await page.route(/\/trpc\/.+/, async (route) => {
    const url = route.request().url()
    const requestUrl = new URL(url)
    const procedurePath = requestUrl.pathname.split('/trpc/')[1] ?? ''

    const parseInputs = () => {
      const rawInput = requestUrl.searchParams.get('input') ?? route.request().postData()
      if (!rawInput) return {} as Record<string, unknown>
      return JSON.parse(rawInput) as Record<string, unknown>
    }

    const parseSingleInput = () => {
      const parsed = parseInputs()
      if (typeof parsed === 'object' && parsed !== null && '0' in parsed) {
        return (parsed as Record<string, unknown>)['0']
      }

      return parsed
    }

    const responseForProcedure = (procedure: string, input: unknown) => {
      if (procedure === 'relevancy.viewerCompanyProfile') {
        return trpcSuccess(VIEWER_COMPANY_PROFILE)
      }

      if (procedure === 'relevancy.generateViewerCompanyDescription') {
        const profileInput = typeof input === 'object' && input !== null
          ? input as Partial<typeof VIEWER_COMPANY_PROFILE>
          : undefined

        const name = profileInput?.name ?? VIEWER_COMPANY_PROFILE.name
        const domain = profileInput?.domain ?? VIEWER_COMPANY_PROFILE.domain

        return trpcSuccess({
          description: options.generatedDescription
            ?? `${name} is a company operating through ${domain}. For finance/AR relevance, key exposure areas are customer exposure, payment timing, collections pressure, cash-flow sensitivity, operational dependency, and legal/regulatory risk.`,
        })
      }

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
        const refreshedPayload = options.refreshedNews ?? options.initialNews
        const payload =
          typeof input === 'object'
          && input !== null
          && 'showAll' in input
          && (input as { showAll?: boolean }).showAll
            ? options.showAllNews ?? refreshedPayload
            : didRefresh
              ? refreshedPayload
              : options.initialNews

        return trpcSuccess({
          companyId: COMPANY_ID,
          meta: payload.meta,
          articles: payload.articles,
        })
      }

      if (procedure === 'news.refreshForCompany') {
        didRefresh = true
        options.onRefreshInput?.(input)
        const refreshedPayload = options.refreshedNews ?? options.showAllNews ?? options.initialNews

        return trpcSuccess({
          companyId: COMPANY_ID,
          articlesIngested: refreshedPayload.articles.length,
          scoresCreated: refreshedPayload.articles.length,
        })
      }

      throw new Error(`Unhandled tRPC procedure in test: ${procedure}`)
    }

    if (procedurePath.includes(',')) {
      const procedures = procedurePath.split(',')
      const inputs = parseInputs()

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
      body: JSON.stringify(responseForProcedure(procedurePath, parseSingleInput() ?? parseTrpcInput(url))),
    })
  })
}

test('single-company resolve opens the company detail view and shows address plus scored news', async ({ page }) => {
  let newsListCalls = 0

  await mockCompanyTrpc(page, {
    initialNews: {
      meta: {
        totalArticles: 2,
        lastIngestedAt: RECENT_INGESTED_AT,
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
        lastIngestedAt: RECENT_INGESTED_AT,
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

  const viewerCompanySection = page.getByRole('region', { name: 'My Company Context' })
  await expect(viewerCompanySection).toBeVisible()
  await expect(viewerCompanySection.getByText('Merclex', { exact: true })).toBeVisible()
  await expect(viewerCompanySection.getByText('merclex.example')).toBeVisible()
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
        lastIngestedAt: RECENT_INGESTED_AT,
        hasUnscoredArticles: false,
      },
      articles: [],
    },
    showAllNews: {
      meta: {
        totalArticles: 1,
        lastIngestedAt: RECENT_INGESTED_AT,
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

  await expect(page.getByRole('region', { name: 'My Company Context' })).toBeVisible()
  await page.getByPlaceholder('e.g. Apple Inc.').fill('Apple Inc.')
  await page.getByRole('button', { name: 'Resolve Company' }).click()

  await expect(page).toHaveURL(new RegExp(`/company/${COMPANY_ID}$`))
  await expect(page.getByText('All fetched articles are hidden by the low-relevance filter.')).toBeVisible()
  await expect(page.getByLabel('Show low-relevance')).toBeVisible()

  await page.getByLabel('Show low-relevance').check()

  await expect(page.getByRole('link', { name: 'Supplier filing rumor' })).toBeVisible()
})

test('input page saves my company locally and restores it after reload', async ({ page }) => {
  await mockCompanyTrpc(page, {
    initialNews: {
      meta: {
        totalArticles: 0,
        lastIngestedAt: RECENT_INGESTED_AT,
        hasUnscoredArticles: false,
      },
      articles: [],
    },
  })

  await page.goto('/')

  const viewerCompanySection = page.getByRole('region', { name: 'My Company Context' })
  await viewerCompanySection.getByRole('button', { name: /My Company Context/i }).click()
  await viewerCompanySection.getByLabel('Company Name').fill('Northwind Credit')
  await viewerCompanySection.getByLabel('Domain').fill('northwind.test')
  await viewerCompanySection.getByLabel('Company Summary').fill('Northwind Credit tracks customer payment timing, collections pressure, and cash-flow exposure.')
  await viewerCompanySection.getByRole('button', { name: 'Save Locally' }).click()

  await expect(page.getByRole('status')).toContainText('Saved in this browser')

  await page.reload()

  const reloadedViewerCompanySection = page.getByRole('region', { name: 'My Company Context' })
  await reloadedViewerCompanySection.getByRole('button', { name: /My Company Context/i }).click()
  await expect(reloadedViewerCompanySection.getByLabel('Company Name')).toHaveValue('Northwind Credit')
  await expect(reloadedViewerCompanySection.getByLabel('Domain')).toHaveValue('northwind.test')
  await expect(reloadedViewerCompanySection.getByLabel('Company Summary')).toHaveValue('Northwind Credit tracks customer payment timing, collections pressure, and cash-flow exposure.')
})

test('opening a company detail page auto-refreshes news with the saved browser profile', async ({ page }) => {
  let refreshInput: unknown = null

  await mockCompanyTrpc(page, {
    initialNews: {
      meta: {
        totalArticles: 1,
        lastIngestedAt: RECENT_INGESTED_AT,
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
    refreshedNews: {
      meta: {
        totalArticles: 1,
        lastIngestedAt: RECENT_INGESTED_AT,
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
          explanation: 'For Northwind Credit, the expansion raises customer exposure and payment-timing risk that a finance and AR lead should monitor closely.',
        },
      ],
    },
    onRefreshInput: (input) => {
      refreshInput = input
    },
  })

  await page.goto('/')

  const viewerCompanySection = page.getByRole('region', { name: 'My Company Context' })
  await viewerCompanySection.getByRole('button', { name: /My Company Context/i }).click()
  await viewerCompanySection.getByLabel('Company Name').fill('Northwind Credit')
  await viewerCompanySection.getByLabel('Domain').fill('northwind.test')
  await viewerCompanySection.getByLabel('Company Summary').fill('Northwind Credit needs finance and AR guidance on customer exposure, collections pressure, and payment timing.')
  await viewerCompanySection.getByRole('button', { name: 'Save Locally' }).click()
  await expect(page.getByRole('status')).toContainText('Saved in this browser')

  await page.getByPlaceholder('e.g. Apple Inc.').fill('Apple Inc.')
  await page.getByRole('button', { name: 'Resolve Company' }).click()
  await page.getByRole('button', { name: 'View Company Details' }).click()

  await expect(page).toHaveURL(new RegExp(`/company/${COMPANY_ID}$`))
  await expect(page.getByText('For Northwind Credit, the expansion raises customer exposure and payment-timing risk that a finance and AR lead should monitor closely.')).toBeVisible()
  expect(refreshInput).toEqual({
    companyId: COMPANY_ID,
    viewerCompanyProfile: {
      name: 'Northwind Credit',
      domain: 'northwind.test',
      roleFunction: 'Finance Manager / AR Manager',
      description: 'Northwind Credit needs finance and AR guidance on customer exposure, collections pressure, and payment timing.',
    },
  })
})

test('saving my company on the detail page refreshes news immediately', async ({ page }) => {
  let refreshInput: unknown = null

  await mockCompanyTrpc(page, {
    initialNews: {
      meta: {
        totalArticles: 1,
        lastIngestedAt: RECENT_INGESTED_AT,
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
    refreshedNews: {
      meta: {
        totalArticles: 1,
        lastIngestedAt: RECENT_INGESTED_AT,
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
          explanation: 'For Contoso Receivables, the expansion affects collections forecasting, customer limits, and expected payment timing.',
        },
      ],
    },
    onRefreshInput: (input) => {
      refreshInput = input
    },
  })

  await page.goto('/')
  await page.getByPlaceholder('e.g. Apple Inc.').fill('Apple Inc.')
  await page.getByRole('button', { name: 'Resolve Company' }).click()
  await page.getByRole('button', { name: 'View Company Details' }).click()

  await expect(page).toHaveURL(new RegExp(`/company/${COMPANY_ID}$`))

  const detailViewerCompanySection = page.getByRole('region', { name: 'My Company Context' })
  await detailViewerCompanySection.getByLabel('Company Name').fill('Contoso Receivables')
  await detailViewerCompanySection.getByLabel('Domain').fill('contoso.test')
  await detailViewerCompanySection.getByLabel('Company Summary').fill('Contoso Receivables manages collections operations, credit exposure, and cash-flow planning.')
  await detailViewerCompanySection.getByRole('button', { name: 'Save & Refresh News' }).click()

  await expect(detailViewerCompanySection.getByText('Saved in this browser and applied to the current company.')).toBeVisible()
  await expect(page.getByText('For Contoso Receivables, the expansion affects collections forecasting, customer limits, and expected payment timing.')).toBeVisible()
  expect(refreshInput).toEqual({
    companyId: COMPANY_ID,
    viewerCompanyProfile: {
      name: 'Contoso Receivables',
      domain: 'contoso.test',
      roleFunction: 'Finance Manager / AR Manager',
      description: 'Contoso Receivables manages collections operations, credit exposure, and cash-flow planning.',
    },
  })
})
