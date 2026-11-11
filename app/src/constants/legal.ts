/**
 * Terms and Privacy URLs used by the paywall and Settings.
 *
 * Leave these strings empty until the live policy pages exist.
 * Do not use example.com or any placeholder host. QA and store
 * submit require both URLs to be set to real, public pages.
 */
export const LEGAL_URLS = {
  terms: '',
  privacy: '',
} as const;

export function hasLegalUrl(kind: keyof typeof LEGAL_URLS): boolean {
  return LEGAL_URLS[kind].trim().length > 0;
}
