import { InputRule, Node } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { MqCodeBlockView } from "./MqCodeBlockView";

export type MqCodeBlockOptions = {
  /** Serializes the whole document to markdown - used as $input for evaluation. */
  serializeDocument: (editor: Editor) => string;
};

/**
 * A live `mq` query block. While focused it shows the editable query; once
 * you click away it evaluates the query against the document's current
 * markdown and shows that result instead (re-evaluating again next time you
 * leave it). The result is reflected straight back into the saved markdown
 * as an adjacent ```mq-result fence.
 */
export const MqCodeBlock = Node.create<MqCodeBlockOptions>({
  name: "mqCodeBlock",
  group: "block",
  atom: true,
  isolating: true,

  addOptions() {
    return {
      serializeDocument: () => "",
    };
  },

  addAttributes() {
    return {
      query: { default: "" },
      result: { default: "" },
      /** "document" (default) evaluates against the open note; "vault" runs the query against every note. */
      scope: { default: "document" },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-mq-code-block]" }];
  },

  renderHTML() {
    return ["div", { "data-mq-code-block": "" }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MqCodeBlockView);
  },

  addInputRules() {
    return [
      new InputRule({
        find: /^```mq(-vault)?[ \n]$/,
        handler: ({ state, range, match }) => {
          const scope = match[1] ? "vault" : "document";
          const node = this.type.create({ query: "", result: "", scope });
          state.tr.replaceRangeWith(range.from, range.to, node);
        },
      }),
    ];
  },
});
