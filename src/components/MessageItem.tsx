import React, { ReactNode } from 'react';
import { Message } from '../types';

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
  toggleMarkdownCanvas
}) => {
  // Function to replace the longest code block with a placeholder when message is being edited
  const processMessageContent = (content: string): ReactNode[] => {
    if (isEditing && longestCodeBlockPosition) {
      const { start, end } = longestCodeBlockPosition;
      const beforeBlock = content.substring(0, start);
      const afterBlock = content.substring(end);

      // Split the text into lines and create elements
      const beforeLines = beforeBlock.split('\n').map((line, i) =>
        <div key={`before-${i}`}>{line || <br />}</div>
      );

      const afterLines = afterBlock.split('\n').map((line, i) =>
        <div key={`after-${i}`}>{line || <br />}</div>
      );

      // Create the clickable placeholder element - show different text based on open/closed state
      const placeholderElement = (
        <div key="placeholder" className="code-block-placeholder" onClick={toggleMarkdownCanvas}>
          <span className={`code-block-link ${isEditing ? 'active' : ''}`}>
            {isEditing ? '[Click to close editor ←]' : '[Code is displayed in the editor panel →]'}
          </span>
        </div>
      );

      return [...beforeLines, placeholderElement, ...afterLines];
    }

    // If not editing, just return the regular content split by lines
    return content.split('\n').map((line, i) => <div key={i}>{line || <br />}</div>);
  };

  const contentElements = processMessageContent(message.content);

  return (
    <div className={`message ${message.role} ${isStreaming ? 'streaming' : ''}`}>
      <div className="message-header">
        <span className="role">{message.role === 'assistant' ? 'AI' : 'You'}</span>
        <span className="timestamp">
          {message.timestamp.toLocaleTimeString()}
          {isStreaming && <span className="streaming-indicator"> (typing...)</span>}
        </span>
      </div>
      <div className="message-content">
        {contentElements}
        {isStreaming && message.content === '' && <div className="typing-indicator">...</div>}
      </div>
    </div>
  );
};

export default MessageItem;
