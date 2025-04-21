import React, { ReactNode } from "react";
import { Message } from "../types";

interface MessageItemProps {
  message: Message;
  isStreaming?: boolean;
  isEditing?: boolean;
  longestCodeBlockPosition?: { start: number; end: number } | null;
  toggleMarkdownCanvas: () => void;
}

const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isStreaming = false,
  isEditing = false,
  longestCodeBlockPosition = null,
  toggleMarkdownCanvas,
}) => {
  // Function to render the message content with a "View Code" button if needed
  const processMessageContent = (): ReactNode[] => {
    // Check if there's a code block in the message
    const hasCodeBlock = message.content.includes("```");

    if (hasCodeBlock && !isEditing) {
      // Split the message content by lines for better rendering
      return message.content
        .split("\n")
        .map((line, i) => <div key={i}>{line || <br />}</div>);
    }

    // Regular content display (no code blocks or currently editing)
    return message.content
      .split("\n")
      .map((line, i) => <div key={i}>{line || <br />}</div>);
  };

  return (
    <div
      className={`message ${message.role} ${isStreaming ? "streaming" : ""}`}
    >
      <div className='message-header'>
        <span className='role'>
          {message.role === "assistant" ? "AI" : "You"}
        </span>
        <span className='timestamp'>
          {message.timestamp.toLocaleTimeString()}
          {isStreaming && (
            <span className='streaming-indicator'> (typing...)</span>
          )}
        </span>
      </div>
      <div className='message-content'>
        {processMessageContent()}
        {isStreaming && message.content === "" && (
          <div className='typing-indicator'>...</div>
        )}
      </div>
    </div>
  );
};

export default MessageItem;
