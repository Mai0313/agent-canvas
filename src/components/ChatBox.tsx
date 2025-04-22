import React, { useState, useRef, useEffect } from "react";
import { Message, ModelSetting } from "../types";
import MessageItem from "./MessageItem";
import { containsMarkdown } from "../utils/markdownUtils";

interface ChatBoxProps {
  messages: Message[];
  settings: ModelSetting;
  onSendMessage: (content: string) => void;
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
  onMarkdownDetected,
  isLoading,
  streamingMessageId,
  editingMessageId,
  longestCodeBlockPosition,
  toggleMarkdownCanvas,
}) => {
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);
  const [prevMessagesLength, setPrevMessagesLength] = useState(0);

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
      onSendMessage(inputValue.trim());
      setInputValue("");
      // 用戶發送消息後設置為自動滾動到底部
      setShouldScrollToBottom(true);
    }
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
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className='chat-input-form' onSubmit={handleSubmit}>
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder='Type your message...'
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
          <svg
            width='32'
            height='32'
            viewBox='0 0 32 32'
            fill='none'
            xmlns='http://www.w3.org/2000/svg'
            className='icon-2xl'
          >
            <path
              fill-rule='evenodd'
              clip-rule='evenodd'
              d='M15.1918 8.90615C15.6381 8.45983 16.3618 8.45983 16.8081 8.90615L21.9509 14.049C22.3972 14.4953 22.3972 15.2189 21.9509 15.6652C21.5046 16.1116 20.781 16.1116 20.3347 15.6652L17.1428 12.4734V22.2857C17.1428 22.9169 16.6311 23.4286 15.9999 23.4286C15.3688 23.4286 14.8571 22.9169 14.8571 22.2857V12.4734L11.6652 15.6652C11.2189 16.1116 10.4953 16.1116 10.049 15.6652C9.60265 15.2189 9.60265 14.4953 10.049 14.049L15.1918 8.90615Z'
              fill='currentColor'
            ></path>
          </svg>
        </button>
      </form>
    </div>
  );
};

export default ChatBox;
