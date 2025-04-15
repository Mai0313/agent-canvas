import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import ChatBox from './components/ChatBox';
import ModelSettings from './components/ModelSettings';
import MarkdownCanvas from './components/MarkdownCanvas';
import { Message, ModelSettings as ModelSettingsType } from './types';
import { streamChatCompletion } from './services/openai';
import './styles.css';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [settings, setSettings] = useState<ModelSettingsType>({
    provider: 'openai',
    model: 'aide-gpt-4o',
    baseUrl: 'https://tma.mediatek.inc/tma/sdk/api',
    apiKey: 'srv_dvc_tma001',
    userId: 'srv_dvc_tma001',
    temperature: 0.7,
    maxTokens: 2048,
    azureApiVersion: '2025-03-01-preview'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Markdown canvas state
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [isMarkdownCanvasOpen, setIsMarkdownCanvasOpen] = useState(false);

  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

  const handleSendMessage = async (content: string) => {
    // Add user message to the chat
    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      // Create a placeholder for the assistant's response
      const assistantMessageId = uuidv4();
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date()
      };

      // Add the empty message to the UI
      setMessages(prev => [...prev, assistantMessage]);
      setStreamingMessageId(assistantMessageId);

      // Use streaming for the response
      await streamChatCompletion(
        [...messages, userMessage],
        settings,
        (token) => {
          // Update the assistant message with each token
          setMessages(prev => {
            const updatedMessages = [...prev];
            const messageIndex = updatedMessages.findIndex(m => m.id === assistantMessageId);
            if (messageIndex !== -1) {
              updatedMessages[messageIndex] = {
                ...updatedMessages[messageIndex],
                content: updatedMessages[messageIndex].content + token
              };
            }
            return updatedMessages;
          });
        }
      );
    } catch (err: any) {
      // Display the detailed error message from the service
      setError(err.message || 'Failed to get response from the AI. Please check your settings and try again.');
      console.error('Chat completion error:', err);
    } finally {
      setIsLoading(false);
      setStreamingMessageId(null);
    }
  };

  const handleMarkdownDetected = (content: string) => {
    setMarkdownContent(content);
    setIsMarkdownCanvasOpen(true);
  };

  const handleSaveMarkdown = (editedContent: string) => {
    // Replace the content in the last assistant message with the edited markdown
    setMessages(prev => {
      const lastAssistantIndex = [...prev]
        .reverse()
        .findIndex(m => m.role === 'assistant');

      if (lastAssistantIndex === -1) return prev;

      const reversedIndex = prev.length - 1 - lastAssistantIndex;
      const updatedMessages = [...prev];
      updatedMessages[reversedIndex] = {
        ...updatedMessages[reversedIndex],
        content: editedContent
      };

      return updatedMessages;
    });

    setMarkdownContent(editedContent);
  };

  return (
    <div className="app">
      <div className="sidebar">
        <ModelSettings
          settings={settings}
          onSettingsChange={setSettings}
        />
      </div>

      <div className="main-content">
        <ChatBox
          messages={messages}
          onSendMessage={handleSendMessage}
          onMarkdownDetected={handleMarkdownDetected}
          isLoading={isLoading}
          streamingMessageId={streamingMessageId}
        />

        {isLoading && (
          <div className="loading-indicator">
            <p>AI is thinking...</p>
          </div>
        )}

        {error && (
          <div className="error-message">
            <p>{error}</p>
            <button
              onClick={() => setError(null)}
              style={{ background: 'transparent', border: 'none', color: 'white', marginLeft: '10px', cursor: 'pointer' }}
            >
            </button>
          </div>
        )}
      </div>

      <MarkdownCanvas
        content={markdownContent}
        isOpen={isMarkdownCanvasOpen}
        onClose={() => setIsMarkdownCanvasOpen(false)}
        onSave={handleSaveMarkdown}
      />
    </div>
  );
};

export default App;
