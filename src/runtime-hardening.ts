import { constants } from "node:fs";
import { access, stat } from "node:fs/promises";
import type { AppConfig } from "./config.js";
import type { Logger } from "./logger.js";

export async function runStartupHardeningChecks(
  config: AppConfig,
  logger: Logger,
): Promise<void> {
  await assertWorkspaceAccess(config.workspaceRoot);

  if (config.nodeEnv !== "production") {
    return;
  }

  if (config.logLevel === "debug") {
    logger.warn("Production hardening warning", {
      issue: "debug log level is enabled",
    });
  }

  if (!config.auditLogEnabled) {
    logger.warn("Production hardening warning", {
      issue: "mutation audit logging is disabled",
    });
  }

  if (
    config.rateLimits.session.maxRequests > config.rateLimits.global.maxRequests
  ) {
    logger.warn("Production hardening warning", {
      issue: "session rate limit exceeds global rate limit",
      session_limit: config.rateLimits.session.maxRequests,
      global_limit: config.rateLimits.global.maxRequests,
    });
  }

  if (
    config.rateLimits.mutationTool.maxRequests > config.rateLimits.global.maxRequests
  ) {
    logger.warn("Production hardening warning", {
      issue: "mutation tool rate limit exceeds global rate limit",
      mutation_limit: config.rateLimits.mutationTool.maxRequests,
      global_limit: config.rateLimits.global.maxRequests,
    });
  }

  logger.info("Production hardening checks passed", {
    workspaceRoot: config.workspaceRoot,
  });
}

async function assertWorkspaceAccess(workspaceRoot: string): Promise<void> {
  const metadata = await stat(workspaceRoot);
  if (!metadata.isDirectory()) {
    throw new Error(`Workspace root is not a directory: ${workspaceRoot}`);
  }

  await access(workspaceRoot, constants.R_OK | constants.W_OK);
}
