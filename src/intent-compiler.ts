import { ToolError } from "./errors.js";
import type { TreeSnapshot, ParsedNodeRecord } from "./tree-store.js";

/**
 * Represents a compiled operation to be executed
 */
export interface CompiledOperation {
  tool: string;
  args: Record<string, unknown>;
}

export class IntentCompiler {
  constructor(private snapshot: TreeSnapshot) {}

  public compile(
    intent: string,
    args: Record<string, unknown>,
    commonArgs: { file: string; transaction_id: string }
  ): CompiledOperation[] {
    switch (intent) {
      case "add_parameter":
        return this.compileAddParameter(args, commonArgs);
      case "insert_child":
        return [{ tool: "scalpel_insert_child", args: { ...commonArgs, ...args } }];
      case "replace_node":
        return [{ tool: "scalpel_replace_node", args: { ...commonArgs, ...args } }];
      case "remove_node":
        return [{ tool: "scalpel_remove_node", args: { ...commonArgs, ...args } }];
      case "move_subtree":
        return [{ tool: "scalpel_move_subtree", args: { ...commonArgs, ...args } }];
      default:
        throw new ToolError("INVALID_OPERATION", `Unknown intent: ${intent}`);
    }
  }

  private compileAddParameter(
    args: Record<string, unknown>,
    commonArgs: { file: string; transaction_id: string }
  ): CompiledOperation[] {
    const parentId = args.parent_node_id as string;
    if (!parentId) throw new ToolError("INVALID_OPERATION", "Missing parent_node_id for add_parameter");

    const parent = this.snapshot.nodesById.get(parentId);
    if (!parent) throw new ToolError("NOT_FOUND", `Parent node ${parentId} not found`);

    // Look for parameters list container
    // TS/JS: formal_parameters
    // Java: formal_parameters
    const paramsNodeId = this.findChildByType(parent, ["formal_parameters", "parameters"]);

    if (!paramsNodeId) {
      throw new ToolError("INVALID_OPERATION", `Could not find parameters list in node ${parentId} (${parent.type})`);
    }

    const paramsNode = this.snapshot.nodesById.get(paramsNodeId)!;
    // Determine position: default to end
    const index = typeof args.index === 'number' ? args.index : paramsNode.childCount;

    const descriptor = {
      type: "parameter",
      fields: {
        name: args.name,
        datatype: args.type,
        optional: args.optional,
        value: args.default_value,
      },
    };

    return [
      {
        tool: "scalpel_insert_child",
        args: {
          ...commonArgs,
          parent_node_id: paramsNodeId,
          position_index: index,
          node_descriptor: descriptor,
        },
      },
    ];
  }

  private findChildByType(node: ParsedNodeRecord, types: string[]): string | undefined {
    for (const childId of node.childrenNodeIds) {
      const child = this.snapshot.nodesById.get(childId);
      if (child && types.includes(child.type)) {
        return childId;
      }
    }
    return undefined;
  }
}
