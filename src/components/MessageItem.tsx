import React from 'react';
import { Message } from '../types';

interface MessageItemProps {
  message: Message;
  isStreaming?: boolean;
}

const MessageItem: React.FC<MessageItemProps> = ({ message, isStreaming = false }) => {
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
        {message.content.split('\n').map((line, i) => (
          <div key={i}>{line || <br />}</div>
        ))}
        {isStreaming && message.content === '' && <div className="typing-indicator">...</div>}
      </div>
    </div>
  );
};

export default MessageItem;
