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

    // If this message has a code block that's currently being displayed in the canvas
    if (hasCodeBlock && isEditing && longestCodeBlockPosition) {
      // Create message parts: before the code block, a placeholder, and after the code block
      const beforeCode = message.content.substring(
        0,
        longestCodeBlockPosition.start,
      );
      const afterCode = message.content.substring(longestCodeBlockPosition.end);

      // Create an array of elements
      const elements: ReactNode[] = [];

      // Add lines before the code block
      if (beforeCode.trim()) {
        elements.push(
          ...beforeCode
            .split("\n")
            .map((line, i) => <div key={`before-${i}`}>{line || <br />}</div>),
        );
      }

      // Add the code block placeholder with a button to toggle the canvas
      elements.push(
        <div className='code-block-placeholder' key='placeholder'>
          <button
            className='code-block-link active'
            onClick={toggleMarkdownCanvas}
          >
            <span>Code is displayed in editor →</span>
          </button>
        </div>,
      );

      // Add lines after the code block
      if (afterCode.trim()) {
        elements.push(
          ...afterCode
            .split("\n")
            .map((line, i) => <div key={`after-${i}`}>{line || <br />}</div>),
        );
      }

      return elements;
    }

    // Regular content display (no code blocks or not currently editing)
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
