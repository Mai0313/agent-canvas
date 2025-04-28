import React, { useState, useEffect, useCallback, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import ChatBox from "./components/ChatBox";
import ModelSettings from "./components/ModelSettings";
import MarkdownCanvas from "./components/MarkdownCanvas";
import { Message, ModelSetting } from "./types";
import { ChatCompletion, generateImageAndText } from "./services/openai";
import {
  extractLongestCodeBlock,
  detectInProgressCodeBlock,
} from "./utils/markdownUtils";
import { getDefaultModelSettings } from "./utils/modelUtils";
import "./styles.css";

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [settings, setSettings] = useState<ModelSetting>(
    getDefaultModelSettings(),
  );
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
  const [codeBlockPosition, setCodeBlockPosition] = useState<{
    start: number;
    end: number;
  } | null>(null);

  // Track active code block detection
  const [codeBlockDetected, setCodeBlockDetected] = useState(false);

  // Resizable layout states
  const [sidebarWidth, setSidebarWidth] = useState(250); // Default sidebar width
  const [markdownWidth, setMarkdownWidth] = useState(40); // Default 40% width for markdown
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingMarkdown, setIsResizingMarkdown] = useState(false);

  // Refs for resizable elements
  const appContainerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const markdownContainerRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const sidebarResizerRef = useRef<HTMLDivElement>(null);
  const markdownResizerRef = useRef<HTMLDivElement>(null);

  // Handle text selection from both chat and markdown canvas
  const handleAskGpt = (selectedText: string) => {
    // 創建一個自定義事件來傳遞選中的文字
    const event = new CustomEvent('setQuotedText', { 
      detail: { quotedText: selectedText } 
    });
    document.dispatchEvent(event);
    
    // Focus the chat input field
    const chatInputElement = document.querySelector(
      ".chat-input-form textarea",
    ) as HTMLTextAreaElement;
    if (chatInputElement) {
      chatInputElement.focus();
    }
    
    // Close markdown canvas if it's open
    if (isMarkdownCanvasOpen) {
      handleCloseMarkdownCanvas();
    }
  };

  // Monitor the currently streaming message for code blocks
  useEffect(() => {
    if (!streamingMessageId) return;

    const message = messages.find((m) => m.id === streamingMessageId);
    if (!message) return;

    // Check for in-progress code blocks with 5+ lines
    const { codeBlock, blockPosition, lineCount } = detectInProgressCodeBlock(
      message.content,
      5,
    );

    // If a code block with 5+ lines is found and we haven't already detected one or have a different one
    if (codeBlock && blockPosition && lineCount >= 5 && !codeBlockDetected) {
      // Open the markdown editor with this code block
      setMarkdownContent(codeBlock);
      setEditingMessageId(streamingMessageId);
      setCodeBlockPosition(blockPosition);
      setIsMarkdownCanvasOpen(true);
      setCodeBlockDetected(true);
    }

    // If we have an active code block that's being updated
    if (
      codeBlockDetected &&
      editingMessageId === streamingMessageId &&
      codeBlockPosition
    ) {
      // Get the updated in-progress code block
      const updatedBlock = message.content.substring(codeBlockPosition.start);
      setMarkdownContent(updatedBlock);
      setCodeBlockPosition({
        start: codeBlockPosition.start,
        end: message.content.length,
      });
    }
  }, [
    messages,
    streamingMessageId,
    codeBlockDetected,
    editingMessageId,
    codeBlockPosition,
  ]);

  // Reset code block detection when streaming ends
  useEffect(() => {
    if (!streamingMessageId) {
      setCodeBlockDetected(false);
    }
  }, [streamingMessageId]);

  // Setup sidebar resizer
  useEffect(() => {
    const sidebarResizer = sidebarResizerRef.current;
    if (!sidebarResizer) return;

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      setIsResizingSidebar(true);
      document.documentElement.style.cursor = "col-resize";
    };

    sidebarResizer.addEventListener("mousedown", onMouseDown);

    return () => {
      sidebarResizer.removeEventListener("mousedown", onMouseDown);
    };
  }, []);

  // Setup markdown resizer
  useEffect(() => {
    const markdownResizer = markdownResizerRef.current;
    if (!markdownResizer || !isMarkdownCanvasOpen) return;

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      setIsResizingMarkdown(true);
      document.documentElement.style.cursor = "col-resize";
    };

    markdownResizer.addEventListener("mousedown", onMouseDown);

    return () => {
      markdownResizer.removeEventListener("mousedown", onMouseDown);
    };
  }, [isMarkdownCanvasOpen]);

  // Handle resizing
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isResizingSidebar) {
        const newWidth = e.clientX;
        if (newWidth >= 200 && newWidth <= 350) {
          setSidebarWidth(newWidth);
        }
      } else if (isResizingMarkdown && isMarkdownCanvasOpen) {
        const containerWidth = mainContainerRef.current?.clientWidth || 0;
        const markdownContainer = markdownContainerRef.current;
        const chatContainer = chatContainerRef.current;

        if (
          containerWidth &&
          markdownContainer &&
          chatContainer &&
          mainContainerRef.current
        ) {
          // Calculate the new width based on mouse position
          const mainRect = mainContainerRef.current.getBoundingClientRect();
          const fromRight = mainRect.right - e.clientX;
          const newWidthPercent = (fromRight / containerWidth) * 100;

          // Apply constraints (20% to 70%)
          const limitedWidth = Math.max(20, Math.min(70, newWidthPercent));
          setMarkdownWidth(limitedWidth);
        }
      }
    };

    const onMouseUp = () => {
      setIsResizingSidebar(false);
      setIsResizingMarkdown(false);
      document.documentElement.style.cursor = "";
    };

    if (isResizingSidebar || isResizingMarkdown) {
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [isResizingSidebar, isResizingMarkdown, isMarkdownCanvasOpen]);

  // Memoize generateNewThreadId to avoid dependency issues
  const generateNewThreadId = useCallback(() => {
    // Generate UUID and remove all hyphens, then take substring
    const newThreadId =
      "thread_dvc_" + uuidv4().replace(/-/g, "").substring(0, 16);
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
  }, [isMarkdownCanvasOpen]);

  useEffect(() => {
    // Check if URL already has a thread ID
    const url = new URL(window.location.href);
    const existingThreadId = url.searchParams.get("thread_id");

    if (existingThreadId) {
      // Use the existing thread ID from URL
      setThreadId(existingThreadId);
    } else {
      // Only generate new ID if we don't have one
      generateNewThreadId();
    }
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

  // New function for handling image generation requests
  const handleGenerateImage = async (prompt: string) => {
    // If this is the first message of a conversation, ensure we have a thread ID
    if (messages.length === 0 && !threadId) {
      generateNewThreadId();
    }

    const userMessage: Message = {
      id: uuidv4(),
      role: "user",
      content: `${prompt}`,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const assistantMessageId = uuidv4();
      // 創建一個包含 loading 狀態的初始消息
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: "assistant",
        content: "Creating your Image...",
        timestamp: new Date(),
        isGeneratingImage: true, // 標記正在生成圖片
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingMessageId(assistantMessageId);

      // Call the generateImageAndText function
      const { imageUrl, textResponse } = await generateImageAndText(
        prompt,
        settings,
        undefined, // 使用 undefined 而不是 null，因為這是可選參數
      );

      // 生成完成後，更新消息，同時顯示文字和圖片
      setMessages((prev) => {
        const updatedMessages = [...prev];
        const messageIndex = updatedMessages.findIndex(
          (m) => m.id === assistantMessageId,
        );
        if (messageIndex !== -1) {
          updatedMessages[messageIndex] = {
            ...updatedMessages[messageIndex],
            content: textResponse,
            imageUrl: imageUrl,
            isGeneratingImage: false, // 移除生成中狀態
          };
        }
        return updatedMessages;
      });
    } catch (err: any) {
      setError(
        err.message ||
          "Failed to generate image. Please check your settings and try again.",
      );
      console.error("Image generation error:", err);
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
      setCodeBlockPosition(null);
    } else {
      // First try to find any in-progress code block
      const { codeBlock: inProgressBlock, blockPosition: inProgressPosition } =
        detectInProgressCodeBlock(content, 0);

      if (inProgressBlock && inProgressPosition) {
        openMarkdownCanvas(messageId, inProgressBlock, inProgressPosition);
      } else {
        // Fall back to completed code block
        const { longestBlock, blockPosition } =
          extractLongestCodeBlock(content);
        if (longestBlock && blockPosition) {
          openMarkdownCanvas(messageId, longestBlock, blockPosition);
        }
      }
    }
  };

  // Helper function to open the markdown canvas
  const openMarkdownCanvas = (
    messageId: string,
    content: string,
    position: { start: number; end: number },
  ) => {
    // Close any existing canvas first to reset states
    if (isMarkdownCanvasOpen) {
      setIsMarkdownCanvasOpen(false);
      setEditingMessageId(null);
    }

    // Short delay to ensure smooth transition between different messages' code blocks
    setTimeout(() => {
      setMarkdownContent(content);
      setEditingMessageId(messageId);
      setCodeBlockPosition(position);
      setIsMarkdownCanvasOpen(true);
    }, 50);
  };

  // Check if a message contains a code block and show the BlockNote editor
  const handleMarkdownDetected = (content: string, messageId: string) => {
    if (content.includes("```")) {
      // First check for in-progress code blocks
      const { codeBlock, blockPosition } = detectInProgressCodeBlock(
        content,
        5,
      );

      if (codeBlock && blockPosition) {
        // Use the in-progress code block
        setMarkdownContent(codeBlock);
        setEditingMessageId(messageId);
        setCodeBlockPosition(blockPosition);
        setIsMarkdownCanvasOpen(true);
      } else {
        // Fall back to completed code blocks
        const { longestBlock, blockPosition: completedPosition } =
          extractLongestCodeBlock(content);
        if (longestBlock && completedPosition) {
          setMarkdownContent(longestBlock);
          setEditingMessageId(messageId);
          setCodeBlockPosition(completedPosition);
          setIsMarkdownCanvasOpen(true);
        }
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

      if (messageIndex !== -1 && codeBlockPosition) {
        const originalContent = updatedMessages[messageIndex].content;
        const newContent =
          originalContent.substring(0, codeBlockPosition.start) +
          editedContent +
          originalContent.substring(codeBlockPosition.end);

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
    setCodeBlockPosition(null);
  };

  return (
    <div className='app' ref={appContainerRef}>
      {/* Sidebar with resizer */}
      <div
        className='sidebar'
        ref={sidebarRef}
        style={{ width: `${sidebarWidth}px` }}
      >
        <div className='thread-controls'>
          <button className='new-thread-btn' onClick={startNewThread}>
            New Conversation
          </button>
          <div className='thread-id'>Thread ID: {threadId}</div>
        </div>
        <ModelSettings settings={settings} onSettingsChange={setSettings} />
        <div className='sidebar-resizer' ref={sidebarResizerRef} />
      </div>

      {/* Main container with chat and markdown */}
      <div ref={mainContainerRef} className='main-container'>
        {/* Chat container */}
        <div
          ref={chatContainerRef}
          className='chat-container'
          style={{
            width: isMarkdownCanvasOpen ? `${100 - markdownWidth}%` : "100%",
          }}
        >
          <ChatBox
            messages={messages}
            settings={settings}
            onSendMessage={handleSendMessage}
            onGenerateImage={handleGenerateImage}
            onMarkdownDetected={handleMarkdownDetected}
            isLoading={isLoading}
            streamingMessageId={streamingMessageId}
            editingMessageId={editingMessageId}
            longestCodeBlockPosition={codeBlockPosition}
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

        {/* Markdown editor with resizer */}
        {isMarkdownCanvasOpen && (
          <>
            <div ref={markdownResizerRef} className='resizer' />
            <div
              ref={markdownContainerRef}
              className='markdown-container'
              style={{ width: `${markdownWidth}%` }}
            >
              <MarkdownCanvas
                content={markdownContent}
                isOpen={isMarkdownCanvasOpen}
                onClose={handleCloseMarkdownCanvas}
                onSave={handleSaveMarkdown}
                onAskGpt={handleAskGpt}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default App;
