import React from 'react';
import { Message } from '../types';

interface MessageItemProps {
  message: Message;
  isStreaming?: boolean;
  isEditing?: boolean;
  longestCodeBlockPosition?: { start: number; end: number } | null;
}

const MessageItem: React.FC<MessageItemProps> = ({ 
  message, 
  isStreaming = false,
  isEditing = false,
  longestCodeBlockPosition = null
}) => {
  // Function to replace the longest code block with a placeholder when message is being edited
  const processMessageContent = (content: string): string => {
    if (isEditing && longestCodeBlockPosition) {
      const { start, end } = longestCodeBlockPosition;
      return content.substring(0, start) + '[Code is displayed in the editor panel →]' + content.substring(end);
    }
    return content;
  };

  const processedContent = processMessageContent(message.content);

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
        {processedContent.split('\n').map((line, i) => (
          <div key={i}>{line || <br />}</div>
        ))}
        {isStreaming && message.content === '' && <div className="typing-indicator">...</div>}
        {isEditing && longestCodeBlockPosition && (
          <div className="code-editing-indicator">
            <em>Longest code block is displayed in the editor panel →</em>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageItem;
