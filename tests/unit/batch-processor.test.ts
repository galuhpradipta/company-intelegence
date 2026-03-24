import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function stubServerEnv() {
  vi.stubEnv('DATABASE_URL', 'postgres://test:test@localhost:5432/test')
  vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
  vi.stubEnv('BATCH_CONCURRENCY', '2')
}

describe('createBatch', () => {
  beforeEach(() => {
    vi.resetModules()
    stubServerEnv()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('persists each csv row on the batch item for resumable processing', async () => {
    const returning = vi.fn().mockResolvedValue([{ id: 'batch-1' }])
    const batchInsert = {
      values: vi.fn().mockReturnValue({ returning }),
    }
    const itemInsert = {
      values: vi.fn().mockResolvedValue(undefined),
    }
    const insert = vi.fn()
      .mockReturnValueOnce(batchInsert)
      .mockReturnValueOnce(itemInsert)

    vi.doMock('../../server/db/client.js', () => ({
      db: { insert },
    }))

    const { createBatch } = await import('../../server/services/batch/batch-processor.js')

    await expect(createBatch('companies.csv', [
      { company_name: 'Acme Corp', domain: 'acme.com' },
      { company_name: 'Beta Labs', city: 'San Francisco' },
    ])).resolves.toBe('batch-1')

    expect(itemInsert.values).toHaveBeenCalledWith([
      expect.objectContaining({
        batchUploadId: 'batch-1',
        rowNumber: 1,
        rawInput: { company_name: 'Acme Corp', domain: 'acme.com' },
      }),
      expect.objectContaining({
        batchUploadId: 'batch-1',
        rowNumber: 2,
        rawInput: { company_name: 'Beta Labs', city: 'San Francisco' },
      }),
    ])
  })
})
