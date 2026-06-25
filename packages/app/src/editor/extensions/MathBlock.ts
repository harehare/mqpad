import { InputRule, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { MathBlockView } from "./MathBlockView";

/**
 * A block KaTeX equation (`$$...$$`). Like MqCodeBlock, the source lives in
 * an attr rather than as node content, so editing it can swap between a raw
 * textarea and the rendered KaTeX output without fighting ProseMirror's text
 * model.
 */
export const MathBlock = Node.create({
  name: "mathBlock",
  group: "block",
  atom: true,
  isolating: true,

  addAttributes() {
    return {
      source: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-math-block]" }];
  },

  renderHTML() {
    return ["div", { "data-math-block": "" }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathBlockView);
  },

  addInputRules() {
    return [
      new InputRule({
        find: /^\$\$[ \n]$/,
        handler: ({ state, range }) => {
          const node = this.type.create({ source: "" });
          state.tr.replaceRangeWith(range.from, range.to, node);
        },
      }),
    ];
  },
});
