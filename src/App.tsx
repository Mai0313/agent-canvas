import React, { useState, useEffect, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import ChatBox from "./components/ChatBox";
import ModelSettings from "./components/ModelSettings";
import MarkdownCanvas from "./components/MarkdownCanvas";
import { Message, ModelSetting, APIType } from "./types";
import { ChatCompletion } from "./services/openai";
import { extractLongestCodeBlock } from "./utils/markdownUtils";
import "./styles.css";

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [settings, setSettings] = useState<ModelSetting>({
    api_type: (process.env.REACT_APP_API_TYPE as APIType) || "openai",
    model: "gpt-4o",
    baseUrl: process.env.REACT_APP_BASE_URL || "",
    apiKey: process.env.REACT_APP_API_KEY || "",
    temperature: parseFloat(process.env.REACT_APP_TEMPERATURE || "0.7"),
    maxTokens: parseInt(process.env.REACT_APP_MAX_TOKENS || "2048", 10),
    azureDeployment: process.env.REACT_APP_AZURE_DEPLOYMENT || "",
    azureApiVersion: process.env.REACT_APP_AZURE_API_VERSION || "2025-03-01-preview",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string>(uuidv4());

  // Markdown canvas state for BlockNote editor
  const [markdownContent, setMarkdownContent] = useState<string>("");
  const [isMarkdownCanvasOpen, setIsMarkdownCanvasOpen] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(
    null,
  );

  // State to track code block position
  const [longestCodeBlockPosition, setLongestCodeBlockPosition] = useState<{
    start: number;
    end: number;
  } | null>(null);

  // Memoize generateNewThreadId to avoid dependency issues
  const generateNewThreadId = useCallback(() => {
    // Generate UUID and remove all hyphens, then take substring
    const newThreadId = "thread_dvc_" + uuidv4().replace(/-/g, '').substring(0, 16);
    setThreadId(newThreadId);

    // Update URL with the new thread ID without page reload
    const url = new URL(window.location.href);
    url.searchParams.set("thread_id", newThreadId);
    window.history.pushState({ threadId: newThreadId }, "", url.toString());

    // Optionally clear messages to start a fresh conversation
    setMessages([]);

    // Close any open markdown canvas
    if (isMarkdownCanvasOpen) {
      handleCloseMarkdownCanvas();
    }
  }, [isMarkdownCanvasOpen]); // Add dependencies here

  // Generate a new thread ID and update URL on component mount
  useEffect(() => {
    generateNewThreadId();
  }, [generateNewThreadId]);

  // Add button/functionality to start a new thread
  const startNewThread = () => {
    generateNewThreadId();
  };

  const handleSendMessage = async (content: string) => {
    // If this is the first message of a conversation, ensure we have a thread ID
    if (messages.length === 0 && !threadId) {
      generateNewThreadId();
    }

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

      await ChatCompletion([...messages, userMessage], settings, (token) => {
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
      });
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
      // Extract the code block from the message
      const { longestBlock, blockPosition } = extractLongestCodeBlock(content);

      if (longestBlock && blockPosition) {
        // Close any existing canvas first to reset states
        if (isMarkdownCanvasOpen) {
          setIsMarkdownCanvasOpen(false);
          setEditingMessageId(null);
        }

        // Short delay to ensure smooth transition between different messages' code blocks
        setTimeout(() => {
          setMarkdownContent(longestBlock);
          setEditingMessageId(messageId);
          setLongestCodeBlockPosition(blockPosition);
          setIsMarkdownCanvasOpen(true);
        }, 50);
      }
    }
  };

  // Check if a message contains a code block and show the BlockNote editor
  const handleMarkdownDetected = (content: string, messageId: string) => {
    if (content.includes("```")) {
      const { longestBlock, blockPosition } = extractLongestCodeBlock(content);

      if (longestBlock && blockPosition) {
        setMarkdownContent(longestBlock);
        setEditingMessageId(messageId);
        setLongestCodeBlockPosition(blockPosition);
        setIsMarkdownCanvasOpen(true);
      }
    }
  };

  // Update the message with edited code block content
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

  // Close the BlockNote editor
  const handleCloseMarkdownCanvas = () => {
    setIsMarkdownCanvasOpen(false);
    setEditingMessageId(null);
    setLongestCodeBlockPosition(null);
  };

  return (
    <div className='app'>
      <div className='sidebar'>
        <div className='thread-controls'>
          <button className='new-thread-btn' onClick={startNewThread}>
            New Conversation
          </button>
          <div className='thread-id'>Thread ID: {threadId}</div>
        </div>
        <ModelSettings settings={settings} onSettingsChange={setSettings} />
      </div>

      <div className='main-content'>
        <ChatBox
          messages={messages}
          settings={settings}
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
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Use the updated BlockNote-based MarkdownCanvas component */}
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
