import path from "node:path";
import { z } from "zod";

const LogLevelSchema = z.enum(["debug", "info", "warn", "error"]);
const BooleanFlagSchema = z.enum(["true", "false"]).transform((value) => value === "true");

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: LogLevelSchema.default("info"),
  SCALPEL_SERVER_NAME: z.string().min(1).default("scalpel-mcp"),
  SCALPEL_SERVER_VERSION: z.string().min(1).default("0.1.0"),
  SCALPEL_WORKSPACE_ROOT: z.string().optional(),
  SCALPEL_TRANSACTION_TTL_MS: z.coerce.number().int().min(60_000).default(900_000),
  SCALPEL_RATE_LIMIT_GLOBAL_MAX: z.coerce.number().int().min(1).max(100_000).default(600),
  SCALPEL_RATE_LIMIT_GLOBAL_WINDOW_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(3_600_000)
    .default(60_000),
  SCALPEL_RATE_LIMIT_SESSION_MAX: z.coerce.number().int().min(1).max(100_000).default(300),
  SCALPEL_RATE_LIMIT_SESSION_WINDOW_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(3_600_000)
    .default(60_000),
  SCALPEL_RATE_LIMIT_MUTATION_MAX: z.coerce.number().int().min(1).max(100_000).default(120),
  SCALPEL_RATE_LIMIT_MUTATION_WINDOW_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(3_600_000)
    .default(60_000),
  SCALPEL_AUDIT_LOG_ENABLED: BooleanFlagSchema.default("true"),
});

export type LogLevel = z.infer<typeof LogLevelSchema>;

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface AppConfig {
  nodeEnv: "development" | "test" | "production";
  logLevel: LogLevel;
  serverName: string;
  serverVersion: string;
  workspaceRoot: string;
  transactionTtlMs: number;
  rateLimits: {
    global: RateLimitConfig;
    session: RateLimitConfig;
    mutationTool: RateLimitConfig;
  };
  auditLogEnabled: boolean;
}

export function loadConfig(cwd: string = process.cwd()): AppConfig {
  const env = EnvSchema.parse(process.env);
  const workspaceRoot = path.resolve(env.SCALPEL_WORKSPACE_ROOT ?? cwd);

  return {
    nodeEnv: env.NODE_ENV,
    logLevel: env.LOG_LEVEL,
    serverName: env.SCALPEL_SERVER_NAME,
    serverVersion: env.SCALPEL_SERVER_VERSION,
    workspaceRoot,
    transactionTtlMs: env.SCALPEL_TRANSACTION_TTL_MS,
    rateLimits: {
      global: {
        maxRequests: env.SCALPEL_RATE_LIMIT_GLOBAL_MAX,
        windowMs: env.SCALPEL_RATE_LIMIT_GLOBAL_WINDOW_MS,
      },
      session: {
        maxRequests: env.SCALPEL_RATE_LIMIT_SESSION_MAX,
        windowMs: env.SCALPEL_RATE_LIMIT_SESSION_WINDOW_MS,
      },
      mutationTool: {
        maxRequests: env.SCALPEL_RATE_LIMIT_MUTATION_MAX,
        windowMs: env.SCALPEL_RATE_LIMIT_MUTATION_WINDOW_MS,
      },
    },
    auditLogEnabled: env.SCALPEL_AUDIT_LOG_ENABLED,
  };
}
