import React, { useState, useEffect, useCallback, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import ChatBox from "./components/ChatBox";
import ModelSettings from "./components/ModelSettings";
import MarkdownCanvas from "./components/MarkdownCanvas";
import { Message, ModelSetting, MessageContent } from "./types";
import {
  chatCompletion,
  generateImageAndText,
  fetchModels,
  detectTaskType,
} from "./services/openai";
import { extractLongestCodeBlock, detectInProgressCodeBlock } from "./utils/markdownUtils";
import { getDefaultModelSettings } from "./utils/modelUtils";
import "./styles.css";

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [settings, setSettings] = useState<ModelSetting>(getDefaultModelSettings());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string>(uuidv4());

  // Markdown canvas state for BlockNote editor
  const [markdownContent, setMarkdownContent] = useState<string>("");
  const [isMarkdownCanvasOpen, setIsMarkdownCanvasOpen] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

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
    const event = new CustomEvent("setQuotedText", {
      detail: { quotedText: selectedText },
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

  // 處理消息複製
  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content).catch((err) => {
      console.error("無法複製內容：", err);
      setError("無法複製到剪貼簿。");
    });
  };

  // 處理消息編輯
  const handleEditMessage = (messageId: string, newContent: string) => {
    setMessages((prev) => {
      const updatedMessages = [...prev];
      const messageIndex = updatedMessages.findIndex((m) => m.id === messageId);

      if (messageIndex !== -1) {
        updatedMessages[messageIndex] = {
          ...updatedMessages[messageIndex],
          content: newContent,
        };
      }

      return updatedMessages;
    });
  };

  // 處理消息刪除
  const handleDeleteMessage = (messageId: string) => {
    setMessages((prev) => {
      // 找到要刪除的消息的索引
      const messageIndex = prev.findIndex((m) => m.id === messageId);

      if (messageIndex === -1) return prev;

      // 製作一個新的消息數組，移除該消息
      const updatedMessages = [...prev];
      updatedMessages.splice(messageIndex, 1);

      return updatedMessages;
    });
  };

  // 處理消息重新生成
  const handleRegenerateMessage = async (messageId: string, modelName?: string) => {
    // 找到當前消息及其索引
    const messageIndex = messages.findIndex((m) => m.id === messageId);
    if (messageIndex === -1) return;

    // 找到該助手消息之前的用戶消息
    let userMessageIndex = messageIndex - 1;
    while (userMessageIndex >= 0 && messages[userMessageIndex].role !== "user") {
      userMessageIndex--;
    }

    if (userMessageIndex < 0) {
      setError("找不到用戶提問，無法重新生成回應。");
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const userMessage = messages[userMessageIndex];

    // 刪除當前的助手消息
    const updatedMessages = [...messages];
    updatedMessages.splice(messageIndex, 1);
    setMessages(updatedMessages);

    // 重新生成回應
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

      // 收集上下文消息，直到並包括用戶消息
      const contextMessages = messages.slice(0, userMessageIndex + 1);

      // 如果指定了模型，則使用該模型
      const settingsToUse = modelName ? { ...settings, model: modelName } : settings;

      await chatCompletion(contextMessages, settingsToUse, (token) => {
        setMessages((prev) => {
          const updatedMsgs = [...prev];
          const msgIndex = updatedMsgs.findIndex((m) => m.id === assistantMessageId);

          if (msgIndex !== -1) {
            updatedMsgs[msgIndex] = {
              ...updatedMsgs[msgIndex],
              content: updatedMsgs[msgIndex].content + token,
            };
          }

          return updatedMsgs;
        });
      });
    } catch (err: any) {
      setError(err.message || "重新生成回應時出錯。請檢查您的設置並重試。");
      console.error("重新生成回應錯誤:", err);
    } finally {
      setIsLoading(false);
      setStreamingMessageId(null);
    }
  };

  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(false);

  // 從 API 獲取可用模型
  const getAvailableModels = async () => {
    if (!settings.apiKey || !settings.baseUrl) {
      // 如果沒有設置 API 密鑰或基礎 URL，則返回預設模型列表
      return ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo", "claude-instant-v1", "claude-v2"];
    }

    setIsLoadingModels(true);
    try {
      const models = await fetchModels(settings, {
        onStart: () => setIsLoadingModels(true),
        onSuccess: (data) => {
          const modelIds = data.map((model) => model.id);
          setAvailableModels(modelIds);
        },
        onError: (error) => {
          console.error("Failed to fetch models:", error);
          // 失敗時使用預設模型列表
          setAvailableModels([
            "gpt-4",
            "gpt-4-turbo",
            "gpt-3.5-turbo",
            "claude-instant-v1",
            "claude-v2",
          ]);
        },
        onComplete: () => setIsLoadingModels(false),
      });

      return models ? models.map((model) => model.id) : availableModels;
    } catch (error) {
      console.error("Error fetching models:", error);
      setIsLoadingModels(false);
      return availableModels;
    }
  };

  // Monitor the currently streaming message for code blocks
  useEffect(() => {
    if (!streamingMessageId) return;

    const message = messages.find((m) => m.id === streamingMessageId);
    if (!message) return;

    // Only process text content
    const messageContent = typeof message.content === "string" ? message.content : "";

    // Check for in-progress code blocks with 5+ lines
    const { codeBlock, blockPosition, lineCount } = detectInProgressCodeBlock(messageContent, 5);

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
      codeBlockPosition &&
      typeof message.content === "string"
    ) {
      // Get the updated in-progress code block
      const updatedBlock = message.content.substring(codeBlockPosition.start);
      setMarkdownContent(updatedBlock);
      setCodeBlockPosition({
        start: codeBlockPosition.start,
        end: message.content.length,
      });
    }
  }, [messages, streamingMessageId, codeBlockDetected, editingMessageId, codeBlockPosition]);

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

        if (containerWidth && markdownContainer && chatContainer && mainContainerRef.current) {
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
    const newThreadId = "thread_dvc_" + uuidv4().replace(/-/g, "").substring(0, 16);
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

  const handleSendMessage = async (content: string | MessageContent[]) => {
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
      // First determine the task type if content is a string
      const messageText =
        typeof content === "string"
          ? content
          : content.find((item) => item.type === "text")?.text || "";

      // Only detect task type if we have text content
      let taskType: "canvas" | "image" | "chat" = "chat"; // Default to chat
      if (messageText) {
        try {
          taskType = await detectTaskType(messageText, settings);
          console.log(`Detected task type: ${taskType}`);
        } catch (err) {
          console.error("Error in task detection:", err);
          // Continue with default chat mode if detection fails
        }
      }

      const assistantMessageId = uuidv4();
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: "assistant",
        content: taskType === "image" ? "Creating your Image..." : "",
        timestamp: new Date(),
        isGeneratingImage: taskType === "image", // Mark as generating image if detected as image task
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingMessageId(assistantMessageId);

      if (taskType === "image") {
        // Handle image generation
        const { imageUrl, textResponse } = await generateImageAndText(messageText, settings);

        // Update message with image and description
        setMessages((prev) => {
          const updatedMessages = [...prev];
          const messageIndex = updatedMessages.findIndex((m) => m.id === assistantMessageId);
          if (messageIndex !== -1) {
            updatedMessages[messageIndex] = {
              ...updatedMessages[messageIndex],
              content: textResponse,
              imageUrl: imageUrl,
              isGeneratingImage: false, // Remove generating status
            };
          }
          return updatedMessages;
        });
      } else if (taskType === "canvas") {
        // Enhanced canvas mode with two-step generation

        // Step 1: Generate code block only - this will go directly to MarkdownCanvas
        let codeBlock = "";
        const codeSystemMessage: Message = {
          id: "system-code-msg",
          role: "system",
          content:
            "You are a coding assistant. Provide only a single code block solution with language formatting (e.g., ```javascript). Start directly with the code block and do not include any explanations or comments outside the code block. Make the solution concise and complete. Make sure all descriptions are in user language.",
          timestamp: new Date(),
        };

        // Create a separate code message ID for the MarkdownCanvas content
        const codeMessageId = uuidv4();

        // Open the MarkdownCanvas immediately to prepare for streaming
        setMarkdownContent("");
        setEditingMessageId(codeMessageId);
        setCodeBlockPosition({ start: 0, end: 0 });
        setIsMarkdownCanvasOpen(true);

        // 第一步：生成代码，并在生成过程中累积结果
        await chatCompletion([codeSystemMessage, userMessage], settings, (token) => {
          codeBlock += token;

          // Update MarkdownCanvas content with each token received - true streaming
          setMarkdownContent(codeBlock);
          setCodeBlockPosition({ start: 0, end: codeBlock.length });

          // 实时更新消息内容
          setMessages((prev) => {
            const updatedMessages = [...prev];
            const messageIndex = updatedMessages.findIndex((m) => m.id === assistantMessageId);
            if (messageIndex !== -1) {
              updatedMessages[messageIndex] = {
                ...updatedMessages[messageIndex],
                content: token, // 仅显示当前 token，这个将在下面被 ChatBox 捕获但不显示
              };
            }
            return updatedMessages;
          });
        });

        // Step 2: Generate explanation text (separate from code)
        const explanationSystemMessage: Message = {
          id: "system-explain-msg",
          role: "system",
          content:
            "Now explain the code you provided in user language. Give context on how it works and any important implementation details. Don't repeat the code itself, just provide the explanation.",
          timestamp: new Date(),
        };

        // Create a message that represents the generated code (for context)
        const codeContextMessage: Message = {
          id: "assistant-code-context",
          role: "assistant",
          content: codeBlock,
          timestamp: new Date(),
        };

        // 第二步：生成解释文本
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        let explanation = "";

        // 更新 ChatBox 中的消息内容为空，准备接收解释文本
        setMessages((prev) => {
          const updatedMessages = [...prev];
          const messageIndex = updatedMessages.findIndex((m) => m.id === assistantMessageId);
          if (messageIndex !== -1) {
            updatedMessages[messageIndex] = {
              ...updatedMessages[messageIndex],
              content: "", // 清空内容，准备接收解释文本
            };
          }
          return updatedMessages;
        });

        // 确保我们不会意外更新 MarkdownCanvas 的内容
        setCodeBlockDetected(true);

        // 生成解释文本
        await chatCompletion(
          [explanationSystemMessage, userMessage, codeContextMessage],
          settings,
          (token) => {
            explanation += token;
            // 更新 ChatBox 中显示的解释文本
            setMessages((prev) => {
              const updatedMessages = [...prev];
              const messageIndex = updatedMessages.findIndex((m) => m.id === assistantMessageId);
              if (messageIndex !== -1) {
                const currentContent = updatedMessages[messageIndex].content as string;
                updatedMessages[messageIndex] = {
                  ...updatedMessages[messageIndex],
                  content: currentContent + token, // 只累积解释部分
                };
              }
              return updatedMessages;
            });
          },
        );
      } else {
        // Handle normal chat or code tasks (code detection happens on response)
        await chatCompletion([...messages, userMessage], settings, (token) => {
          setMessages((prev) => {
            const updatedMessages = [...prev];
            const messageIndex = updatedMessages.findIndex((m) => m.id === assistantMessageId);
            if (messageIndex !== -1) {
              updatedMessages[messageIndex] = {
                ...updatedMessages[messageIndex],
                content: updatedMessages[messageIndex].content + token,
              };
            }
            return updatedMessages;
          });
        });
      }
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
      setCodeBlockPosition(null);
    } else {
      // First try to find any in-progress code block
      const { codeBlock: inProgressBlock, blockPosition: inProgressPosition } =
        detectInProgressCodeBlock(content, 0);

      if (inProgressBlock && inProgressPosition) {
        openMarkdownCanvas(messageId, inProgressBlock, inProgressPosition);
      } else {
        // Fall back to completed code block
        const { longestBlock, blockPosition } = extractLongestCodeBlock(content);
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

  const handleMarkdownDetected = (content: string, messageId: string) => {
    if (content.includes("```")) {
      // First check for in-progress code blocks
      const { codeBlock, blockPosition } = detectInProgressCodeBlock(content, 5);
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

  const handleSaveMarkdown = (editedContent: string) => {
    setMessages((prev) => {
      const updatedMessages = [...prev];
      const messageIndex = updatedMessages.findIndex((m) => m.id === editingMessageId);

      if (messageIndex !== -1 && codeBlockPosition) {
        const originalContent = updatedMessages[messageIndex].content;

        // Only handle string content for now
        if (typeof originalContent === "string") {
          const newContent =
            originalContent.substring(0, codeBlockPosition.start) +
            editedContent +
            originalContent.substring(codeBlockPosition.end);

          updatedMessages[messageIndex] = {
            ...updatedMessages[messageIndex],
            content: newContent,
          };
        }
      }

      return updatedMessages;
    });

    setMarkdownContent(editedContent);
  };

  const handleCloseMarkdownCanvas = () => {
    setIsMarkdownCanvasOpen(false);
    setEditingMessageId(null);
    setCodeBlockPosition(null);
  };

  return (
    <div className='app' ref={appContainerRef}>
      {/* Sidebar with resizer */}
      <div className='sidebar' ref={sidebarRef} style={{ width: `${sidebarWidth}px` }}>
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
            onMarkdownDetected={handleMarkdownDetected}
            isLoading={isLoading}
            streamingMessageId={streamingMessageId}
            editingMessageId={editingMessageId}
            longestCodeBlockPosition={codeBlockPosition}
            toggleMarkdownCanvas={toggleMarkdownCanvas}
            onCopy={handleCopyMessage}
            onEdit={handleEditMessage}
            onDelete={handleDeleteMessage}
            onRegenerate={handleRegenerateMessage}
            fetchModels={getAvailableModels}
            currentModel={settings.model}
            isLoadingModels={isLoadingModels}
          />

          {isLoading && (
            <div className='loading-indicator'>
              <p>Thinking...</p>
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
