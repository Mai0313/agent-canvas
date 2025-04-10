import { AzureOpenAI, OpenAI } from 'openai';
import { Message, ModelSettings } from '../types';

// Initialize the appropriate client based on provider
const createClient = (settings: ModelSettings) => {
  if (settings.provider === 'azure') {
    return new AzureOpenAI({
      apiKey: settings.apiKey,
      baseURL: settings.baseUrl,
      deployment: settings.azureDeployment,
      apiVersion: settings.azureApiVersion,
      dangerouslyAllowBrowser: true,
      defaultHeaders: {
        "X-User-Id": settings.userId,
      },
    });
  } else {
    return new OpenAI({
      apiKey: settings.apiKey,
      baseURL: settings.baseUrl,
      dangerouslyAllowBrowser: true,
    });
  }
};

export const sendChatCompletion = async (
  messages: Message[], 
  settings: ModelSettings
): Promise<string> => {
  try {
    const client = createClient(settings);
    
    const formattedMessages = messages.map(m => ({ 
      role: m.role, 
      content: m.content 
    }));

    const response = await client.chat.completions.create({
      model: settings.model,
      messages: formattedMessages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
    });
    
    return response.choices[0].message.content || '';
  } catch (error) {
    console.error('Error calling AI API:', error);
    throw error;
  }
};
