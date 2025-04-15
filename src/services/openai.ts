import { AzureOpenAI, OpenAI } from "openai";
import { Message, ModelSettings } from "../types";

// Initialize the appropriate client based on provider
const createClient = (settings: ModelSettings) => {
  if (settings.provider === "azure") {
    return new AzureOpenAI({
      apiKey: settings.apiKey,
      baseURL: settings.baseUrl + "/openai",
      // In MTK, Model name equals to deployment name
      deployment: settings.model,
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

export const sendChatCompletion = async (
  messages: Message[],
  settings: ModelSettings
): Promise<string> => {
  try {
    const client = createClient(settings);

    const formattedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    console.log("Sending request to:", settings.baseUrl);

    const response = await client.chat.completions.create({
      model: settings.model,
      messages: formattedMessages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
    });

    // const assistant = await client.beta.assistants.create({
    //   name: "assistant",
    //   model: settings.model,
    //   description: "A helpful assistant",
    //   instructions: "You are a helpful assistant.",
    //   temperature: settings.temperature,
    //   metadata: {
    //     "backend_id": "default"
    //   }
    // })

    // const thread = await client.beta.threads.create()
    // const message = await client.beta.threads.messages.create(
    //   thread.id,
    //   {
    //     role: "user",
    //     content: formattedMessages[0].content,
    //   }
    // );
    // const run = await client.beta.threads.runs.createAndPoll(
    //   thread.id,
    //   {
    //     assistant_id: assistant.id,
    //     instructions: "Please Help the user to answer the question",
    //   }
    // );

    return response.choices[0].message.content || "";
  } catch (error) {
    console.error("Error calling AI API:", error);
    throw error;
  }
};

export const streamChatCompletion = async (
  messages: Message[],
  settings: ModelSettings,
  onToken: (token: string) => void
): Promise<void> => {
  try {
    const client = createClient(settings);

    const formattedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    console.log("Sending streaming request to:", settings.baseUrl);

    const stream = await client.chat.completions.create({
      model: settings.model,
      messages: formattedMessages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        onToken(content);
      }
    }
  } catch (error) {
    console.error("Error streaming from AI API:", error);
    throw error;
  }
};
