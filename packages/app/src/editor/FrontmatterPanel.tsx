import { useState } from "react";
import { LuChevronDown, LuChevronRight, LuPlus, LuTrash2 } from "react-icons/lu";
import { emptyRow, type FrontmatterRow, type FrontmatterRowType } from "./frontmatter";
import "./FrontmatterPanel.css";

const ROW_TYPES: FrontmatterRowType[] = ["string", "number", "boolean", "array"];

function defaultValueForType(type: FrontmatterRowType): FrontmatterRow["value"] {
  switch (type) {
    case "string":
      return "";
    case "number":
      return 0;
    case "boolean":
      return false;
    case "array":
      return [];
    case "unsupported":
      return "";
  }
}

export type FrontmatterPanelProps = {
  rows: FrontmatterRow[];
  onChange: (rows: FrontmatterRow[]) => void;
};

export function FrontmatterPanel({ rows, onChange }: FrontmatterPanelProps) {
  const [collapsed, setCollapsed] = useState(rows.length === 0);

  function updateRow(id: string, patch: Partial<FrontmatterRow>) {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setCollapsed(false);
    onChange([...rows, emptyRow()]);
  }

  function removeRow(id: string) {
    onChange(rows.filter((row) => row.id !== id));
  }

  return (
    <div className="mqpad-frontmatter">
      <button
        type="button"
        className="mqpad-frontmatter-header"
        onClick={() => setCollapsed((value) => !value)}
        aria-expanded={!collapsed}
      >
        {collapsed ? <LuChevronRight /> : <LuChevronDown />}
        <span>Frontmatter{rows.length > 0 ? ` (${rows.length})` : ""}</span>
      </button>
      {!collapsed && (
        <div className="mqpad-frontmatter-body">
          {rows.map((row) => (
            <FrontmatterRowEditor
              key={row.id}
              row={row}
              onChange={(patch) => updateRow(row.id, patch)}
              onRemove={() => removeRow(row.id)}
            />
          ))}
          <button type="button" className="mqpad-frontmatter-add" onClick={addRow}>
            <LuPlus /> Add field
          </button>
        </div>
      )}
    </div>
  );
}

function FrontmatterRowEditor({
  row,
  onChange,
  onRemove,
}: {
  row: FrontmatterRow;
  onChange: (patch: Partial<FrontmatterRow>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="mqpad-frontmatter-row">
      <input
        className="mqpad-frontmatter-key"
        type="text"
        value={row.key}
        placeholder="key"
        onChange={(e) => onChange({ key: e.target.value })}
      />
      <select
        className="mqpad-frontmatter-type"
        value={row.type === "unsupported" ? "unsupported" : row.type}
        disabled={row.type === "unsupported"}
        onChange={(e) => {
          const type = e.target.value as FrontmatterRowType;
          onChange({ type, value: defaultValueForType(type) });
        }}
      >
        {ROW_TYPES.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
        {row.type === "unsupported" && <option value="unsupported">complex value</option>}
      </select>
      <FrontmatterValueEditor row={row} onChange={onChange} />
      <button type="button" className="mqpad-frontmatter-remove" onClick={onRemove} aria-label="Remove field">
        <LuTrash2 />
      </button>
    </div>
  );
}

function FrontmatterValueEditor({
  row,
  onChange,
}: {
  row: FrontmatterRow;
  onChange: (patch: Partial<FrontmatterRow>) => void;
}) {
  switch (row.type) {
    case "string":
      return (
        <input
          className="mqpad-frontmatter-value"
          type="text"
          value={row.value as string}
          onChange={(e) => onChange({ value: e.target.value })}
        />
      );
    case "number":
      return (
        <input
          className="mqpad-frontmatter-value"
          type="number"
          value={row.value as number}
          onChange={(e) => onChange({ value: e.target.valueAsNumber || 0 })}
        />
      );
    case "boolean":
      return (
        <label className="mqpad-frontmatter-boolean">
          <input
            type="checkbox"
            checked={row.value as boolean}
            onChange={(e) => onChange({ value: e.target.checked })}
          />
          {row.value ? "true" : "false"}
        </label>
      );
    case "array":
      return <FrontmatterArrayEditor value={row.value as string[]} onChange={(value) => onChange({ value })} />;
    case "unsupported":
      return (
        <textarea
          className="mqpad-frontmatter-value mqpad-frontmatter-unsupported"
          value={JSON.stringify(row.value, null, 2)}
          readOnly
          rows={1}
          title="This field has a nested structure that isn't editable here - it's kept as-is."
        />
      );
  }
}

function FrontmatterArrayEditor({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  const [draft, setDraft] = useState("");

  function commitDraft() {
    const item = draft.trim();
    if (item) onChange([...value, item]);
    setDraft("");
  }

  return (
    <div className="mqpad-frontmatter-array">
      {value.map((item, index) => (
        <span className="mqpad-frontmatter-chip" key={index}>
          {item}
          <button
            type="button"
            aria-label={`Remove ${item}`}
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            ×
          </button>
        </span>
      ))}
      <input
        className="mqpad-frontmatter-array-input"
        type="text"
        value={draft}
        placeholder="add item"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commitDraft();
          } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={commitDraft}
      />
    </div>
  );
}
