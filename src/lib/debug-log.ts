/*
 * Opt-in tracing for the sign-in path.
 *
 * The login flow deliberately reports every failure identically, which is
 * correct for users but leaves nothing to debug with when a deployment breaks.
 * These logs go to the server log only (Vercel → Logs → Functions); nothing here
 * is ever sent to the browser, so the uniform-failure property is preserved.
 *
 * Off unless AUTH_DEBUG is set, so login attempts do not write email addresses
 * into the log in normal operation. Turn it on to diagnose, then remove it.
 */
export const authDebugEnabled = process.env.AUTH_DEBUG === '1' || process.env.AUTH_DEBUG === 'true';

export function debugLog(scope: string, message: string, detail?: Record<string, unknown>): void {
  if (!authDebugEnabled) return;
  console.log(`[debug:${scope}] ${message}${detail ? ` ${JSON.stringify(detail)}` : ''}`);
}

/**
 * Unwrap the `cause` chain — Auth.js buries the real failure several layers deep.
 *
 * Walking `cause` alone is not enough: Auth.js sets it to a plain
 * `{ err, provider }` object rather than an Error, so a naive `instanceof Error`
 * loop stops at the outermost `CallbackRouteError` and reports nothing useful.
 * Verified against a real 10s Mongo timeout, which otherwise surfaced as bare
 * "CallbackRouteError: Read more at https://errors.authjs.dev".
 */
export function describeError(error: unknown): Record<string, unknown> {
  const chain: string[] = [];
  let current: unknown = error;

  for (let depth = 0; depth < 6 && current != null; depth += 1) {
    if (current instanceof Error) {
      chain.push(`${current.name}: ${current.message}`);
      current = current.cause;
    } else if (typeof current === 'object' && 'err' in current) {
      current = (current as { err: unknown }).err;
    } else {
      if (chain.length === 0) chain.push(String(current));
      break;
    }
  }

  return { chain };
}
