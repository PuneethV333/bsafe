/**
 * Neon (and any pooled Pg) connections drop intermittently under load — the
 * server closes an idle pooled socket and the next query fails with
 * `ConnectionClosed`. For read-only queries that is safe to retry; write paths
 * are deliberately NOT wrapped here, because replaying an insert could create
 * duplicate alerts or duplicate delivery rows.
 */
const TRANSIENT_PATTERNS = [
  /ConnectionClosed/i,
  /Connection reset/i,
  /terminating connection/i,
  /connection.*closed/i,
  /timeout/i,
  /ETIMEDOUT/i,
  /ECONNRESET/i,
  /P1001/,
  /P1002/,
  /P2024/,
  /08P01/,
];

const TRANSIENT_CODES = new Set([
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'EPIPE',
  'P1001',
  'P1002',
  'P2024',
]);

function isTransient(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;
  if (typeof code === 'string' && TRANSIENT_CODES.has(code)) return true;
  const message = error instanceof Error ? error.message : String(error);
  return TRANSIENT_PATTERNS.some((pattern) => pattern.test(message));
}

export async function withReadRetry<T>(
  operation: () => Promise<T>,
  attempts = 4,
  delayMs = 400,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransient(error) || attempt === attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
  throw lastError;
}