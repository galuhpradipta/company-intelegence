import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function stubServerEnv() {
  vi.stubEnv('DATABASE_URL', 'postgres://test:test@localhost:5432/test')
  vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
}

describe('getBatchStatus', () => {
  beforeEach(() => {
    vi.resetModules()
    stubServerEnv()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('kicks off resume processing and falls back to stored row input for pending items', async () => {
    const ensureBatchProcessing = vi.fn().mockResolvedValue(undefined)

    vi.doMock('../../server/services/batch/batch-processor.js', () => ({
      ensureBatchProcessing,
    }))
    vi.doMock('../../server/db/client.js', () => ({
      db: {
        query: {
          batchUploads: {
            findFirst: vi.fn().mockResolvedValue({
              id: 'batch-1',
              status: 'processing',
              totalRows: 2,
              processedRows: 1,
            }),
          },
          batchUploadItems: {
            findMany: vi.fn().mockResolvedValue([
              {
                rowNumber: 2,
                rawInput: {
                  company_name: 'Beta Labs',
                  address: '200 Mission Street',
                  city: 'San Francisco',
                },
                status: 'pending',
                resolutionInputId: null,
                resultCompanyId: null,
                errorMessage: null,
              },
            ]),
          },
        },
      },
    }))

    const { getBatchStatus } = await import('../../server/services/batch/status.js')
    const result = await getBatchStatus('batch-1')

    expect(ensureBatchProcessing).toHaveBeenCalledWith('batch-1')
    expect(result.items[0]).toMatchObject({
      rowNumber: 2,
      status: 'pending',
      submittedInput: {
        companyName: 'Beta Labs',
        address: '200 Mission Street',
        city: 'San Francisco',
      },
    })
  })
})
