import { useState } from "react";
import { LuTrash2 } from "react-icons/lu";
import type { Template } from "../useTemplates";
import "./SettingsDialog.css";
import "./TemplatesDialog.css";

type TemplatesDialogProps = {
  templates: Template[];
  onAdd: (name: string, content: string) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
};

/** Manages reusable note templates: add a name + Markdown body, remove existing ones. Templates are inserted via "New File from Template..." or the `/` slash menu. */
export function TemplatesDialog({ templates, onAdd, onRemove, onClose }: TemplatesDialogProps) {
  const [name, setName] = useState("");
  const [content, setContent] = useState("");

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), content);
    setName("");
    setContent("");
  };

  return (
    <div className="mqpad-settings-overlay" onClick={onClose}>
      <div className="mqpad-settings-dialog mqpad-templates-dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Templates</h2>
        {templates.length > 0 && (
          <div className="mqpad-templates-list">
            {templates.map((t) => (
              <div key={t.id} className="mqpad-templates-item">
                <span className="mqpad-templates-item-name">{t.name}</span>
                <button
                  type="button"
                  className="mqpad-templates-item-remove"
                  onClick={() => onRemove(t.id)}
                  title="Delete"
                  aria-label={`Delete ${t.name}`}
                >
                  <LuTrash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="mqpad-settings-field">
          <label htmlFor="mqpad-template-name">Name</label>
          <input
            id="mqpad-template-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Meeting Notes"
          />
        </div>
        <div className="mqpad-settings-field">
          <label htmlFor="mqpad-template-content">Content (Markdown)</label>
          <textarea
            id="mqpad-template-content"
            className="mqpad-templates-textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={"# Meeting Notes\n\n- Attendees:\n- Notes:"}
            rows={8}
          />
        </div>
        <div className="mqpad-settings-actions">
          <button type="button" onClick={onClose}>
            Close
          </button>
          <button type="button" className="primary" onClick={handleAdd} disabled={!name.trim()}>
            Add Template
          </button>
        </div>
      </div>
    </div>
  );
}
