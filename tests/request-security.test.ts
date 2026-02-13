import assert from "node:assert/strict";
import test from "node:test";
import type { AppConfig } from "../src/config.ts";
import { ToolError } from "../src/errors.ts";
import { RequestSecurityManager } from "../src/request-security.ts";

function createConfig(overrides?: Partial<AppConfig>): AppConfig {
  const base: AppConfig = {
    nodeEnv: "test",
    logLevel: "error",
    serverName: "scalpel-mcp",
    serverVersion: "0.1.0-test",
    workspaceRoot: "/tmp",
    transactionTtlMs: 60_000,
    rateLimits: {
      global: { maxRequests: 50, windowMs: 60_000 },
      session: { maxRequests: 50, windowMs: 60_000 },
      mutationTool: { maxRequests: 50, windowMs: 60_000 },
    },
    auditLogEnabled: true,
  };

  return {
    ...base,
    ...overrides,
    rateLimits: {
      global: overrides?.rateLimits?.global ?? base.rateLimits.global,
      session: overrides?.rateLimits?.session ?? base.rateLimits.session,
      mutationTool: overrides?.rateLimits?.mutationTool ?? base.rateLimits.mutationTool,
    },
  };
}

test("enforces global rate limit", () => {
  const manager = new RequestSecurityManager(
    createConfig({
      rateLimits: {
        global: { maxRequests: 2, windowMs: 60_000 },
        session: { maxRequests: 10, windowMs: 60_000 },
        mutationTool: { maxRequests: 10, windowMs: 60_000 },
      },
    }),
  );

  manager.enforceRateLimits({ tool: "scalpel_health_check" });
  manager.enforceRateLimits({ tool: "scalpel_health_check" });

  assert.throws(
    () => manager.enforceRateLimits({ tool: "scalpel_health_check" }),
    (error) => {
      assert.ok(error instanceof ToolError);
      assert.equal(error.code, "RATE_LIMITED");
      assert.equal(error.details?.scope, "global");
      return true;
    },
  );
});

test("enforces per-session rate limit", () => {
  const manager = new RequestSecurityManager(
    createConfig({
      rateLimits: {
        global: { maxRequests: 10, windowMs: 60_000 },
        session: { maxRequests: 1, windowMs: 60_000 },
        mutationTool: { maxRequests: 10, windowMs: 60_000 },
      },
    }),
  );

  manager.enforceRateLimits({
    tool: "scalpel_list_nodes",
    transactionId: "tx-1",
  });

  assert.throws(
    () =>
      manager.enforceRateLimits({
        tool: "scalpel_list_nodes",
        transactionId: "tx-1",
      }),
    (error) => {
      assert.ok(error instanceof ToolError);
      assert.equal(error.code, "RATE_LIMITED");
      assert.equal(error.details?.scope, "session");
      assert.equal(error.details?.transaction_id, "tx-1");
      return true;
    },
  );
});

test("enforces mutating-tool rate limit", () => {
  const manager = new RequestSecurityManager(
    createConfig({
      rateLimits: {
        global: { maxRequests: 10, windowMs: 60_000 },
        session: { maxRequests: 10, windowMs: 60_000 },
        mutationTool: { maxRequests: 1, windowMs: 60_000 },
      },
    }),
  );

  manager.enforceRateLimits({ tool: "scalpel_commit" });

  assert.throws(
    () => manager.enforceRateLimits({ tool: "scalpel_commit" }),
    (error) => {
      assert.ok(error instanceof ToolError);
      assert.equal(error.code, "RATE_LIMITED");
      assert.equal(error.details?.scope, "mutation_tool");
      assert.equal(error.details?.tool, "scalpel_commit");
      return true;
    },
  );
});
