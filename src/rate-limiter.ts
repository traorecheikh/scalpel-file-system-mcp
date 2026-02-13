import type { RateLimitConfig } from "./config.js";

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterMs: number;
  remaining: number;
  limit: number;
  windowMs: number;
}

export class SlidingWindowRateLimiter {
  private readonly buckets = new Map<string, number[]>();
  private checksSincePrune = 0;

  public constructor(private readonly policy: RateLimitConfig) {}

  public check(key: string, nowMs: number = Date.now()): RateLimitDecision {
    this.checksSincePrune += 1;
    if (this.checksSincePrune >= 256) {
      this.prune(nowMs);
      this.checksSincePrune = 0;
    }

    const bucket = this.buckets.get(key) ?? [];
    const threshold = nowMs - this.policy.windowMs;
    const recent = bucket.filter((timestamp) => timestamp > threshold);

    if (recent.length >= this.policy.maxRequests) {
      const oldest = recent[0] ?? nowMs;
      const retryAfterMs = Math.max(1, this.policy.windowMs - (nowMs - oldest));
      this.buckets.set(key, recent);
      return {
        allowed: false,
        retryAfterMs,
        remaining: 0,
        limit: this.policy.maxRequests,
        windowMs: this.policy.windowMs,
      };
    }

    recent.push(nowMs);
    this.buckets.set(key, recent);
    return {
      allowed: true,
      retryAfterMs: 0,
      remaining: Math.max(0, this.policy.maxRequests - recent.length),
      limit: this.policy.maxRequests,
      windowMs: this.policy.windowMs,
    };
  }

  private prune(nowMs: number): void {
    const threshold = nowMs - this.policy.windowMs;
    for (const [key, timestamps] of this.buckets) {
      const recent = timestamps.filter((timestamp) => timestamp > threshold);
      if (recent.length === 0) {
        this.buckets.delete(key);
      } else {
        this.buckets.set(key, recent);
      }
    }
  }
}
