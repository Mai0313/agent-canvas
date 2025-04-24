export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  imageUrl?: string; // Add support for images
  isGeneratingImage?: boolean; // 添加標記，表示正在生成圖片
}

export type APIType = "openai" | "azure";

export interface ModelSetting {
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
