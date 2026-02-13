import { randomUUID } from "node:crypto";
import type { SupportedLanguage } from "./schemas.js";
import { ToolError } from "./errors.js";
import type { Logger } from "./logger.js";

export interface TransactionSession {
  transactionId: string;
  file: string;
  absoluteFilePath: string;
  language: SupportedLanguage;
  baseVersion: number;
  workingVersion: number;
  committedVersion: number;
  createdAt: string;
  updatedAt: string;
}

export type TransactionCloseReason = "closed" | "expired";
export type TransactionCloseHandler = (
  transactionId: string,
  reason: TransactionCloseReason,
) => void;

export class TransactionStore {
  private readonly sessions = new Map<string, TransactionSession>();
  private readonly closeHandlers = new Set<TransactionCloseHandler>();

  public constructor(
    private readonly ttlMs: number,
    private readonly logger: Logger,
  ) {
    setInterval(() => {
      this.cleanupExpired();
    }, Math.min(ttlMs, 60_000)).unref();
  }

  public begin(
    file: string,
    absoluteFilePath: string,
    language: SupportedLanguage,
  ): TransactionSession {
    const now = new Date().toISOString();

    const session: TransactionSession = {
      transactionId: randomUUID(),
      file,
      absoluteFilePath,
      language,
      baseVersion: 1,
      workingVersion: 1,
      committedVersion: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.set(session.transactionId, session);
    return session;
  }

  public get(transactionId: string): TransactionSession | undefined {
    return this.sessions.get(transactionId);
  }

  public require(transactionId: string): TransactionSession {
    const session = this.sessions.get(transactionId);
    if (!session) {
      throw new ToolError("NOT_FOUND", "Transaction not found", {
        transaction_id: transactionId,
      });
    }
    return session;
  }

  public touch(transactionId: string): TransactionSession {
    const session = this.require(transactionId);
    session.updatedAt = new Date().toISOString();
    this.sessions.set(transactionId, session);
    return session;
  }

  public close(transactionId: string): void {
    const existed = this.sessions.delete(transactionId);
    if (existed) {
      this.emitClosed(transactionId, "closed");
    }
  }

  public countActive(): number {
    return this.sessions.size;
  }

  private cleanupExpired(): void {
    const now = Date.now();
    let removed = 0;

    for (const [transactionId, session] of this.sessions) {
      const lastUpdated = Date.parse(session.updatedAt);
      if (Number.isNaN(lastUpdated)) {
        continue;
      }
      if (now - lastUpdated > this.ttlMs) {
        this.sessions.delete(transactionId);
        this.emitClosed(transactionId, "expired");
        removed += 1;
      }
    }

    if (removed > 0) {
      this.logger.info("Expired transactions cleaned up", { removed });
    }
  }

  public onClose(handler: TransactionCloseHandler): () => void {
    this.closeHandlers.add(handler);
    return () => {
      this.closeHandlers.delete(handler);
    };
  }

  private emitClosed(
    transactionId: string,
    reason: TransactionCloseReason,
  ): void {
    for (const handler of this.closeHandlers) {
      handler(transactionId, reason);
    }
  }
}
