import CodeBlock from "@tiptap/extension-code-block";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CodeBlockView } from "./CodeBlockView";

/** StarterKit's codeBlock, extended with a NodeView that renders a live diagram preview for ```mermaid fences. */
export const CodeBlockWithPreview = CodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
});
