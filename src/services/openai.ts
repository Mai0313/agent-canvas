import { AzureOpenAI, OpenAI } from "openai";
import { Message, ModelSetting, MessageContent } from "../types";
import { Stream } from "openai/streaming";

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

export const chatCompletion = async (
  messages: Message[],
  settings: ModelSetting,
  onToken?: (token: string) => void,
): Promise<string> => {
  try {
    const client = createClient(settings);

    // Format messages according to OpenAI API requirements
    const formattedMessages = messages.map((m) => {
      // For string contents, return simple object
      if (typeof m.content === "string") {
        return {
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        };
      } else {
        // For array content with text and images, format according to OpenAI API
        return {
          role: m.role as "user" | "assistant" | "system",
          content: m.content.map((item) => {
            if (item.type === "text") {
              return { type: "text", text: item.text };
            } else if (item.type === "image_url" && item.image_url) {
              return { type: "image_url", image_url: item.image_url };
            }
            return item;
          }),
        };
      }
    });

    console.log("Sending request to:", settings.baseUrl);

    // 基本請求配置
    const requestOptions = {
      model: settings.model,
      messages: formattedMessages as any, // Type assertion to bypass strict checking
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
    };

    // 檢查是否需要串流模式
    if (onToken) {
      console.log("Sending streaming request to:", settings.baseUrl);

      // Properly type the streaming response
      type ChatCompletionChunk = {
        id: string;
        object: string;
        created: number;
        model: string;
        choices: Array<{
          index: number;
          delta: {
            content?: string;
            role?: string;
          };
          finish_reason: string | null;
        }>;
      };

      // Create streaming request with proper typing
      const streamingOptions = {
        ...requestOptions,
        stream: true,
      };

      // Explicitly type the response as a Stream of ChatCompletionChunk
      const stream = (await client.chat.completions.create(
        streamingOptions,
      )) as unknown as Stream<ChatCompletionChunk>;

      let fullResponse = "";
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          onToken(content);
          fullResponse += content;
        }
      }
      return fullResponse;
    } else {
      console.log("Sending request to:", settings.baseUrl);
      const responses = await client.chat.completions.create(requestOptions as any);
      return responses.choices[0].message.content || "";
    }
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
};

/**
 * Generate an image based on the prompt and then use the image in chat completion to get a description
 * @param prompt The prompt for image generation
 * @param settings Model settings
 * @param onToken Optional callback for streaming text response tokens
 * @returns Object containing the image URL and text response
 */
export const generateImageAndText = async (
  prompt: string,
  settings: ModelSetting,
  onToken?: (token: string) => void,
): Promise<{ imageUrl: string; textResponse: string }> => {
  try {
    const client = createClient(settings);
    console.log("Generating image for prompt:", prompt);
    
    // Step 1: Generate the image first using URL format instead of base64
    const imageResponse = await client.images.generate({
      prompt,
      n: 1,
      model: "dall-e-3", // Using DALL-E 3 model
      response_format: "url", // Request URL rather than base64
      size: "1024x1024", // Add size parameter for better quality
    });
    
    // Extract the URL from the response
    const imageUrl = imageResponse.data[0]?.url;
    if (!imageUrl) {
      throw new Error("No image URL received from the API");
    }
    
    console.log("Image generated successfully, now getting description");
    
    // Step 2: Use the image in chat completion to generate a description
    const systemMessage = {
      role: "system",
      content: "The image has been generated by you. Please describe the image in detail what it generates.",
    };
    
    // Create message content with both text and image URL reference
    const messageContent: MessageContent[] = [
      {
        type: "text",
        text: `Please describe this image that was generated based on the prompt: "${prompt}" in users language.`,
      },
      {
        type: "image_url",
        image_url: {
          url: imageUrl
        }
      }
    ];
    
    // Send the message with the image to chat completion
    const textResponse = await chatCompletion(
      [
        {
          id: "system",
          role: "system",
          content: systemMessage.content,
          timestamp: new Date(),
        },
        { 
          id: "user", 
          role: "user", 
          content: messageContent,
          timestamp: new Date() 
        },
      ],
      settings,
      onToken,
    );
    
    return {
      imageUrl,
      textResponse: textResponse || "Image generated successfully.",
    };
  } catch (error) {
    console.error("Error generating image and text:", error);
    throw error;
  }
};
