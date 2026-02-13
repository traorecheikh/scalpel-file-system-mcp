// Type declarations for tree-sitter parsers without official types
declare module "tree-sitter-css" {
  import { Language } from "tree-sitter";
  const language: Language;
  export default language;
}

declare module "tree-sitter-markdown" {
  import { Language } from "tree-sitter";
  const markdown: Language;
  export { markdown };
}

declare module "tree-sitter-yaml" {
  import { Language } from "tree-sitter";
  const language: Language;
  export default language;
}

declare module "tree-sitter-dart" {
  import { Language } from "tree-sitter";
  const language: Language;
  export default language;
}
