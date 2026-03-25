import { describe, expect, it } from 'vitest'
import { buildRelevancyPrompt } from '../../server/services/relevancy/prompt-builder.js'

describe('buildRelevancyPrompt', () => {
  it('includes researched company context, viewer company context, and score/explanation instructions', () => {
    const prompt = buildRelevancyPrompt({
      companyContext: {
        displayName: 'Apple Inc.',
        legalName: 'Apple Inc.',
        industry: 'Technology',
        employeeCount: 161000,
        hqCity: 'Cupertino',
        hqCountry: 'US',
      },
      article: {
        title: 'Apple expands supply chain',
        text: 'Apple announced another supply-chain expansion.',
      },
      viewerCompany: {
        name: 'Merclex',
        domain: 'merclex.example',
        roleFunction: 'Finance Manager / AR Manager',
        description: 'Merclex is a company operating through merclex.example. For finance/AR relevance, key exposure areas are customer exposure, payment timing, and collections pressure.',
      },
    })

    expect(prompt).toContain('Viewer company:')
    expect(prompt).toContain('- Name: Merclex')
    expect(prompt).toContain('- Domain: merclex.example')
    expect(prompt).toContain('- Description: Merclex is a company operating through merclex.example. For finance/AR relevance, key exposure areas are customer exposure, payment timing, and collections pressure.')
    expect(prompt).toContain('- Role/function: Finance Manager / AR Manager')
    expect(prompt).toContain('The numeric relevancyScore and category must reflect only how relevant the article is to the researched company below.')
    expect(prompt).toContain('Explain the impact to the viewer company from a Finance Manager / AR Manager perspective')
    expect(prompt).toContain('Researched company:')
    expect(prompt).toContain('Title: Apple expands supply chain')
  })
})
