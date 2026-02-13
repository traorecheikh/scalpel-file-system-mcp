export const TOOL_NAMES = [
  "scalpel_begin_transaction",
  "scalpel_create_file",
  "scalpel_list_nodes",
  "scalpel_get_node",
  "scalpel_search_structure",
  "scalpel_edit_intent",
  "scalpel_insert_child",
  "scalpel_replace_node",
  "scalpel_remove_node",
  "scalpel_move_subtree",
  "scalpel_validate_transaction",
  "scalpel_commit",
  "scalpel_rollback",
  "scalpel_health_check",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];
