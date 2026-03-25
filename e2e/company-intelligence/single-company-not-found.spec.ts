import { expect, test } from '@playwright/test'
import { trpcSuccess } from './test-helpers'

test('single-company low-confidence candidates stay in not-found state with no confirm actions', async ({ page }) => {
  await page.route(/\/trpc\/.+/, async (route) => {
    const url = route.request().url()
    const procedurePath = new URL(url).pathname.split('/trpc/')[1] ?? ''
    const procedures = procedurePath.split(',')

    if (procedures.every((procedure) => procedure === 'relevancy.viewerCompanyProfile')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          procedures.map(() =>
            trpcSuccess({
              name: 'Merclex',
              domain: 'merclex.example',
              roleFunction: 'Finance Manager / AR Manager',
              description: 'Merclex uses merclex.example and needs finance and AR visibility into customer health, payment timing, collections exposure, and cash-flow risk.',
            }),
          ),
        ),
      })
      return
    }

    if (procedurePath === 'relevancy.viewerCompanyProfile') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(trpcSuccess({
          name: 'Merclex',
          domain: 'merclex.example',
          roleFunction: 'Finance Manager / AR Manager',
          description: 'Merclex uses merclex.example and needs finance and AR visibility into customer health, payment timing, collections exposure, and cash-flow risk.',
        })),
      })
      return
    }

    if (procedurePath !== 'company.resolve') {
      throw new Error(`Unhandled tRPC procedure in test: ${procedurePath}`)
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(trpcSuccess({
        resolutionInputId: '77777777-7777-4777-8777-777777777777',
        topTier: 'not_found',
        candidates: [
          {
            companyId: '88888888-8888-4888-8888-888888888888',
            displayName: 'Delta Robotics Advisors',
            confidenceScore: 21,
            matchTier: 'not_found',
            sourceProviders: ['ai_fallback'],
          },
        ],
      })),
    })
  })

  await page.goto('/')

  await expect(page.getByText('My Company Context')).toBeVisible()
  await page.getByPlaceholder('e.g. Apple Inc.').fill('Delta Robotics Advisors')
  await page.getByRole('button', { name: 'Resolve Company' }).click()

  await expect(page).toHaveURL('/')
  await expect(page.getByRole('alert')).toContainText('No confident match found. Try providing more context.')
  await expect(page.getByRole('button', { name: /Confirm / })).toHaveCount(0)
  await expect(page.getByText('Suggested matches — confirm the correct company:')).toHaveCount(0)
})
