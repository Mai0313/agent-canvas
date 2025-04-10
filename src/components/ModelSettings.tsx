import React from 'react';
import { ModelSettings as ModelSettingsType, APIProvider } from '../types';

interface ModelSettingsProps {
  settings: ModelSettingsType;
  onSettingsChange: (settings: ModelSettingsType) => void;
}

const ModelSettings: React.FC<ModelSettingsProps> = ({ settings, onSettingsChange }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Convert temperature and maxTokens to numbers
    let parsedValue: string | number | APIProvider = value;
    if (name === 'temperature') {
      parsedValue = parseFloat(value);
    } else if (name === 'maxTokens') {
      parsedValue = parseInt(value, 10);
    } else if (name === 'provider') {
      parsedValue = value as APIProvider;
    }
    
    onSettingsChange({
      ...settings,
      [name]: parsedValue
    });
  };

  const isAzure = settings.provider === 'azure';

  return (
    <div className="model-settings">
      <h3>Model Settings</h3>
      
      <div className="settings-group">
        <label>API Provider</label>
        <select 
          name="provider" 
          value={settings.provider} 
          onChange={handleChange}
        >
          <option value="openai">OpenAI</option>
          <option value="azure">Azure OpenAI</option>
        </select>
      </div>
      
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
      
      <div className="settings-group">
        <label>Base URL</label>
        <input 
          type="text" 
          name="baseUrl" 
          value={settings.baseUrl} 
          onChange={handleChange} 
          placeholder={isAzure ? "https://your-resource.openai.azure.com" : "https://api.openai.com/v1"}
        />
      </div>
      
      <div className="settings-group">
        <label>API Key</label>
        <input 
          type="password" 
          name="apiKey" 
          value={settings.apiKey} 
          onChange={handleChange} 
          placeholder="Enter your API key"
        />
      </div>
      
      {isAzure && (
        <>
          <div className="settings-group">
            <label>Azure Deployment Name</label>
            <input 
              type="text" 
              name="azureDeployment" 
              value={settings.azureDeployment || ''} 
              onChange={handleChange} 
              placeholder="Enter your deployment name"
            />
          </div>
          
          <div className="settings-group">
            <label>Azure API Version</label>
            <input 
              type="text" 
              name="azureApiVersion" 
              value={settings.azureApiVersion || ''} 
              onChange={handleChange} 
              placeholder="2024-04-01"
            />
          </div>
        </>
      )}
      
      <div className="settings-group">
        <label>Temperature: {settings.temperature}</label>
        <input 
          type="range" 
          name="temperature" 
          min="0" 
          max="2" 
          step="0.1" 
          value={settings.temperature} 
          onChange={handleChange}
        />
      </div>
      
      <div className="settings-group">
        <label>Max Tokens</label>
        <input 
          type="number" 
          name="maxTokens" 
          min="1" 
          max="32000" 
          value={settings.maxTokens} 
          onChange={handleChange}
        />
      </div>
    </div>
  );
};

export default ModelSettings;
