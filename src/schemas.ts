import { z } from "zod";
import type { ToolName } from "./tool-names.js";

export const SupportedLanguageSchema = z.enum([
  "typescript",
  "javascript",
  "dart",
  "java",
  "rust",
]);

const FilePathSchema = z.string().min(1).max(4096);
const TransactionIdSchema = z.string().min(1).max(128);
const NodeIdSchema = z.string().min(1).max(256);
const DescriptorTypeSchema = z.enum([
  "identifier",
  "literal",
  "parameter",
  "field",
  "import_specifier",
  "raw_node",
]);

const NodeDescriptorSchema = z.union([
  z
    .object({
      type: DescriptorTypeSchema,
      value: z.unknown().optional(),
      fields: z.record(z.unknown()).optional(),
    })
    .strict(),
  z.string().min(1).max(1024),
]);

export const ScalpelBeginTransactionArgsSchema = z
  .object({
    file: FilePathSchema,
    language: SupportedLanguageSchema.optional(),
  })
  .strict();

export const ScalpelListNodesArgsSchema = z
  .object({
    file: FilePathSchema,
    transaction_id: TransactionIdSchema,
    depth: z.number().int().min(0).max(32).default(2),
    filter_by_type: z.array(z.string().min(1).max(128)).max(64).optional(),
  })
  .strict();

export const ScalpelGetNodeArgsSchema = z
  .object({
    file: FilePathSchema,
    transaction_id: TransactionIdSchema,
    node_id: NodeIdSchema,
    include_text: z.boolean().default(false),
    max_excerpt_bytes: z.number().int().min(32).max(16_384).default(512),
  })
  .strict();

export const ScalpelSearchStructureArgsSchema = z
  .object({
    file: FilePathSchema,
    transaction_id: TransactionIdSchema,
    selector: z.string().min(1).max(1024),
  })
  .strict();

const EditIntentSchema = z.object({
  intent: z.string().min(1).max(64),
  args: z.record(z.unknown()),
});

export const ScalpelEditIntentArgsSchema = z
  .object({
    file: FilePathSchema,
    transaction_id: TransactionIdSchema,
    intents: z.array(EditIntentSchema).max(100),
    dry_run: z.boolean().default(false),
  })
  .strict();

export const ScalpelInsertChildArgsSchema = z
  .object({
    file: FilePathSchema,
    transaction_id: TransactionIdSchema,
    parent_node_id: NodeIdSchema,
    position_index: z.number().int().min(0).max(10_000_000),
    node_descriptor: NodeDescriptorSchema,
  })
  .strict();

export const ScalpelReplaceNodeArgsSchema = z
  .object({
    file: FilePathSchema,
    transaction_id: TransactionIdSchema,
    node_id: NodeIdSchema,
    new_node_descriptor: NodeDescriptorSchema,
  })
  .strict();

export const ScalpelRemoveNodeArgsSchema = z
  .object({
    file: FilePathSchema,
    transaction_id: TransactionIdSchema,
    node_id: NodeIdSchema,
  })
  .strict();

export const ScalpelMoveSubtreeArgsSchema = z
  .object({
    file: FilePathSchema,
    transaction_id: TransactionIdSchema,
    node_id: NodeIdSchema,
    new_parent_id: NodeIdSchema,
    new_position: z.number().int().min(0).max(10_000_000),
  })
  .strict();

export const ScalpelValidateTransactionArgsSchema = z
  .object({
    file: FilePathSchema,
    transaction_id: TransactionIdSchema,
  })
  .strict();

export const ScalpelCommitArgsSchema = z
  .object({
    file: FilePathSchema,
    transaction_id: TransactionIdSchema,
  })
  .strict();

export const ScalpelRollbackArgsSchema = z
  .object({
    file: FilePathSchema,
    transaction_id: TransactionIdSchema,
  })
  .strict();

export const ScalpelHealthCheckArgsSchema = z.object({}).strict();

export const TOOL_SCHEMAS: Record<ToolName, z.ZodTypeAny> = {
  scalpel_begin_transaction: ScalpelBeginTransactionArgsSchema,
  scalpel_list_nodes: ScalpelListNodesArgsSchema,
  scalpel_get_node: ScalpelGetNodeArgsSchema,
  scalpel_search_structure: ScalpelSearchStructureArgsSchema,
  scalpel_edit_intent: ScalpelEditIntentArgsSchema,
  scalpel_insert_child: ScalpelInsertChildArgsSchema,
  scalpel_replace_node: ScalpelReplaceNodeArgsSchema,
  scalpel_remove_node: ScalpelRemoveNodeArgsSchema,
  scalpel_move_subtree: ScalpelMoveSubtreeArgsSchema,
  scalpel_validate_transaction: ScalpelValidateTransactionArgsSchema,
  scalpel_commit: ScalpelCommitArgsSchema,
  scalpel_rollback: ScalpelRollbackArgsSchema,
  scalpel_health_check: ScalpelHealthCheckArgsSchema,
};

export type SupportedLanguage = z.infer<typeof SupportedLanguageSchema>;
export type ScalpelBeginTransactionArgs = z.infer<
  typeof ScalpelBeginTransactionArgsSchema
>;
export type ScalpelListNodesArgs = z.infer<typeof ScalpelListNodesArgsSchema>;
export type ScalpelGetNodeArgs = z.infer<typeof ScalpelGetNodeArgsSchema>;
export type ScalpelSearchStructureArgs = z.infer<
  typeof ScalpelSearchStructureArgsSchema
>;
export type ScalpelEditIntentArgs = z.infer<typeof ScalpelEditIntentArgsSchema>;
export type ScalpelInsertChildArgs = z.infer<
  typeof ScalpelInsertChildArgsSchema
>;
export type ScalpelReplaceNodeArgs = z.infer<
  typeof ScalpelReplaceNodeArgsSchema
>;
export type ScalpelRemoveNodeArgs = z.infer<
  typeof ScalpelRemoveNodeArgsSchema
>;
export type ScalpelMoveSubtreeArgs = z.infer<
  typeof ScalpelMoveSubtreeArgsSchema
>;
export type ScalpelValidateTransactionArgs = z.infer<
  typeof ScalpelValidateTransactionArgsSchema
>;
export type ScalpelCommitArgs = z.infer<typeof ScalpelCommitArgsSchema>;
export type ScalpelRollbackArgs = z.infer<typeof ScalpelRollbackArgsSchema>;
