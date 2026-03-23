import { expect, test } from '@playwright/test'
import { parseTrpcInput, trpcSuccess } from './test-helpers'

const COMPANY_ID = '11111111-1111-4111-8111-111111111111'

test('single-company resolve opens the company detail view and shows scored news', async ({ page }) => {
  let newsFetchCalls = 0
  let relevancyCalls = 0
  let newsListCalls = 0

  await page.route('**/trpc/company.resolve**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(trpcSuccess({
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
      })),
    })
  })

  await page.route('**/trpc/company.getById**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(trpcSuccess({
        id: COMPANY_ID,
        displayName: 'Apple Inc.',
        legalName: 'Apple Inc.',
        domain: 'apple.com',
        industry: 'Technology',
        employeeCount: 161000,
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
      })),
    })
  })

  await page.route('**/trpc/news.fetchForCompany**', async (route) => {
    newsFetchCalls += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(trpcSuccess({
        companyId: COMPANY_ID,
        fetched: 1,
      })),
    })
  })

  await page.route('**/trpc/relevancy.scoreForCompany**', async (route) => {
    relevancyCalls += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(trpcSuccess({
        companyId: COMPANY_ID,
        scored: 1,
      })),
    })
  })

  await page.route('**/trpc/news.listByCompany**', async (route) => {
    newsListCalls += 1
    const input = parseTrpcInput<{ companyId: string; showAll: boolean }>(route.request().url())

    const articles = input?.showAll
      ? [
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
        ]
      : [
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
        ]

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(trpcSuccess({
        companyId: COMPANY_ID,
        articles,
      })),
    })
  })

  await page.goto('/')

  await page.getByPlaceholder('e.g. Apple Inc.').fill('Apple Inc.')
  await page.getByPlaceholder('e.g. apple.com').fill('apple.com')
  await page.getByPlaceholder('1 Apple Park Way').fill('1 Apple Park Way')
  await page.getByRole('button', { name: 'Resolve Company' }).click()

  await expect(page).toHaveURL(new RegExp(`/company/${COMPANY_ID}$`))
  await expect(page.getByRole('heading', { name: 'Apple Inc.' })).toBeVisible()
  await expect(page.getByText('161,000')).toBeVisible()
  await expect(page.getByText('Cupertino, CA, US')).toBeVisible()
  await expect.poll(() => newsFetchCalls).toBe(1)
  await expect.poll(() => relevancyCalls).toBe(1)
  await expect(page.getByRole('link', { name: 'Apple expands supply chain' })).toBeVisible()
  await expect(page.getByText('Expansion supports services growth.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Supplier filing rumor' })).toHaveCount(0)

  await page.getByLabel('Show all (including low-relevance)').check()

  await expect(page.getByRole('link', { name: 'Supplier filing rumor' })).toBeVisible()
  expect(newsListCalls).toBeGreaterThanOrEqual(2)
})
