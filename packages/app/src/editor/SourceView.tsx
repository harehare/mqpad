type SourceViewProps = {
  markdown: string;
  onChange: (markdown: string) => void;
  direction?: "ltr" | "rtl";
};

/** Raw markdown editing, toggled in from the WYSIWYG view via Cmd/Ctrl+Shift+M. */
export function SourceView({ markdown, onChange, direction = "ltr" }: SourceViewProps) {
  return (
    <textarea
      className="mqpad-source-view"
      value={markdown}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
      dir={direction}
      autoFocus
    />
  );
}
