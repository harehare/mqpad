import { diffWords } from "diff";
import "./AiDiffPreview.css";

export type AiDiffPreviewProps = {
  original: string;
  suggested: string;
  onAccept: () => void;
  onReject: () => void;
};

/** Word-level diff between the original selection and the AI's suggested replacement, with Accept/Reject - nothing is applied to the document until the user accepts. */
export function AiDiffPreview({ original, suggested, onAccept, onReject }: AiDiffPreviewProps) {
  const parts = diffWords(original, suggested);

  return (
    <div className="mqpad-ai-diff">
      <div className="mqpad-ai-diff-text">
        {parts.map((part, i) => (
          <span
            key={i}
            className={part.added ? "mqpad-ai-diff-added" : part.removed ? "mqpad-ai-diff-removed" : undefined}
          >
            {part.value}
          </span>
        ))}
      </div>
      <div className="mqpad-ai-diff-actions">
        <button type="button" onClick={onReject}>
          Reject
        </button>
        <button type="button" className="primary" onClick={onAccept}>
          Accept
        </button>
      </div>
    </div>
  );
}
