import React, { ReactNode, useState, useEffect, useRef } from "react";
import { Message } from "../types";
import SelectionPopup from "./SelectionPopup";

interface MessageItemProps {
  message: Message;
  isStreaming?: boolean;
  isEditing?: boolean;
  longestCodeBlockPosition?: { start: number; end: number } | null;
  toggleMarkdownCanvas: () => void;
  onAskGpt?: (selectedText: string) => void; // New prop for handling "Ask GPT"
}

const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isStreaming = false,
  isEditing = false,
  longestCodeBlockPosition = null,
  toggleMarkdownCanvas,
  onAskGpt,
}) => {
  const [showSelectionPopup, setShowSelectionPopup] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
  const messageRef = useRef<HTMLDivElement>(null);

  // Handle mouse up event to detect text selection
  const handleMouseUp = () => {
    const selection = window.getSelection();

    // If there's a selection and it's not empty
    if (
      selection &&
      !selection.isCollapsed &&
      selection.toString().trim() !== ""
    ) {
      const selectedContent = selection.toString();
      setSelectedText(selectedContent);

      // Calculate position for the popup
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      setPopupPosition({
        top: rect.bottom + window.scrollY + 5, // Position below the selection with a small gap
        left: rect.left + window.scrollX + rect.width / 2 - 40, // Center the popup
      });

      setShowSelectionPopup(true);
    } else {
      setShowSelectionPopup(false);
    }
  };

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        messageRef.current &&
        !messageRef.current.contains(event.target as Node)
      ) {
        setShowSelectionPopup(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Function to render the message content with a "View Code" button if needed
  const processMessageContent = (): ReactNode[] => {
    // 如果正在生成圖像，顯示動態加載效果
    if (message.isGeneratingImage) {
      return [
        <div key='generating-image' className='generating-image-container'>
          <div className='generating-image-animation'>
            <div className='brush-stroke'></div>
            <div className='brush-stroke'></div>
            <div className='brush-stroke'></div>
          </div>
          <div className='generating-image-text'>{message.content}</div>
        </div>,
      ];
    }
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
      // // Add the code block placeholder with a button to toggle the canvas
      // elements.push(
      //   <div className='code-block-placeholder' key='placeholder'>
      //     <button
      //       className='code-block-link active'
      //       onClick={toggleMarkdownCanvas}
      //     >
      //       <span>Code is displayed in editor →</span>
      //     </button>
      //   </div>,
      // );
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

  // Handle "Ask GPT" button click
  const handleAskGpt = (text: string) => {
    if (onAskGpt) {
      onAskGpt(text);
      setShowSelectionPopup(false);
    }
  };

  return (
    <div
      ref={messageRef}
      className={`message ${message.role} ${isStreaming ? "streaming" : ""}`}
      onMouseUp={handleMouseUp}
    >
      <div className='message-header'>
        <span className='role'>
          {message.role === "assistant" ? "AI" : "You"}
        </span>
        <span className='timestamp'>
          {message.timestamp.toLocaleTimeString()}
          {isStreaming && !message.isGeneratingImage && (
            <span className='streaming-indicator'> (typing...)</span>
          )}
        </span>
      </div>
      <div className='message-content'>
        {processMessageContent()}
        {isStreaming &&
          message.content === "" &&
          !message.isGeneratingImage && (
            <div className='typing-indicator'>...</div>
          )}
        {message.imageUrl && (
          <div className='message-image-container'>
            <img
              src={message.imageUrl}
              // eslint-disable-next-line jsx-a11y/img-redundant-alt
              alt='AI generated content'
              className='message-image'
            />
          </div>
        )}
      </div>

      {showSelectionPopup && (
        <SelectionPopup
          position={popupPosition}
          selectedText={selectedText}
          onAskGpt={handleAskGpt}
        />
      )}
    </div>
  );
};

export default MessageItem;
