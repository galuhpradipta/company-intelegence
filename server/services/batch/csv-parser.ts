import { parse } from 'csv-parse/sync'

export interface CsvRow {
  company_name: string
  domain?: string
  address?: string
  city?: string
  state?: string
  country?: string
  industry?: string
}

export interface ParseResult {
  rows: CsvRow[]
  errors: Array<{ row: number; message: string }>
  preview: CsvRow[]
  totalRows: number
}

export function parseCsv(csvBuffer: Buffer): ParseResult {
  const errors: Array<{ row: number; message: string }> = []
  let records: Record<string, string>[]

  try {
    records = parse(csvBuffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true, // Handle UTF-8 BOM encoding
    }) as Record<string, string>[]
  } catch (err) {
    throw new Error(`CSV parse error: ${err instanceof Error ? err.message : String(err)}`)
  }

  const rows: CsvRow[] = []

  for (let i = 0; i < records.length; i++) {
    const record = records[i]
    const rowNum = i + 2 // 1-based, +1 for header

    // Normalize column names (case-insensitive, handle spaces)
    const normalized: Record<string, string> = {}
    for (const [key, value] of Object.entries(record)) {
      normalized[key.toLowerCase().replace(/\s+/g, '_')] = value
    }

    if (!normalized.company_name || normalized.company_name.trim() === '') {
      errors.push({ row: rowNum, message: 'Missing required field: company_name' })
      continue
    }

    rows.push({
      company_name: normalized.company_name.trim(),
      domain: normalized.domain?.trim() || undefined,
      address: normalized.address?.trim() || undefined,
      city: normalized.city?.trim() || undefined,
      state: normalized.state?.trim() || undefined,
      country: normalized.country?.trim() || undefined,
      industry: normalized.industry?.trim() || undefined,
    })
  }

  return {
    rows,
    errors,
    preview: rows.slice(0, 5),
    totalRows: records.length,
  }
}
