export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

export type APIType = "openai" | "azure";

export interface ModelSettings {
  api_type: APIType;
  model: string;
  baseUrl: string;
  apiKey: string;
  temperature: number;
  maxTokens: number;
  // Azure OpenAI specific settings
  azureDeployment?: string;
  azureApiVersion?: string;
}
