import React from 'react';
import { ModelSettings as ModelSettingsType } from '../types';

interface ModelSettingsProps {
  settings: ModelSettingsType;
  onSettingsChange: (settings: ModelSettingsType) => void;
  isCollapsed: boolean;
}

const ModelSettings: React.FC<ModelSettingsProps> = ({ settings, onSettingsChange, isCollapsed }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    onSettingsChange({
      ...settings,
      [name]: value
    });
  };

  return (
    <div className="model-settings">
      <h3>{isCollapsed ? '⚙' : 'Model Settings'}</h3>

      {!isCollapsed && (
        <>
          <div className="settings-group">
            <label>Model</label>
            <select
              name="model"
              value={settings.model}
              onChange={handleChange}
            >
              <option value="gpt-4o">GPT-4o</option>
            </select>
          </div>
        </>
      )}
    </div>
  );
};

export default ModelSettings;
