/**
 * Simple rate limiter that enforces a minimum delay between requests.
 * Used by scrapers to avoid overwhelming store servers.
 */
export class RateLimiter {
  private lastRequest: number = 0

  constructor(private minDelayMs: number = 1000) {}

  /**
   * Wait until minDelayMs has passed since the last request.
   * If enough time has already elapsed, resolves immediately.
   */
  async wait(): Promise<void> {
    const now = Date.now()
    const elapsed = now - this.lastRequest
    const remaining = this.minDelayMs - elapsed

    if (remaining > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, remaining))
    }

    this.lastRequest = Date.now()
  }
}
