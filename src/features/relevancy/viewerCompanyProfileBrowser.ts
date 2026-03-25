export const VIEWER_COMPANY_ROLE_FUNCTION = 'Finance Manager / AR Manager'

export interface ViewerCompanyProfileInput {
  name: string
  domain: string
  roleFunction: string
  description: string
}

export interface ViewerCompanyProfile extends ViewerCompanyProfileInput {
  updatedAt: string
}

const VIEWER_COMPANY_PROFILE_STORAGE_KEY = 'company-intelligence.viewer-company-profile.v1'
const VIEWER_COMPANY_APPLIED_FINGERPRINTS_STORAGE_KEY = 'company-intelligence.viewer-company-applied-fingerprints.v1'

export function buildViewerCompanyProfileFingerprint(profile: ViewerCompanyProfileInput): string {
  return [
    normalizeValue(profile.name),
    normalizeValue(profile.domain),
    normalizeValue(profile.roleFunction),
    normalizeValue(profile.description),
  ].join('::')
}

export function hasViewerCompanyProfileFingerprintChanged(
  profile: ViewerCompanyProfileInput,
  appliedFingerprint: string | null,
): boolean {
  return buildViewerCompanyProfileFingerprint(profile) !== appliedFingerprint
}

export function loadStoredViewerCompanyProfile(): ViewerCompanyProfile | null {
  const rawValue = safeLocalStorage().getItem(VIEWER_COMPANY_PROFILE_STORAGE_KEY)
  if (!rawValue) return null

  try {
    const parsed = JSON.parse(rawValue) as Partial<ViewerCompanyProfile>
    if (!parsed.name || !parsed.domain || !parsed.description || !parsed.updatedAt) {
      return null
    }

    return {
      name: parsed.name.trim(),
      domain: parsed.domain.trim(),
      roleFunction: normalizeRoleFunction(parsed.roleFunction),
      description: parsed.description.trim(),
      updatedAt: parsed.updatedAt,
    }
  } catch {
    return null
  }
}

export function saveViewerCompanyProfile(profile: ViewerCompanyProfileInput): ViewerCompanyProfile {
  const savedProfile: ViewerCompanyProfile = {
    ...toViewerCompanyProfileRequest(profile),
    updatedAt: new Date().toISOString(),
  }

  safeLocalStorage().setItem(
    VIEWER_COMPANY_PROFILE_STORAGE_KEY,
    JSON.stringify(savedProfile),
  )

  return savedProfile
}

export function clearStoredViewerCompanyProfile() {
  const storage = safeLocalStorage()
  storage.removeItem(VIEWER_COMPANY_PROFILE_STORAGE_KEY)
  storage.removeItem(VIEWER_COMPANY_APPLIED_FINGERPRINTS_STORAGE_KEY)
}

export function getAppliedViewerCompanyProfileFingerprint(companyId: string): string | null {
  const fingerprints = readAppliedFingerprints()
  return fingerprints[companyId] ?? null
}

export function setAppliedViewerCompanyProfileFingerprint(companyId: string, fingerprint: string) {
  const storage = safeLocalStorage()
  const nextFingerprints = {
    ...readAppliedFingerprints(),
    [companyId]: fingerprint,
  }

  storage.setItem(
    VIEWER_COMPANY_APPLIED_FINGERPRINTS_STORAGE_KEY,
    JSON.stringify(nextFingerprints),
  )
}

export function toViewerCompanyProfileRequest(profile: ViewerCompanyProfileInput | ViewerCompanyProfile): ViewerCompanyProfileInput {
  return {
    name: profile.name.trim(),
    domain: profile.domain.trim(),
    roleFunction: normalizeRoleFunction(profile.roleFunction),
    description: profile.description.trim(),
  }
}

export function createViewerCompanyProfileInput(
  profile?: Partial<ViewerCompanyProfileInput> | null,
): ViewerCompanyProfileInput {
  return {
    name: profile?.name?.trim() ?? '',
    domain: profile?.domain?.trim() ?? '',
    roleFunction: normalizeRoleFunction(profile?.roleFunction),
    description: profile?.description?.trim() ?? '',
  }
}

function normalizeRoleFunction(roleFunction?: string) {
  return roleFunction?.trim() || VIEWER_COMPANY_ROLE_FUNCTION
}

function readAppliedFingerprints(): Record<string, string> {
  const rawValue = safeLocalStorage().getItem(VIEWER_COMPANY_APPLIED_FINGERPRINTS_STORAGE_KEY)
  if (!rawValue) return {}

  try {
    const parsed = JSON.parse(rawValue) as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    )
  } catch {
    return {}
  }
}

function safeLocalStorage() {
  return typeof window !== 'undefined' && window.localStorage
    ? window.localStorage
    : {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      }
}

function normalizeValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}
