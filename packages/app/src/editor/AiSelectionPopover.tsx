import { useCallback, useState } from "react";
import { AiDiffPreview } from "../components/AiDiffPreview";
import "./AiSelectionPopover.css";

const PRESETS: { label: string; instruction: string }[] = [
  { label: "Fix grammar", instruction: "Fix grammar and spelling mistakes. Keep the meaning and tone the same." },
  { label: "Improve writing", instruction: "Improve clarity and flow while preserving the meaning." },
  { label: "Shorten", instruction: "Make this more concise without losing key information." },
  { label: "Expand", instruction: "Expand this with more detail and explanation." },
];

export type AiSelectionPopoverProps = {
  originalText: string;
  onGenerate: (instruction: string, onDownloadProgress?: (fraction: number) => void) => Promise<string>;
  onAccept: (suggested: string) => void;
  onClose: () => void;
};

/** Instruction input (with quick-action presets) that drafts an AI edit for the current selection, then shows an AiDiffPreview to accept/reject before anything touches the document. */
export function AiSelectionPopover({ originalText, onGenerate, onAccept, onClose }: AiSelectionPopoverProps) {
  const [instruction, setInstruction] = useState("");
  const [generating, setGenerating] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<string | null>(null);

  const runGenerate = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      setGenerating(true);
      setError(null);
      setDownloadProgress(null);
      try {
        setSuggested(await onGenerate(text, setDownloadProgress));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setGenerating(false);
        setDownloadProgress(null);
      }
    },
    [onGenerate],
  );

  if (suggested !== null) {
    return (
      <AiDiffPreview
        original={originalText}
        suggested={suggested}
        onAccept={() => onAccept(suggested)}
        onReject={onClose}
      />
    );
  }

  return (
    <div className="mqpad-ai-selection-popover">
      <div className="mqpad-ai-selection-presets">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            disabled={generating}
            onClick={() => void runGenerate(preset.instruction)}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="mqpad-ai-selection-input-row">
        <input
          autoFocus
          type="text"
          placeholder="Or describe an edit, e.g. translate to Japanese"
          value={instruction}
          disabled={generating}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void runGenerate(instruction);
            } else if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
          }}
        />
        <button
          type="button"
          className="primary"
          disabled={generating || !instruction.trim()}
          onClick={() => void runGenerate(instruction)}
        >
          {generating
            ? downloadProgress !== null
              ? `Downloading model… ${Math.round(downloadProgress * 100)}%`
              : "Generating…"
            : "Generate"}
        </button>
      </div>
      {error && <span className="mqpad-ai-selection-error">{error}</span>}
    </div>
  );
}
