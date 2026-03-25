import type { ViewerCompanyProfile } from './viewer-company-profile.js'

interface RelevancyPromptCompanyContext {
  displayName: string
  legalName?: string | null
  industry?: string | null
  employeeCount?: number | null
  hqCity?: string | null
  hqCountry?: string | null
}

interface RelevancyPromptArticle {
  title: string
  text: string
}

export function buildRelevancyPrompt({
  companyContext,
  article,
  viewerCompany,
}: {
  companyContext: RelevancyPromptCompanyContext
  article: RelevancyPromptArticle
  viewerCompany: ViewerCompanyProfile
}): string {
  return `You are a financial and business intelligence analyst. Score how relevant the following news article is to understanding the business health, creditworthiness, or operational risk of the researched company.

Important scoring rule:
- The numeric relevancyScore and category must reflect only how relevant the article is to the researched company below.
- The explanation must describe why this matters to the viewer company and role/function below.

Viewer company:
- Name: ${viewerCompany.name}
- Domain: ${viewerCompany.domain}
- Role/function: ${viewerCompany.roleFunction}
- Description: ${viewerCompany.description}

Researched company:
- Name: ${companyContext.displayName}${companyContext.legalName && companyContext.legalName !== companyContext.displayName ? ` (legal: ${companyContext.legalName})` : ''}
- Industry: ${companyContext.industry ?? 'unknown'}
- Size: ${companyContext.employeeCount ? `~${companyContext.employeeCount} employees` : 'unknown size'}
- Location: ${[companyContext.hqCity, companyContext.hqCountry].filter(Boolean).join(', ') || 'unknown'}

Article:
Title: ${article.title}
Content: ${article.text}

Relevancy score guidelines:
- 85-100: Directly about this company's financial performance, legal issues, leadership, or major operational events
- 50-84: Mentions the company in significant context or covers industry events that directly affect them
- 30-49: Tangentially relevant - industry trends or sector news that partially applies
- 0-29: Not relevant or only incidentally mentions the company

Explanation guidelines:
- Explain the impact to the viewer company from a Finance Manager / AR Manager perspective
- Focus on customer exposure, collections, payment timing, cash-flow, operational risk, or legal risk when applicable
- If impact is limited, say that clearly
- Keep explanation under 160 characters

Return a JSON object with: relevancyScore (0-100 integer), category (one of: financial_performance, litigation_legal, leadership_change, operational_risk, market_expansion, industry_sector), and explanation (max 160 chars, viewer-company impact only).`
}
