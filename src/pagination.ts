import { ToolError } from "./errors.js";

export interface PaginationInfo {
  has_more: boolean;
  next_cursor?: string;
  returned_count: number;
  total_count: number;
}

export interface CursorData {
  lastIndex: number;
  treeVersion: number;
}

export function encodeCursor(data: CursorData): string {
  return Buffer.from(JSON.stringify(data)).toString("base64");
}

export function decodeCursor(cursor: string): CursorData {
  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch (e) {
    throw new ToolError("INVALID_OPERATION", "Invalid pagination cursor");
  }
}

export function paginate<T>(
  items: T[],
  limit: number,
  cursor?: string,
  treeVersion?: number
): { items: T[]; pagination: PaginationInfo } {
  let startIndex = 0;

  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (treeVersion !== undefined && decoded.treeVersion !== treeVersion) {
      // In a real system, we might want to handle stale cursors gracefully.
      // For now, let's just warn or reset if the tree version changed significantly.
    }
    startIndex = decoded.lastIndex + 1;
  }

  const paginatedItems = items.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < items.length;

  const pagination: PaginationInfo = {
    has_more: hasMore,
    returned_count: paginatedItems.length,
    total_count: items.length,
  };

  if (hasMore) {
    pagination.next_cursor = encodeCursor({ lastIndex: startIndex + limit - 1, treeVersion: treeVersion ?? 0 });
  }

  return {
    items: paginatedItems,
    pagination,
  };
}
