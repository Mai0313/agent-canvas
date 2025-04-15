export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

export type APIProvider = "openai" | "azure";

export interface ModelSettings {
  provider: APIProvider;
  model: string;
  baseUrl: string;
  apiKey: string;
  temperature: number;
  maxTokens: number;
  // Azure OpenAI specific settings
  azureDeployment?: string;
  azureApiVersion?: string;
}
