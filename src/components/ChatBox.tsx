import React, { useState, useRef, useEffect } from "react";
import { Message, ModelSetting } from "../types";
import MessageItem from "./MessageItem";
import { containsMarkdown } from "../utils/markdownUtils";
// 導入圖標
import sendMessageIcon from "../assets/icon/send-message.svg";

interface ChatBoxProps {
  messages: Message[];
  settings: ModelSetting;
  onSendMessage: (content: string) => void;
  onGenerateImage?: (content: string) => void; // New prop for image generation
  onMarkdownDetected: (content: string, messageId: string) => void;
  isLoading: boolean;
  streamingMessageId?: string | null;
  editingMessageId?: string | null;
  longestCodeBlockPosition?: { start: number; end: number } | null;
  toggleMarkdownCanvas: (messageId: string, content: string) => void;
}

const ChatBox: React.FC<ChatBoxProps> = ({
  messages,
  settings,
  onSendMessage,
  onGenerateImage,
  onMarkdownDetected,
  isLoading,
  streamingMessageId,
  editingMessageId,
  longestCodeBlockPosition,
  toggleMarkdownCanvas,
}) => {
  const [inputValue, setInputValue] = useState("");
  const [quotedText, setQuotedText] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);
  const [prevMessagesLength, setPrevMessagesLength] = useState(0);
  const [imageMode, setImageMode] = useState(false);

  // 檢測用戶是否位於對話底部
  const isNearBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return true;

    const threshold = 100; // 像素閾值
    return (
      container.scrollHeight - container.scrollTop - container.clientHeight <
      threshold
    );
  };

  // 監聽滾動事件，判斷是否應該自動滾動
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setShouldScrollToBottom(isNearBottom());
    };

    container.addEventListener("scroll", handleScroll);
    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    // 只有在以下情況才滾動到底部：
    // 1. 用戶靠近底部
    // 2. 有新消息到達
    // 3. 正在流式傳輸消息
    const hasNewMessages = messages.length > prevMessagesLength;
    const isStreaming = !!streamingMessageId;

    if ((shouldScrollToBottom && hasNewMessages) || isStreaming) {
      scrollToBottom();
    }

    setPrevMessagesLength(messages.length);

    // 檢查最新的助手消息是否包含 markdown
    const lastAssistantMessage = [...messages]
      .reverse()
      .find((m) => m.role === "assistant");

    if (
      lastAssistantMessage &&
      containsMarkdown(lastAssistantMessage.content)
    ) {
      onMarkdownDetected(lastAssistantMessage.content, lastAssistantMessage.id);
    }
  }, [
    messages,
    onMarkdownDetected,
    streamingMessageId,
    prevMessagesLength,
    shouldScrollToBottom,
  ]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (inputValue.trim()) {
      // Build message content with quoted text if available
      let messageContent = inputValue.trim();
      if (quotedText) {
        messageContent = `> ${quotedText}\n\n${messageContent}`;
      }

      if (imageMode && onGenerateImage) {
        // Use the image generation function if in image mode
        onGenerateImage(messageContent);
      } else {
        // Regular text message
        onSendMessage(messageContent);
      }
      setInputValue("");
      setQuotedText(null);
      // 用戶發送消息後設置為自動滾動到底部
      setShouldScrollToBottom(true);
    }
  };

  const toggleImageMode = () => {
    setImageMode(!imageMode);
  };

  // Handle text selection for Ask GPT feature
  const handleAskGpt = (selectedText: string) => {
    setQuotedText(selectedText);
    // Focus the input field after setting the quoted text
    const textarea = document.querySelector(
      ".chat-input-form textarea",
    ) as HTMLTextAreaElement;
    if (textarea) {
      textarea.focus();
    }
  };

  // Function to remove quoted text
  const removeQuotedText = () => {
    setQuotedText(null);
  };

  console.log("Model:", settings.model);

  return (
    <div className='chat-box'>
      <div className='messages-container' ref={messagesContainerRef}>
        {messages.length === 0 ? (
          <div className='empty-state'>
            <h2>Start a conversation with {settings.model}</h2>
            <p>Type your message below to begin</p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              isStreaming={streamingMessageId === message.id}
              isEditing={editingMessageId === message.id}
              longestCodeBlockPosition={
                message.id === editingMessageId
                  ? longestCodeBlockPosition
                  : null
              }
              toggleMarkdownCanvas={() =>
                toggleMarkdownCanvas(message.id, message.content)
              }
              onAskGpt={handleAskGpt}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className='chat-input-form' onSubmit={handleSubmit}>
        <div className='input-controls'>
          <button
            type='button'
            className={`mode-button ${imageMode ? "active" : ""}`}
            onClick={toggleImageMode}
            disabled={isLoading}
          >
            {imageMode ? "🖼️ Image Mode" : "💭 Chat Mode"}
          </button>
        </div>

        {quotedText && (
          <div className='quoted-text-container'>
            <div className='quoted-text'>
              <div className='quote-marker'></div>
              <div className='quote-content'>
                {quotedText.length > 100
                  ? quotedText.substring(0, 100) + "..."
                  : quotedText}
              </div>
              <button
                className='quote-remove-button'
                onClick={removeQuotedText}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <div className='input-row'>
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              quotedText
                ? "Ask about the selected text..."
                : "Type your message..."
            }
            rows={3}
            onKeyDown={(e) => {
              // Only handle Enter key when not in IME composition
              if (e.key === "Enter" && !e.shiftKey && !isComposing) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            disabled={isLoading}
          />
          <button
            type='submit'
            className='send-button'
            disabled={!inputValue.trim() || isLoading}
            aria-label='Send message'
          >
            <img src={sendMessageIcon} alt="Send" className="icon-2xl" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatBox;
