import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'
import { trpcSuccess } from './test-helpers'

const BATCH_ID = '33333333-3333-4333-8333-333333333333'
const ROW_TWO_INPUT_ID = '44444444-4444-4444-8444-444444444444'
const SELECTED_COMPANY_ID = '55555555-5555-4555-8555-555555555555'

function processingBatchStatus() {
  return {
    batchId: BATCH_ID,
    status: 'processing',
    totalRows: 3,
    processedRows: 1,
    counts: {
      confident: 1,
      suggested: 0,
      notFound: 0,
      failed: 0,
    },
    items: [
      {
        rowNumber: 1,
        status: 'completed',
        resolutionInputId: 'input-1',
        companyId: 'company-1',
        confidenceScore: 95,
        matchTier: 'confident',
        errorMessage: null,
        submittedInput: {
          companyName: 'Acme Corp',
          domain: 'acme.com',
        },
        selectedCandidate: {
          companyId: 'company-1',
          displayName: 'Acme Corp',
          domain: 'acme.com',
          confidenceScore: 95,
          matchTier: 'confident',
          sourceProviders: ['people_data_labs'],
          selected: true,
        },
        suggestedCandidates: [],
      },
      {
        rowNumber: 2,
        status: 'processing',
        resolutionInputId: ROW_TWO_INPUT_ID,
        companyId: null,
        confidenceScore: null,
        matchTier: null,
        errorMessage: null,
        submittedInput: {
          companyName: 'Beta Labs',
          address: '200 Mission Street',
          city: 'San Francisco',
        },
        selectedCandidate: null,
        suggestedCandidates: [],
      },
      {
        rowNumber: 3,
        status: 'pending',
        resolutionInputId: 'input-3',
        companyId: null,
        confidenceScore: null,
        matchTier: null,
        errorMessage: null,
        submittedInput: {
          companyName: 'Gamma Systems',
          address: '40 Lake Shore',
          city: 'Chicago',
          industry: 'Robotics',
        },
        selectedCandidate: null,
        suggestedCandidates: [],
      },
    ],
  }
}

function completedBatchStatus(selected: boolean) {
  return {
    batchId: BATCH_ID,
    status: 'completed',
    totalRows: 3,
    processedRows: 3,
    counts: {
      confident: 1,
      suggested: 1,
      notFound: 1,
      failed: 0,
    },
    items: [
      {
        rowNumber: 1,
        status: 'completed',
        resolutionInputId: 'input-1',
        companyId: 'company-1',
        confidenceScore: 95,
        matchTier: 'confident',
        errorMessage: null,
        submittedInput: {
          companyName: 'Acme Corp',
          domain: 'acme.com',
        },
        selectedCandidate: {
          companyId: 'company-1',
          displayName: 'Acme Corp',
          domain: 'acme.com',
          confidenceScore: 95,
          matchTier: 'confident',
          sourceProviders: ['people_data_labs'],
          selected: true,
        },
        suggestedCandidates: [],
      },
      {
        rowNumber: 2,
        status: 'completed',
        resolutionInputId: ROW_TWO_INPUT_ID,
        companyId: selected ? SELECTED_COMPANY_ID : 'company-2',
        confidenceScore: selected ? 73 : 81,
        matchTier: 'suggested',
        errorMessage: null,
        submittedInput: {
          companyName: 'Beta Labs',
          address: '200 Mission Street',
          city: 'San Francisco',
        },
        selectedCandidate: {
          companyId: selected ? SELECTED_COMPANY_ID : 'company-2',
          displayName: selected ? 'Beta Labs LLC' : 'Beta Labs Inc.',
          domain: selected ? 'betalabs.co' : 'betalabs.com',
          confidenceScore: selected ? 73 : 81,
          matchTier: 'suggested',
          sourceProviders: selected ? ['people_data_labs', 'opencorporates'] : ['people_data_labs'],
          selected,
        },
        suggestedCandidates: [
          {
            companyId: 'company-2',
            displayName: 'Beta Labs Inc.',
            domain: 'betalabs.com',
            confidenceScore: 81,
            matchTier: 'suggested',
            sourceProviders: ['people_data_labs'],
            selected: false,
          },
          {
            companyId: 'company-3',
            displayName: 'Beta Labs Holdings',
            domain: 'beta-holdings.com',
            confidenceScore: 77,
            matchTier: 'suggested',
            sourceProviders: ['sec_edgar'],
            selected: false,
          },
          {
            companyId: SELECTED_COMPANY_ID,
            displayName: 'Beta Labs LLC',
            domain: 'betalabs.co',
            confidenceScore: 73,
            matchTier: 'suggested',
            sourceProviders: ['people_data_labs', 'opencorporates'],
            selected,
          },
        ],
      },
      {
        rowNumber: 3,
        status: 'completed',
        resolutionInputId: 'input-3',
        companyId: null,
        confidenceScore: 0,
        matchTier: 'not_found',
        errorMessage: 'Retry with different inputs or add more context.',
        submittedInput: {
          companyName: 'Gamma Systems',
          address: '40 Lake Shore',
          city: 'Chicago',
          industry: 'Robotics',
        },
        selectedCandidate: null,
        suggestedCandidates: [],
      },
    ],
  }
}

test('csv upload previews rows, polls progress, and supports confirm plus retry actions', async ({ page }) => {
  let batchStatusCalls = 0
  let confirmCalls = 0

  await page.route('**/api/company/preview-batch', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalRows: 4,
        validRows: 3,
        invalidRows: 1,
        parseErrors: [
          { row: 5, message: 'company_name is required' },
        ],
        preview: [
          { company_name: 'Acme Corp', domain: 'acme.com', city: 'Seattle' },
          { company_name: 'Beta Labs', address: '200 Mission Street', city: 'San Francisco' },
          { company_name: 'Gamma Systems', industry: 'Robotics', city: 'Chicago' },
        ],
      }),
    })
  })

  await page.route('**/api/company/resolve-batch', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        batchId: BATCH_ID,
        status: 'processing',
        totalRows: 4,
        validRows: 3,
        invalidRows: 1,
        processedRows: 0,
        parseErrors: [
          { row: 5, message: 'company_name is required' },
        ],
        preview: [
          { company_name: 'Acme Corp', domain: 'acme.com', city: 'Seattle' },
          { company_name: 'Beta Labs', address: '200 Mission Street', city: 'San Francisco' },
          { company_name: 'Gamma Systems', industry: 'Robotics', city: 'Chicago' },
        ],
      }),
    })
  })

  await page.route('**/trpc/batch.getStatus**', async (route) => {
    batchStatusCalls += 1

    const payload =
      batchStatusCalls === 1
        ? processingBatchStatus()
        : completedBatchStatus(confirmCalls > 0)

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(trpcSuccess(payload)),
    })
  })

  await page.route('**/trpc/company.confirmMatch**', async (route) => {
    confirmCalls += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(trpcSuccess({
        resolutionInputId: ROW_TWO_INPUT_ID,
        companyId: SELECTED_COMPANY_ID,
        selected: true,
      })),
    })
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'CSV Upload' }).click()

  await page.locator('input[type="file"]').setInputFiles({
    name: 'companies.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      [
        'company_name,domain,address,city,state,country,industry',
        'Acme Corp,acme.com,,Seattle,WA,US,Software',
        'Beta Labs,,200 Mission Street,San Francisco,CA,US,AI',
        'Gamma Systems,,40 Lake Shore,Chicago,IL,US,Robotics',
        ',,Missing Name,Chicago,IL,US,Robotics',
      ].join('\n'),
    ),
  })

  await expect(page.getByText('Preview first 3 valid rows before processing:')).toBeVisible()
  await expect(page.getByText('Rows detected')).toBeVisible()
  await expect(page.getByText('Ready to process')).toBeVisible()
  await expect(page.getByText('Rows skipped', { exact: true })).toBeVisible()
  await expect(page.getByText('Row 5: company_name is required')).toBeVisible()

  await page.getByRole('button', { name: 'Start Processing' }).click()

  await expect(page).toHaveURL(new RegExp(`/results/${BATCH_ID}$`))
  await expect(page.getByText('1 / 3 processed')).toBeVisible()
  await expect(page.getByText('3 / 3 processed')).toBeVisible({ timeout: 7000 })
  await expect(page.getByText('Top 3 candidates')).toBeVisible()

  await page.getByRole('button', { name: 'Confirm' }).first().click()

  await expect.poll(() => confirmCalls).toBe(1)
  await expect(page.getByRole('button', { name: 'Selected' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Retry with different inputs' })).toBeVisible()

  await page.getByRole('link', { name: 'Retry with different inputs' }).click()

  await expect(page).toHaveURL(/tab=single/)
  await expect(page.getByPlaceholder('e.g. Apple Inc.')).toHaveValue('Gamma Systems')
  await expect(page.getByPlaceholder('1 Apple Park Way')).toHaveValue('40 Lake Shore')
  await expect(page.getByPlaceholder('New York')).toHaveValue('Chicago')
  expect(batchStatusCalls).toBeGreaterThanOrEqual(3)
})
