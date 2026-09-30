/**
 * HireFlow - Email Extractor
 * Robust email detection, normalization, and deduplication for hiring posts.
 */

// Comprehensive regex for email extraction matching RFC 5322 compliant addresses
// Handles case-insensitivity, subdomains, country-code TLDs (e.g. .co.in, .tech)
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Obfuscated email formats commonly seen in recruiter posts:
// e.g. "hr [at] company [dot] com" or "jobs(at)example.com"
const OBFUSCATED_AT_REGEX = /([a-zA-Z0-9._%+-]+)\s*(?:\[at\]|\(at\)|@)\s*([a-zA-Z0-9.-]+)\s*(?:\[dot\]|\(dot\)|\.)\s*([a-zA-Z]{2,})/gi;

// Image file extensions or common false-positive patterns (like retina assets `image@2x.png`)
const FALSE_POSITIVE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico', 'tiff'
]);

// Known standard TLDs
const KNOWN_TLDS = [
  'com', 'org', 'net', 'edu', 'gov', 'info', 'tech', 'dev', 'app', 'biz', 'io', 'ai', 'in', 'co', 'uk', 'de', 'fr', 'me'
];

/**
 * Normalizes an email candidate by stripping surrounding brackets, quotes, or trailing punctuation.
 */
export function normalizeEmail(rawEmail: string): string | null {
  if (!rawEmail) return null;

  let cleaned = rawEmail.trim();

  // Strip leading/trailing enclosing characters: <>, (), [], "", '', ``, etc.
  cleaned = cleaned.replace(/^[<(\["'`]+/, '').replace(/[>)\]"'`]+$/, '');

  // Strip trailing punctuation often found at the end of sentences (e.g., "apply at jobs@co.com.")
  cleaned = cleaned.replace(/[.,:;!?]+$/, '');

  // Split into local and domain parts
  const parts = cleaned.split('@');
  if (parts.length !== 2) return null;

  const [localPart, domainPart] = parts;
  if (!localPart || !domainPart) return null;

  // Local part checks
  if (localPart.length > 64) return null;

  // Domain checks
  const domainSegments = domainPart.split('.');
  if (domainSegments.length < 2) return null;

  let tld = domainSegments[domainSegments.length - 1];
  if (!tld || tld.length < 2) return null;

  // If TLD already is a known standard TLD, it's valid and needs no glued-word trimming
  if (!KNOWN_TLDS.includes(tld.toLowerCase())) {
    // If TLD has trailing text glued due to unspaced DOM rendering (e.g., "comImportant" -> "com")
    for (const known of KNOWN_TLDS) {
      if (tld.toLowerCase().startsWith(known) && tld.length > known.length) {
        const rest = tld.slice(known.length);
        const isKnownWord = /^(important|please|reach|apply|send|dm|note|location|interested|contact)/i.test(rest);
        const isCapital = rest[0] >= 'A' && rest[0] <= 'Z';
        if (isKnownWord || isCapital) {
          tld = known;
          domainSegments[domainSegments.length - 1] = tld;
          break;
        }
      }
    }
  }

  // Filter out false positive image assets like name@2x.png
  if (FALSE_POSITIVE_EXTENSIONS.has(tld.toLowerCase())) return null;

  const cleanedDomain = domainSegments.join('.');

  // Domain must contain only valid characters and no double dots
  if (!/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/.test(cleanedDomain)) return null;

  return `${localPart.toLowerCase()}@${cleanedDomain.toLowerCase()}`;
}

/**
 * Extracts and deduplicates all valid contact emails from a raw text string or DOM element.
 */
export function extractEmails(text: string, element?: HTMLElement): string[] {
  const detectedEmails = new Set<string>();

  // 1. Check mailto: anchor links if element is provided
  if (element && typeof element.querySelectorAll === 'function') {
    try {
      const mailLinks = element.querySelectorAll<HTMLAnchorElement>('a[href^="mailto:"]');
      for (const link of Array.from(mailLinks)) {
        const raw = link.href.replace(/^mailto:/i, '').split('?')[0];
        const normalized = normalizeEmail(raw);
        if (normalized) {
          detectedEmails.add(normalized);
        }
      }
    } catch {
      // Continue to text search
    }
  }

  if (text && typeof text === 'string') {
    // 2. Standard pattern matching
    const standardMatches = text.match(EMAIL_REGEX) || [];
    for (const match of standardMatches) {
      const normalized = normalizeEmail(match);
      if (normalized) {
        detectedEmails.add(normalized);
      }
    }

    // 3. Obfuscated recruiter pattern matching: e.g. "careers [at] google [dot] com"
    let obfuscatedMatch: RegExpExecArray | null;
    while ((obfuscatedMatch = OBFUSCATED_AT_REGEX.exec(text)) !== null) {
      const reconstructed = `${obfuscatedMatch[1]}@${obfuscatedMatch[2]}.${obfuscatedMatch[3]}`;
      const normalized = normalizeEmail(reconstructed);
      if (normalized) {
        detectedEmails.add(normalized);
      }
    }
  }

  return Array.from(detectedEmails);
}

/**
 * Returns true if the text contains at least one detectable contact email.
 */
export function hasContactEmail(text: string): boolean {
  return extractEmails(text).length > 0;
}
