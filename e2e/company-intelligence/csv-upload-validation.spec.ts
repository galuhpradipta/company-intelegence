import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'

test('csv upload previews the first five valid rows and surfaces skipped-row counts', async ({ page }) => {
  await page.route('**/api/company/preview-batch', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalRows: 7,
        validRows: 6,
        invalidRows: 1,
        parseErrors: [
          { row: 8, message: 'Missing required field: company_name' },
        ],
        preview: [
          { company_name: 'Acme Corp', domain: 'acme.com', city: 'Seattle' },
          { company_name: 'Beta Labs', address: '200 Mission Street', city: 'San Francisco' },
          { company_name: 'Gamma Systems', industry: 'Robotics', city: 'Chicago' },
          { company_name: 'Delta Health', domain: 'deltahealth.com', city: 'Boston' },
          { company_name: 'Epsilon Energy', domain: 'epsilon.energy', city: 'Austin' },
        ],
      }),
    })
  })

  await page.goto('/')
  await page.getByRole('tab', { name: 'CSV Upload' }).click()

  await page.locator('input[type="file"]').setInputFiles({
    name: 'companies.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      [
        'company_name,domain,address,city,state,country,industry',
        'Acme Corp,acme.com,,Seattle,WA,US,Software',
        'Beta Labs,,200 Mission Street,San Francisco,CA,US,AI',
        'Gamma Systems,,40 Lake Shore,Chicago,IL,US,Robotics',
        'Delta Health,deltahealth.com,,Boston,MA,US,Healthcare',
        'Epsilon Energy,epsilon.energy,,Austin,TX,US,Energy',
        'Zeta Foods,zetafoods.com,,Denver,CO,US,Food',
        ',,Missing Name,Chicago,IL,US,Robotics',
      ].join('\n'),
    ),
  })

  await expect(page.getByText('Rows detected')).toBeVisible()
  await expect(page.getByText('Ready to process')).toBeVisible()
  await expect(page.getByText('Rows skipped', { exact: true })).toBeVisible()
  await expect(page.getByText('Preview first 5 valid rows before processing:')).toBeVisible()
  await expect(page.getByText('Row 8: Missing required field: company_name')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Acme Corp' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Epsilon Energy' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Zeta Foods' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Start Processing' })).toBeEnabled()
})

test('csv upload keeps processing disabled when validation finds zero valid rows', async ({ page }) => {
  await page.route('**/api/company/preview-batch', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalRows: 2,
        validRows: 0,
        invalidRows: 2,
        parseErrors: [
          { row: 2, message: 'Missing required field: company_name' },
          { row: 3, message: 'Missing required field: company_name' },
        ],
        preview: [],
      }),
    })
  })

  await page.goto('/')
  await page.getByRole('tab', { name: 'CSV Upload' }).click()

  await page.locator('input[type="file"]').setInputFiles({
    name: 'invalid-companies.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      [
        'company_name,domain,city',
        ',missing.com,Chicago',
        ',also-missing.com,Seattle',
      ].join('\n'),
    ),
  })

  await expect(page.getByText('Rows detected')).toBeVisible()
  await expect(page.getByText('Ready to process')).toBeVisible()
  await expect(page.getByText('Rows skipped', { exact: true })).toBeVisible()
  await expect(page.getByText('Row 2: Missing required field: company_name')).toBeVisible()
  await expect(page.getByText('Row 3: Missing required field: company_name')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start Processing' })).toBeDisabled()
})
