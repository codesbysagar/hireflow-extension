/**
 * HireFlow - Shared Utility Functions
 */

/**
 * Returns a promise that resolves after the specified milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Normalizes text while preserving paragraph structure and raw content.
 * Avoids aggressive stripping that would harm downstream LLM analysis.
 */
export function normalizePostText(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove zero-width spaces and control characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Collapse 3 or more consecutive newlines into 2
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Fast deterministic string hash for fallback deduplication
 */
export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Formats a date for the export filename: hireflow-linkedin-YYYY-MM-DD.json
 */
export function formatFilenameDate(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `hireflow-linkedin-${yyyy}-${mm}-${dd}.json`;
}

/**
 * Extracts search query keywords from a LinkedIn search URL
 */
export function extractQueryFromUrl(urlStr?: string): string | undefined {
  if (!urlStr) return undefined;
  try {
    const url = new URL(urlStr);
    const keywords = url.searchParams.get('keywords');
    if (keywords) return decodeURIComponent(keywords.replace(/\+/g, ' '));
  } catch {
    // Ignore invalid URLs
  }
  return undefined;
}

/**
 * Validates custom post quantity
 */
export function validateTargetCount(count: number, min = 1, max = 500): { isValid: boolean; value: number; error?: string } {
  if (isNaN(count) || !Number.isInteger(count)) {
    return { isValid: false, value: min, error: 'Please enter a valid whole number.' };
  }
  if (count < min) {
    return { isValid: false, value: min, error: `Minimum number of posts is ${min}.` };
  }
  if (count > max) {
    return { isValid: false, value: max, error: `Maximum supported scan limit is ${max}.` };
  }
  return { isValid: true, value: count };
}
