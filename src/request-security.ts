import type { AppConfig } from "./config.js";
import { ToolError } from "./errors.js";
import { SlidingWindowRateLimiter, type RateLimitDecision } from "./rate-limiter.js";
import type { ToolName } from "./tool-names.js";

const MUTATING_TOOLS = new Set<ToolName>([
  "scalpel_insert_child",
  "scalpel_replace_node",
  "scalpel_remove_node",
  "scalpel_move_subtree",
  "scalpel_commit",
  "scalpel_rollback",
]);

export interface RateLimitContext {
  tool: ToolName;
  transactionId?: string;
}

export class RequestSecurityManager {
  private readonly globalLimiter: SlidingWindowRateLimiter;
  private readonly sessionLimiter: SlidingWindowRateLimiter;
  private readonly mutationToolLimiter: SlidingWindowRateLimiter;

  public constructor(config: AppConfig) {
    this.globalLimiter = new SlidingWindowRateLimiter(config.rateLimits.global);
    this.sessionLimiter = new SlidingWindowRateLimiter(config.rateLimits.session);
    this.mutationToolLimiter = new SlidingWindowRateLimiter(
      config.rateLimits.mutationTool,
    );
  }

  public enforceRateLimits(context: RateLimitContext): void {
    this.assertAllowed(this.globalLimiter.check("global"), {
      scope: "global",
    });

    if (context.transactionId) {
      this.assertAllowed(this.sessionLimiter.check(context.transactionId), {
        scope: "session",
        transaction_id: context.transactionId,
      });
    }

    if (isMutatingToolName(context.tool)) {
      this.assertAllowed(this.mutationToolLimiter.check(context.tool), {
        scope: "mutation_tool",
        tool: context.tool,
      });
    }
  }

  private assertAllowed(
    decision: RateLimitDecision,
    details: Record<string, unknown>,
  ): void {
    if (decision.allowed) {
      return;
    }

    throw new ToolError("RATE_LIMITED", "Rate limit exceeded", {
      ...details,
      retry_after_ms: decision.retryAfterMs,
      limit: decision.limit,
      window_ms: decision.windowMs,
    });
  }
}

export function isMutatingToolName(tool: ToolName): boolean {
  return MUTATING_TOOLS.has(tool);
}

export function extractTransactionId(args: unknown): string | undefined {
  if (!args || typeof args !== "object") {
    return undefined;
  }

  const value = (args as Record<string, unknown>).transaction_id;
  if (typeof value !== "string") {
    return undefined;
  }

  return value;
}
