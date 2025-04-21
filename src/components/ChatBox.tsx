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

  useEffect(() => {
    scrollToBottom();

    // Check if the latest assistant message contains markdown
    const lastAssistantMessage = [...messages]
      .reverse()
      .find((m) => m.role === "assistant");

    if (
      lastAssistantMessage &&
      containsMarkdown(lastAssistantMessage.content)
    ) {
      onMarkdownDetected(lastAssistantMessage.content, lastAssistantMessage.id);
    }
  }, [messages, onMarkdownDetected]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (inputValue.trim()) {
      onSendMessage(inputValue.trim());
      setInputValue("");
    }
  };
  console.log("Model:", settings.model);

  return (
    <div className='chat-box'>
      <div className='messages-container'>
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
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          disabled={isLoading}
        />
        <button type='submit' disabled={!inputValue.trim() || isLoading}>
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatBox;
