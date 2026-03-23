import type { CandidateCompany, CompanyProvider, NormalizedInput } from './types.js'
import { getMockCompanyCandidates } from '../../testing/mock-fixtures.js'

export class FixtureCompanyProvider implements CompanyProvider {
  name: string
  reliabilityFactor: number

  constructor(name: string, reliabilityFactor: number) {
    this.name = name
    this.reliabilityFactor = reliabilityFactor
  }

  async search(input: NormalizedInput): Promise<CandidateCompany[]> {
    return getMockCompanyCandidates(input, this.name)
  }
}
