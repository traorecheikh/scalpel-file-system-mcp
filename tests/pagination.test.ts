import assert from "node:assert";
import { test } from "node:test";
import { paginate, encodeCursor, decodeCursor } from "../src/pagination.js";

test("Pagination: encodes and decodes cursors", () => {
  const data = { lastIndex: 5, treeVersion: 2 };
  const cursor = encodeCursor(data);
  const decoded = decodeCursor(cursor);
  assert.deepStrictEqual(decoded, data);
});

test("Pagination: returns first page", () => {
  const items = [1, 2, 3, 4, 5];
  const { items: paginated, pagination } = paginate(items, 2);
  
  assert.deepStrictEqual(paginated, [1, 2]);
  assert.strictEqual(pagination.has_more, true);
  assert.strictEqual(pagination.returned_count, 2);
  assert.strictEqual(pagination.total_count, 5);
  assert.ok(pagination.next_cursor);
});

test("Pagination: returns last page", () => {
  const items = [1, 2, 3, 4, 5];
  const cursor = encodeCursor({ lastIndex: 3, treeVersion: 0 });
  const { items: paginated, pagination } = paginate(items, 2, cursor);
  
  assert.deepStrictEqual(paginated, [5]);
  assert.strictEqual(pagination.has_more, false);
  assert.strictEqual(pagination.returned_count, 1);
  assert.strictEqual(pagination.total_count, 5);
  assert.strictEqual(pagination.next_cursor, undefined);
});

test("Pagination: handles limit larger than items", () => {
  const items = [1, 2, 3];
  const { items: paginated, pagination } = paginate(items, 10);
  
  assert.deepStrictEqual(paginated, [1, 2, 3]);
  assert.strictEqual(pagination.has_more, false);
  assert.strictEqual(pagination.next_cursor, undefined);
});
