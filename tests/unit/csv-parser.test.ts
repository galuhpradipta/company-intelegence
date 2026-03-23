import { describe, it, expect } from 'vitest'
import { parseCsv } from '../../server/services/batch/csv-parser.js'

function toBuffer(content: string): Buffer {
  return Buffer.from(content, 'utf-8')
}

describe('parseCsv', () => {
  it('parses a valid CSV with all columns', () => {
    const csv = `company_name,domain,city,state,country,industry
Apple Inc,apple.com,Cupertino,CA,US,Technology`
    const result = parseCsv(toBuffer(csv))
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].company_name).toBe('Apple Inc')
    expect(result.rows[0].domain).toBe('apple.com')
    expect(result.errors).toHaveLength(0)
  })

  it('requires company_name column', () => {
    const csv = `domain,city
apple.com,Cupertino`
    const result = parseCsv(toBuffer(csv))
    expect(result.rows).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('company_name')
  })

  it('flags rows with empty company_name', () => {
    const csv = `company_name,domain
Apple,apple.com
,google.com
Google,google.com`
    const result = parseCsv(toBuffer(csv))
    expect(result.rows).toHaveLength(2)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].row).toBe(3)
  })

  it('handles extra unknown columns gracefully', () => {
    const csv = `company_name,domain,unknown_col
Apple,apple.com,some_value`
    const result = parseCsv(toBuffer(csv))
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].company_name).toBe('Apple')
  })

  it('handles BOM (UTF-8 BOM encoding)', () => {
    const bom = '\uFEFF'
    const csv = `${bom}company_name,domain\nApple,apple.com`
    const result = parseCsv(toBuffer(csv))
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].company_name).toBe('Apple')
  })

  it('skips empty lines', () => {
    const csv = `company_name\nApple\n\nGoogle\n`
    const result = parseCsv(toBuffer(csv))
    expect(result.rows).toHaveLength(2)
  })

  it('trims whitespace from field values', () => {
    const csv = `company_name,domain\n  Apple  ,  apple.com  `
    const result = parseCsv(toBuffer(csv))
    expect(result.rows[0].company_name).toBe('Apple')
    expect(result.rows[0].domain).toBe('apple.com')
  })

  it('returns preview of first 5 rows', () => {
    const rows = Array.from({ length: 10 }, (_, i) => `Company${i + 1},c${i + 1}.com`).join('\n')
    const csv = `company_name,domain\n${rows}`
    const result = parseCsv(toBuffer(csv))
    expect(result.preview).toHaveLength(5)
  })

  it('returns total row count including invalid rows', () => {
    const csv = `company_name,domain\nApple,apple.com\n,missing.com\nGoogle,google.com`
    const result = parseCsv(toBuffer(csv))
    expect(result.totalRows).toBe(3)
    expect(result.rows).toHaveLength(2)
    expect(result.errors).toHaveLength(1)
  })

  it('handles case-insensitive column names', () => {
    const csv = `Company_Name,Domain\nApple,apple.com`
    const result = parseCsv(toBuffer(csv))
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].company_name).toBe('Apple')
  })
})
