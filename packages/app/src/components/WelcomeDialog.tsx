import { LuClipboard, LuKeyboard, LuLink, LuSlash, LuTerminal } from "react-icons/lu";
import { Logo } from "./Logo";
import "./WelcomeDialog.css";

type Feature = {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
};

const FEATURES: Feature[] = [
  {
    icon: <LuSlash size={16} />,
    title: "Slash commands",
    body: (
      <>
        Type <code>/</code> for headings, lists, tables, code blocks, and more.
      </>
    ),
  },
  {
    icon: <LuLink size={16} />,
    title: "Wikilinks",
    body: (
      <>
        Type <code>[[Note Name]]</code> to link another note - it's created automatically if it doesn't exist yet.
      </>
    ),
  },
  {
    icon: <LuTerminal size={16} />,
    title: "Live mq blocks",
    body: (
      <>
        A <code>```mq</code> fence runs as a live query against this document and shows its result inline.
      </>
    ),
  },
  {
    icon: <LuClipboard size={16} />,
    title: "Markdown-aware paste",
    body: "Paste Markdown text from anywhere and it's parsed straight into formatted headings, lists, and links.",
  },
  {
    icon: <LuKeyboard size={16} />,
    title: "Keyboard shortcuts",
    body: (
      <>
        <kbd>Cmd+K</kbd> opens the command palette, <kbd>Cmd+Shift+M</kbd> toggles raw Markdown source, and{" "}
        <kbd>Cmd+Shift+Enter</kbd> enters Focus Mode.
      </>
    ),
  },
];

export type WelcomeDialogProps = {
  onClose: () => void;
};

export function WelcomeDialog({ onClose }: WelcomeDialogProps) {
  return (
    <div className="mqpad-welcome-overlay" onClick={onClose}>
      <div className="mqpad-welcome-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="mqpad-welcome-header">
          <Logo size={28} />
          <h2>Welcome to mqpad</h2>
          <p>A WYSIWYG Markdown editor with Obsidian-style links and live mq code blocks.</p>
        </div>
        <ul className="mqpad-welcome-features">
          {FEATURES.map((feature) => (
            <li key={feature.title}>
              <span className="mqpad-welcome-feature-icon">{feature.icon}</span>
              <div>
                <strong>{feature.title}</strong>
                <p>{feature.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mqpad-welcome-actions">
          <button className="primary" onClick={onClose}>
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}
