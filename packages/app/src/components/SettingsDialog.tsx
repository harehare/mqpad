import { useState } from "react";
import { THEME_LABELS, type ThemeName, themes } from "../theme/themes";
import {
  FONT_LABELS,
  PAGE_WIDTH_LABELS,
  type FontChoice,
  type PageWidth,
  type Preferences,
  type TextDirection,
} from "../theme/usePreferences";
import "./SettingsDialog.css";

type SettingsDialogProps = {
  vaultRootLabel: string;
  vaultRoot: string;
  /** False when the vault root can only be changed through a native settings UI (VS Code). */
  vaultRootEditable?: boolean;
  onSave: (vaultRoot: string) => void;
  onClose: () => void;
  theme: ThemeName;
  onThemeChange: (theme: ThemeName) => void;
  preferences: Preferences;
  onPreferencesChange: (next: Partial<Preferences>) => void;
};

export const SettingsDialog = ({
  vaultRootLabel,
  vaultRoot,
  vaultRootEditable = true,
  onSave,
  onClose,
  theme,
  onThemeChange,
  preferences,
  onPreferencesChange,
}: SettingsDialogProps) => {
  const [value, setValue] = useState(vaultRoot);

  return (
    <div className="mqpad-settings-overlay" onClick={onClose}>
      <div className="mqpad-settings-dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>
        <div className="mqpad-settings-field">
          <label htmlFor="mqpad-theme">Theme</label>
          <select
            id="mqpad-theme"
            value={theme}
            onChange={(e) => onThemeChange(e.target.value as ThemeName)}
          >
            {Object.keys(themes).map((name) => (
              <option key={name} value={name}>
                {THEME_LABELS[name as ThemeName]}
              </option>
            ))}
          </select>
        </div>
        <div className="mqpad-settings-field">
          <label htmlFor="mqpad-font">Typography</label>
          <select
            id="mqpad-font"
            value={preferences.font}
            onChange={(e) => onPreferencesChange({ font: e.target.value as FontChoice })}
          >
            {Object.entries(FONT_LABELS).map(([name, label]) => (
              <option key={name} value={name}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="mqpad-settings-field">
          <label htmlFor="mqpad-page-width">Page Width</label>
          <select
            id="mqpad-page-width"
            value={preferences.pageWidth}
            onChange={(e) => onPreferencesChange({ pageWidth: e.target.value as PageWidth })}
          >
            {Object.entries(PAGE_WIDTH_LABELS).map(([name, label]) => (
              <option key={name} value={name}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="mqpad-settings-field">
          <label htmlFor="mqpad-direction">Text Direction</label>
          <select
            id="mqpad-direction"
            value={preferences.direction}
            onChange={(e) => onPreferencesChange({ direction: e.target.value as TextDirection })}
          >
            <option value="ltr">Left-to-right</option>
            <option value="rtl">Right-to-left</option>
          </select>
        </div>
        <div className="mqpad-settings-field">
          <label htmlFor="mqpad-vault-root">{vaultRootLabel}</label>
          {vaultRootEditable ? (
            <input id="mqpad-vault-root" type="text" value={value} onChange={(e) => setValue(e.target.value)} />
          ) : (
            <input id="mqpad-vault-root" type="text" value={vaultRoot} readOnly />
          )}
        </div>
        <div className="mqpad-settings-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => {
              onSave(value.trim());
              onClose();
            }}
          >
            {vaultRootEditable ? "Save" : "Open Settings"}
          </button>
        </div>
      </div>
    </div>
  );
};
