/**
 * Planned GitHub Pages URLs for the public legal site in /site.
 *
 * PENDING_HOSTING is true until those pages are actually published.
 * The in-app Terms and Privacy links use these URLs so the paywall
 * and Settings can show them, but they will 404 until GitHub Pages
 * is hosted. This is not a dummy host like example.com — it is the
 * planned public location of the accepted privacy and terms pages.
 */
export const PENDING_HOSTING = true;

export const LEGAL_URLS = {
  terms: 'https://krosz.github.io/openplay/terms.html',
  privacy: 'https://krosz.github.io/openplay/privacy.html',
} as const;

export function hasLegalUrl(kind: keyof typeof LEGAL_URLS): boolean {
  return LEGAL_URLS[kind].trim().length > 0;
}
