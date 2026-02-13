import type { ToolName } from "./tool-names.js";

interface ToolDefinition {
  name: ToolName;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "scalpel_begin_transaction",
    description:
      "Open a deterministic mutation transaction for a single structured source file.",
    inputSchema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          minLength: 1,
          maxLength: 4096,
          description: "Workspace-relative file path.",
        },
        language: {
          type: "string",
          enum: [
            "css",
            "dart",
            "go",
            "html",
            "java",
            "javascript",
            "json",
            "markdown",
            "python",
            "rust",
            "typescript",
            "yaml",
          ],
          description: "Optional language override.",
        },
      },
      required: ["file"],
      additionalProperties: false,
    },
  },
  {
    name: "scalpel_create_file",
    description: "Create a new file and automatically start a mutation transaction.",
    inputSchema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          minLength: 1,
          maxLength: 4096,
          description: "Workspace-relative file path.",
        },
        language: {
          type: "string",
          enum: [
            "css",
            "dart",
            "go",
            "html",
            "java",
            "javascript",
            "json",
            "markdown",
            "python",
            "rust",
            "typescript",
            "yaml",
          ],
          description: "Language of the file (inferred from extension if not provided).",
        },
        initial_content: {
          type: "string",
          maxLength: 10000000,
          description: "Optional initial content for the file.",
          default: "",
        },
        overwrite: {
          type: "boolean",
          description: "Overwrite if file already exists.",
          default: false,
        },
      },
      required: ["file"],
      additionalProperties: false,
    },
  },
  {
    name: "scalpel_list_nodes",
    description:
      "List structural nodes for a file in the active transaction, optionally filtered by type.",
    inputSchema: {
      type: "object",
      properties: {
        file: { type: "string", minLength: 1, maxLength: 4096 },
        transaction_id: { type: "string", minLength: 1, maxLength: 128 },
        depth: { type: "integer", minimum: 0, maximum: 32, default: 2 },
        filter_by_type: {
          type: "array",
          items: { type: "string", minLength: 1, maxLength: 128 },
          maxItems: 64,
        },
      },
      required: ["file", "transaction_id"],
      additionalProperties: false,
    },
  },
  {
    name: "scalpel_search_structure",
    description:
      "Search for nodes using a simplified structural query language or raw tree-sitter queries.",
    inputSchema: {
      type: "object",
      properties: {
        file: { type: "string", minLength: 1, maxLength: 4096 },
        transaction_id: { type: "string", minLength: 1, maxLength: 128 },
        selector: {
          type: "string",
          minLength: 1,
          maxLength: 1024,
          description: "Structural selector (e.g. 'function_declaration[name=\"foo\"]') or raw tree-sitter query.",
        },
      },
      required: ["file", "transaction_id", "selector"],
      additionalProperties: false,
    },
  },
  {
    name: "scalpel_edit_intent",
    description:
      "Execute a batch of structural edits or high-level intent macros.",
    inputSchema: {
      type: "object",
      properties: {
        file: { type: "string", minLength: 1, maxLength: 4096 },
        transaction_id: { type: "string", minLength: 1, maxLength: 128 },
        intents: {
          type: "array",
          items: {
            type: "object",
            properties: {
              intent: { type: "string", minLength: 1, maxLength: 64 },
              args: { type: "object", additionalProperties: true },
            },
            required: ["intent", "args"],
          },
          maxItems: 100,
        },
        dry_run: { type: "boolean", default: false },
      },
      required: ["file", "transaction_id", "intents"],
      additionalProperties: false,
    },
  },
  {
    name: "scalpel_get_node",
    description:
      "Fetch metadata for one node by node ID, with optional bounded text excerpt.",
    inputSchema: {
      type: "object",
      properties: {
        file: { type: "string", minLength: 1, maxLength: 4096 },
        transaction_id: { type: "string", minLength: 1, maxLength: 128 },
        node_id: { type: "string", minLength: 1, maxLength: 256 },
        include_text: { type: "boolean", default: false },
        max_excerpt_bytes: {
          type: "integer",
          minimum: 32,
          maximum: 16384,
          default: 512,
        },
      },
      required: ["file", "transaction_id", "node_id"],
      additionalProperties: false,
    },
  },
  {
    name: "scalpel_insert_child",
    description:
      "Insert a structured child node at a specific index under a parent node.",
    inputSchema: {
      type: "object",
      properties: {
        file: { type: "string", minLength: 1, maxLength: 4096 },
        transaction_id: { type: "string", minLength: 1, maxLength: 128 },
        parent_node_id: { type: "string", minLength: 1, maxLength: 256 },
        position_index: { type: "integer", minimum: 0, maximum: 10000000 },
        node_descriptor: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: [
                "identifier",
                "literal",
                "parameter",
                "field",
                "import_specifier",
                "raw_node",
              ],
              description:
                "Descriptor kind. Use raw_node with fields.node_type for direct low-level node injection.",
            },
            value: {},
            fields: { type: "object", additionalProperties: true },
          },
          required: ["type"],
          additionalProperties: false,
        },
      },
      required: [
        "file",
        "transaction_id",
        "parent_node_id",
        "position_index",
        "node_descriptor",
      ],
      additionalProperties: false,
    },
  },
  {
    name: "scalpel_replace_node",
    description: "Replace one node with a new structured node descriptor.",
    inputSchema: {
      type: "object",
      properties: {
        file: { type: "string", minLength: 1, maxLength: 4096 },
        transaction_id: { type: "string", minLength: 1, maxLength: 128 },
        node_id: { type: "string", minLength: 1, maxLength: 256 },
        new_node_descriptor: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: [
                "identifier",
                "literal",
                "parameter",
                "field",
                "import_specifier",
                "raw_node",
              ],
              description:
                "Descriptor kind. Use raw_node with fields.node_type for direct low-level node replacement.",
            },
            value: {},
            fields: { type: "object", additionalProperties: true },
          },
          required: ["type"],
          additionalProperties: false,
        },
      },
      required: ["file", "transaction_id", "node_id", "new_node_descriptor"],
      additionalProperties: false,
    },
  },
  {
    name: "scalpel_remove_node",
    description: "Remove a structural node by node ID.",
    inputSchema: {
      type: "object",
      properties: {
        file: { type: "string", minLength: 1, maxLength: 4096 },
        transaction_id: { type: "string", minLength: 1, maxLength: 128 },
        node_id: { type: "string", minLength: 1, maxLength: 256 },
      },
      required: ["file", "transaction_id", "node_id"],
      additionalProperties: false,
    },
  },
  {
    name: "scalpel_move_subtree",
    description:
      "Move an existing node under a new parent and position, preserving subtree identity.",
    inputSchema: {
      type: "object",
      properties: {
        file: { type: "string", minLength: 1, maxLength: 4096 },
        transaction_id: { type: "string", minLength: 1, maxLength: 128 },
        node_id: { type: "string", minLength: 1, maxLength: 256 },
        new_parent_id: { type: "string", minLength: 1, maxLength: 256 },
        new_position: { type: "integer", minimum: 0, maximum: 10000000 },
      },
      required: [
        "file",
        "transaction_id",
        "node_id",
        "new_parent_id",
        "new_position",
      ],
      additionalProperties: false,
    },
  },
  {
    name: "scalpel_validate_transaction",
    description:
      "Validate transaction integrity before commit (grammar and structural invariants).",
    inputSchema: {
      type: "object",
      properties: {
        file: { type: "string", minLength: 1, maxLength: 4096 },
        transaction_id: { type: "string", minLength: 1, maxLength: 128 },
      },
      required: ["file", "transaction_id"],
      additionalProperties: false,
    },
  },
  {
    name: "scalpel_commit",
    description:
      "Commit transaction state to disk with deterministic serialization and summary metadata.",
    inputSchema: {
      type: "object",
      properties: {
        file: { type: "string", minLength: 1, maxLength: 4096 },
        transaction_id: { type: "string", minLength: 1, maxLength: 128 },
      },
      required: ["file", "transaction_id"],
      additionalProperties: false,
    },
  },
  {
    name: "scalpel_rollback",
    description: "Rollback and discard the active transaction state for a file.",
    inputSchema: {
      type: "object",
      properties: {
        file: { type: "string", minLength: 1, maxLength: 4096 },
        transaction_id: { type: "string", minLength: 1, maxLength: 128 },
      },
      required: ["file", "transaction_id"],
      additionalProperties: false,
    },
  },
  {
    name: "scalpel_health_check",
    description: "Return runtime health, uptime, and capability metadata.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
];
