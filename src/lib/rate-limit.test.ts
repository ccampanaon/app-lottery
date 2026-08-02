import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkRateLimit, resetRateLimits } from './rate-limit';

const LIMIT = 5;
const WINDOW = 15 * 60 * 1000;

beforeEach(() => {
  resetRateLimits();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('checkRateLimit', () => {
  it('allows requests up to the limit', () => {
    for (let i = 0; i < LIMIT; i += 1) {
      expect(checkRateLimit('ip', LIMIT, WINDOW).allowed).toBe(true);
    }
  });

  it('blocks the request after the limit', () => {
    for (let i = 0; i < LIMIT; i += 1) checkRateLimit('ip', LIMIT, WINDOW);
    expect(checkRateLimit('ip', LIMIT, WINDOW).allowed).toBe(false);
  });

  it('counts down the remaining allowance', () => {
    expect(checkRateLimit('ip', LIMIT, WINDOW).remaining).toBe(4);
    expect(checkRateLimit('ip', LIMIT, WINDOW).remaining).toBe(3);
  });

  it('never reports negative remaining once over the limit', () => {
    for (let i = 0; i < LIMIT + 3; i += 1) checkRateLimit('ip', LIMIT, WINDOW);
    expect(checkRateLimit('ip', LIMIT, WINDOW).remaining).toBe(0);
  });

  it('tracks keys independently', () => {
    for (let i = 0; i < LIMIT; i += 1) checkRateLimit('ip-a', LIMIT, WINDOW);
    expect(checkRateLimit('ip-a', LIMIT, WINDOW).allowed).toBe(false);
    expect(checkRateLimit('ip-b', LIMIT, WINDOW).allowed).toBe(true);
  });

  it('reports how long until the window resets', () => {
    for (let i = 0; i < LIMIT; i += 1) checkRateLimit('ip', LIMIT, WINDOW);
    vi.advanceTimersByTime(60_000);
    const result = checkRateLimit('ip', LIMIT, WINDOW);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBe(WINDOW / 1000 - 60);
  });

  it('allows again once the window has elapsed', () => {
    for (let i = 0; i < LIMIT; i += 1) checkRateLimit('ip', LIMIT, WINDOW);
    expect(checkRateLimit('ip', LIMIT, WINDOW).allowed).toBe(false);

    vi.advanceTimersByTime(WINDOW + 1);
    expect(checkRateLimit('ip', LIMIT, WINDOW).allowed).toBe(true);
  });

  it('does not extend the window on a blocked attempt', () => {
    // A fixed window must not become a rolling one — otherwise an attacker
    // hammering the endpoint would lock the victim out indefinitely.
    for (let i = 0; i < LIMIT; i += 1) checkRateLimit('ip', LIMIT, WINDOW);

    vi.advanceTimersByTime(WINDOW - 1000);
    expect(checkRateLimit('ip', LIMIT, WINDOW).allowed).toBe(false);

    vi.advanceTimersByTime(1001);
    expect(checkRateLimit('ip', LIMIT, WINDOW).allowed).toBe(true);
  });
});
