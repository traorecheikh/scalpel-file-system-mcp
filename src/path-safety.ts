import path from "node:path";
import { ToolError } from "./errors.js";

export function resolveWorkspacePath(
  workspaceRoot: string,
  requestedPath: string,
): string {
  const absolutePath = path.resolve(workspaceRoot, requestedPath);
  const absoluteRoot = path.resolve(workspaceRoot);
  const normalizedRootWithSep = absoluteRoot.endsWith(path.sep)
    ? absoluteRoot
    : `${absoluteRoot}${path.sep}`;

  const isRoot = absolutePath === absoluteRoot;
  const isInsideRoot = absolutePath.startsWith(normalizedRootWithSep);

  if (!isRoot && !isInsideRoot) {
    throw new ToolError("INVALID_OPERATION", "Path traversal attempt detected");
  }

  return absolutePath;
}
