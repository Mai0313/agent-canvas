import React, { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import ChatBox from "./components/ChatBox";
import ModelSettings from "./components/ModelSettings";
import MarkdownCanvas from "./components/MarkdownCanvas";
import { Message, ModelSettings as ModelSettingsType } from "./types";
import { streamChatCompletion } from "./services/openai";
import { extractLongestCodeBlock } from "./utils/markdownUtils";
import "./styles.css";

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [settings, setSettings] = useState<ModelSettingsType>({
    api_type: "openai",
    model: "gpt-4o",
    baseUrl: process.env.BASE_URL || "https://tma.mediatek.inc/tma/sdk/api",
    apiKey: process.env.API_KEY || "srv_dvc_tma001",
    temperature: parseFloat(process.env.TEMPERATURE || "0.7"),
    maxTokens: parseInt(process.env.MAX_TOKENS || "2048", 10),
    azureDeployment: process.env.AZURE_DEPLOYMENT || "",
    azureApiVersion: process.env.AZURE_API_VERSION || "2025-03-01-preview",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(true);

  // Markdown canvas state
  const [markdownContent, setMarkdownContent] = useState<string>("");
  const [isMarkdownCanvasOpen, setIsMarkdownCanvasOpen] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(
    null,
  );

  // Add state to track the position of the longest code block
  const [longestCodeBlockPosition, setLongestCodeBlockPosition] = useState<{
    start: number;
    end: number;
  } | null>(null);

  const handleSendMessage = async (content: string) => {
    const userMessage: Message = {
      id: uuidv4(),
      role: "user",
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const assistantMessageId = uuidv4();
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingMessageId(assistantMessageId);

      await streamChatCompletion(
        [...messages, userMessage],
        settings,
        (token) => {
          setMessages((prev) => {
            const updatedMessages = [...prev];
            const messageIndex = updatedMessages.findIndex(
              (m) => m.id === assistantMessageId,
            );
            if (messageIndex !== -1) {
              updatedMessages[messageIndex] = {
                ...updatedMessages[messageIndex],
                content: updatedMessages[messageIndex].content + token,
              };
            }
            return updatedMessages;
          });
        },
      );
    } catch (err: any) {
      setError(
        err.message ||
          "Failed to get response from the AI. Please check your settings and try again.",
      );
      console.error("Chat completion error:", err);
    } finally {
      setIsLoading(false);
      setStreamingMessageId(null);
    }
  };

  const toggleMarkdownCanvas = (messageId: string, content: string) => {
    // If already open for this message, close it
    if (isMarkdownCanvasOpen && editingMessageId === messageId) {
      setIsMarkdownCanvasOpen(false);
      setEditingMessageId(null);
      setLongestCodeBlockPosition(null);
    } else {
      // If closed or open for a different message, open for this one
      const { longestBlock, blockPosition } = extractLongestCodeBlock(content);

      if (longestBlock && blockPosition) {
        setMarkdownContent(longestBlock);
        setEditingMessageId(messageId);
        setLongestCodeBlockPosition(blockPosition);
        setIsMarkdownCanvasOpen(true);
      }
    }
  };

  const handleMarkdownDetected = (content: string, messageId: string) => {
    const { longestBlock, blockPosition } = extractLongestCodeBlock(content);

    if (longestBlock && blockPosition) {
      setMarkdownContent(longestBlock);
      setEditingMessageId(messageId);
      setLongestCodeBlockPosition(blockPosition);
      setIsMarkdownCanvasOpen(true);
    }
  };

  const handleSaveMarkdown = (editedContent: string) => {
    setMessages((prev) => {
      const updatedMessages = [...prev];
      const messageIndex = updatedMessages.findIndex(
        (m) => m.id === editingMessageId,
      );

      if (messageIndex !== -1 && longestCodeBlockPosition) {
        const originalContent = updatedMessages[messageIndex].content;
        const newContent =
          originalContent.substring(0, longestCodeBlockPosition.start) +
          editedContent +
          originalContent.substring(longestCodeBlockPosition.end);

        updatedMessages[messageIndex] = {
          ...updatedMessages[messageIndex],
          content: newContent,
        };
      }

      return updatedMessages;
    });

    setMarkdownContent(editedContent);
  };

  const handleCloseMarkdownCanvas = () => {
    setIsMarkdownCanvasOpen(false);
    setEditingMessageId(null);
    setLongestCodeBlockPosition(null);
  };

  return (
    <div className='app'>
      <div
        className={`sidebar ${isSidebarCollapsed ? "collapsed" : ""}`}
        onMouseEnter={() => setIsSidebarCollapsed(false)}
        onMouseLeave={() => setIsSidebarCollapsed(true)}
      >
        <div
          className='sidebar-toggle'
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        >
          {isSidebarCollapsed ? "⚙" : "◀"}
        </div>
        <ModelSettings
          settings={settings}
          onSettingsChange={setSettings}
          isCollapsed={isSidebarCollapsed}
        />
      </div>

      <div className='main-content'>
        <ChatBox
          messages={messages}
          onSendMessage={handleSendMessage}
          onMarkdownDetected={handleMarkdownDetected}
          isLoading={isLoading}
          streamingMessageId={streamingMessageId}
          editingMessageId={editingMessageId}
          longestCodeBlockPosition={longestCodeBlockPosition}
          toggleMarkdownCanvas={toggleMarkdownCanvas}
        />

        {isLoading && (
          <div className='loading-indicator'>
            <p>AI is thinking...</p>
          </div>
        )}

        {error && (
          <div className='error-message'>
            <p>{error}</p>
            <button
              onClick={() => setError(null)}
              style={{
                background: "transparent",
                border: "none",
                color: "white",
                marginLeft: "10px",
                cursor: "pointer",
              }}
            ></button>
          </div>
        )}
      </div>

      <MarkdownCanvas
        content={markdownContent}
        isOpen={isMarkdownCanvasOpen}
        onClose={handleCloseMarkdownCanvas}
        onSave={handleSaveMarkdown}
      />
    </div>
  );
};

export default App;
