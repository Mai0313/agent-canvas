import { AzureOpenAI, OpenAI } from "openai";
import { Message, ModelSetting } from "../types";

// Initialize the appropriate client based on api_type
const createClient = (settings: ModelSetting) => {
  if (settings.api_type === "azure") {
    return new AzureOpenAI({
      apiKey: settings.apiKey,
      baseURL: settings.baseUrl + "/openai",
      // In MTK, Model name equals to deployment name
      deployment: settings.azureDeployment || settings.model,
      apiVersion: settings.azureApiVersion,
      dangerouslyAllowBrowser: true,
    });
  } else {
    return new OpenAI({
      apiKey: settings.apiKey,
      baseURL: settings.baseUrl,
      dangerouslyAllowBrowser: true,
    });
  }
};

// Enhanced function to fetch available models with loading state callbacks
export const fetchModels = async (
  settings: ModelSetting,
  callbacks?: {
    onStart?: () => void;
    onSuccess?: (data: Array<{ id: string }>) => void;
    onError?: (error: any) => void;
    onComplete?: () => void;
  },
) => {
  if (!settings.apiKey || !settings.baseUrl) {
    throw new Error("API key and base URL are required to fetch models");
  }

  try {
    // Call the start callback if provided
    if (callbacks?.onStart) callbacks.onStart();

    const client = createClient(settings);
    const modelsList = await client.models.list();

    // Call the success callback if provided
    if (callbacks?.onSuccess) callbacks.onSuccess(modelsList.data);

    return modelsList.data;
  } catch (error) {
    console.error("Failed to fetch models:", error);

    // Call the error callback if provided
    if (callbacks?.onError) callbacks.onError(error);

    throw error;
  } finally {
    // Call the complete callback if provided
    if (callbacks?.onComplete) callbacks.onComplete();
  }
};

export const ChatCompletion = async (
  messages: Message[],
  settings: ModelSetting,
  onToken?: (token: string) => void,
): Promise<string> => {
  try {
    const client = createClient(settings);

    const formattedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    console.log("Sending streaming request to:", settings.baseUrl);

    // 基本請求配置
    const requestOptions = {
      model: settings.model,
      messages: formattedMessages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
    };

    // 檢查是否需要串流模式
    if (onToken) {
      console.log("Sending streaming request to:", settings.baseUrl);
      const responses = await client.chat.completions.create({
        ...requestOptions,
        stream: true,
      });

      let fullResponse = "";
      for await (const chunk of responses) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          onToken(content);
          fullResponse += content;
        }
      }
      return fullResponse;
    } else {
      console.log("Sending request to:", settings.baseUrl);
      const responses = await client.chat.completions.create(requestOptions);
      return responses.choices[0].message.content || "";
    }
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
};

// 為了向後兼容，保留原有的 streamChatCompletion 函數，但內部直接調用 ChatCompletion
export const streamChatCompletion = async (
  messages: Message[],
  settings: ModelSetting,
  onToken: (token: string) => void,
): Promise<void> => {
  try {
    await ChatCompletion(messages, settings, onToken);
  } catch (error) {
    console.error("Error streaming from AI API:", error);
    throw error;
  }
};
