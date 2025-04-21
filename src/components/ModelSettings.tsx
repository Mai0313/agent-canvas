import React, { useState, useEffect } from "react";
import { ModelSettings as ModelSettingsType } from "../types";
import { OpenAI } from "openai";

interface ModelSettingsProps {
  settings: ModelSettingsType;
  onSettingsChange: (settings: ModelSettingsType) => void;
  isCollapsed: boolean;
}

const ModelSettings: React.FC<ModelSettingsProps> = ({
  settings,
  onSettingsChange,
  isCollapsed,
}) => {
  const [models, setModels] = useState<Array<{ id: string }>>([]);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    onSettingsChange({
      ...settings,
      [name]: value,
    });
  };

  const fetchModels = async () => {
    if (!settings.apiKey || !settings.baseUrl) return;

    setIsLoadingModels(true);
    try {
      const client = new OpenAI({
        apiKey: settings.apiKey,
        baseURL: settings.baseUrl,
        dangerouslyAllowBrowser: true,
      });

      const modelsList = await client.models.list();
      setModels(modelsList.data);
      console.log("Fetched models:", modelsList.data);
    } catch (error) {
      console.error("Failed to fetch models:", error);
    } finally {
      setIsLoadingModels(false);
    }
  };

  useEffect(() => {
    if (settings.apiKey && settings.baseUrl) {
      fetchModels();
    }
  }, [settings.apiKey, settings.baseUrl]);

  return (
    <div className='model-settings'>
      <h3>{isCollapsed ? "⚙" : "Model Settings"}</h3>

      {!isCollapsed && (
        <>
          <div className='settings-group'>
            <label>Model</label>
            <select name='model' value={settings.model} onChange={handleChange}>
              {isLoadingModels ? (
                <option value=''>Loading models...</option>
              ) : models.length > 0 ? (
                models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.id}
                  </option>
                ))
              ) : (
                <option value='gpt-4o'>GPT-4o</option>
              )}
            </select>
          </div>
        </>
      )}
    </div>
  );
};

export default ModelSettings;
