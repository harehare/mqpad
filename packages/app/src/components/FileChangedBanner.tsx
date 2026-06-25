import { VscClose } from "react-icons/vsc";
import "./FileChangedBanner.css";

export type FileChangedBannerProps = {
  message: string;
  actions?: { label: string; onClick: () => void }[];
  onDismiss?: () => void;
};

export function FileChangedBanner({ message, actions, onDismiss }: FileChangedBannerProps) {
  return (
    <div className="file-changed-banner">
      <span className="file-changed-banner-message">{message}</span>
      <div className="file-changed-banner-actions">
        {actions?.map((action) => (
          <button key={action.label} className="file-changed-banner-button" onClick={action.onClick}>
            {action.label}
          </button>
        ))}
        {onDismiss && (
          <button className="file-changed-banner-dismiss" onClick={onDismiss} aria-label="Dismiss" title="Dismiss">
            <VscClose size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
