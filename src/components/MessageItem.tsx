import React from 'react';
import { Message } from '../types';

interface MessageItemProps {
  message: Message;
}

const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  return (
    <div className={`message ${message.role}`}>
      <div className="message-header">
        <span className="role">{message.role === 'assistant' ? 'AI' : 'You'}</span>
        <span className="timestamp">
          {message.timestamp.toLocaleTimeString()}
        </span>
      </div>
      <div className="message-content">
        {message.content.split('\n').map((line, i) => (
          <div key={i}>{line || <br />}</div>
        ))}
      </div>
    </div>
  );
};

export default MessageItem;
