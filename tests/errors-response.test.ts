import assert from "node:assert/strict";
import test from "node:test";
import { ToolError, normalizeToolError } from "../src/errors.ts";
import { buildErrorEnvelope } from "../src/response.ts";

test("normalizes internal errors to generic message in production mode", () => {
  const normalized = normalizeToolError(new Error("raw internal failure"), {
    includeInternalMessage: false,
  });

  assert.equal(normalized.code, "INTERNAL_ERROR");
  assert.equal(normalized.message, "Internal server error");
});

test("keeps non-internal ToolError messages", () => {
  const normalized = normalizeToolError(
    new ToolError("INVALID_OPERATION", "Transaction/file mismatch"),
    {
      includeInternalMessage: false,
    },
  );

  assert.equal(normalized.code, "INVALID_OPERATION");
  assert.equal(normalized.message, "Transaction/file mismatch");
});

test("buildErrorEnvelope keeps stable error contract", () => {
  const envelope = buildErrorEnvelope(
    "req-42",
    "RATE_LIMITED",
    "Rate limit exceeded",
    {
      scope: "global",
      retry_after_ms: 250,
    },
  );

  assert.equal(envelope.success, false);
  if (envelope.success) {
    throw new Error("Expected error envelope");
  }

  assert.equal(envelope.error.code, "RATE_LIMITED");
  assert.equal(envelope.error.message, "Rate limit exceeded");
  assert.deepEqual(envelope.error.details, {
    scope: "global",
    retry_after_ms: 250,
  });
  assert.equal(envelope.metadata.requestId, "req-42");
  assert.ok(typeof envelope.metadata.timestamp === "string");
  assert.ok(envelope.metadata.timestamp.length > 0);
});
