import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  VIEWER_COMPANY_ROLE_FUNCTION,
  buildViewerCompanyProfileFingerprint,
  clearStoredViewerCompanyProfile,
  createViewerCompanyProfileInput,
  getAppliedViewerCompanyProfileFingerprint,
  hasViewerCompanyProfileFingerprintChanged,
  loadStoredViewerCompanyProfile,
  saveViewerCompanyProfile,
  setAppliedViewerCompanyProfileFingerprint,
  toViewerCompanyProfileRequest,
} from './viewerCompanyProfileBrowser.js'

function createLocalStorageMock() {
  const store = new Map<string, string>()

  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key)
    }),
  }
}

describe('viewerCompanyProfileBrowser helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-25T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('saves, loads, and clears the viewer company profile from localStorage', () => {
    vi.stubGlobal('window', { localStorage: createLocalStorageMock() })

    const saved = saveViewerCompanyProfile({
      name: 'Merclex',
      domain: 'merclex.example',
      roleFunction: VIEWER_COMPANY_ROLE_FUNCTION,
      description: 'Merclex tracks customer health and cash-flow risk.',
    })

    expect(saved.updatedAt).toBe('2026-03-25T12:00:00.000Z')
    expect(loadStoredViewerCompanyProfile()).toEqual(saved)

    clearStoredViewerCompanyProfile()
    expect(loadStoredViewerCompanyProfile()).toBeNull()
  })

  it('computes a stable fingerprint from meaningful profile fields', () => {
    const a = buildViewerCompanyProfileFingerprint({
      name: 'Merclex ',
      domain: ' merclex.example',
      roleFunction: VIEWER_COMPANY_ROLE_FUNCTION,
      description: 'Tracks payment timing',
    })
    const b = buildViewerCompanyProfileFingerprint({
      name: 'merclex',
      domain: 'merclex.example',
      roleFunction: VIEWER_COMPANY_ROLE_FUNCTION,
      description: 'tracks payment timing',
    })

    expect(a).toBe(b)
  })

  it('tracks whether a company detail page needs a profile-driven refresh', () => {
    vi.stubGlobal('window', { localStorage: createLocalStorageMock() })

    const profile = createViewerCompanyProfileInput({
      name: 'Merclex',
      domain: 'merclex.example',
      description: 'Tracks payment timing',
    })

    expect(hasViewerCompanyProfileFingerprintChanged(
      profile,
      getAppliedViewerCompanyProfileFingerprint('company-1'),
    )).toBe(true)

    const fingerprint = buildViewerCompanyProfileFingerprint(profile)
    setAppliedViewerCompanyProfileFingerprint('company-1', fingerprint)

    expect(getAppliedViewerCompanyProfileFingerprint('company-1')).toBe(fingerprint)
    expect(hasViewerCompanyProfileFingerprintChanged(profile, fingerprint)).toBe(false)
  })

  it('normalizes request payloads to the browser-local role and trimmed values', () => {
    expect(toViewerCompanyProfileRequest({
      name: '  Merclex ',
      domain: ' merclex.example ',
      roleFunction: '',
      description: ' Cash-flow visibility ',
      updatedAt: '2026-03-25T12:00:00.000Z',
    })).toEqual({
      name: 'Merclex',
      domain: 'merclex.example',
      roleFunction: VIEWER_COMPANY_ROLE_FUNCTION,
      description: 'Cash-flow visibility',
    })
  })
})
