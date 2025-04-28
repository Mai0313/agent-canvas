import React, { ReactNode, useState, useEffect, useRef } from "react";
import { Message } from "../types";
import SelectionPopup from "./SelectionPopup";

// 導入圖標
import copyCodeIcon from "../assets/icon/copy-code.svg";
import editCodeIcon from "../assets/icon/edit-code.svg";
import deleteIcon from "../assets/icon/delete.svg";
import regenerateIcon from "../assets/icon/regenerate.svg";

interface MessageItemProps {
  message: Message;
  isStreaming?: boolean;
  isEditing?: boolean;
  longestCodeBlockPosition?: { start: number; end: number } | null;
  toggleMarkdownCanvas: () => void;
  onAskGpt?: (selectedText: string) => void;
  onCopy?: (content: string) => void;
  onEdit?: (messageId: string, newContent: string) => void;
  onDelete?: (messageId: string) => void;
  onRegenerate?: (messageId: string, modelName?: string) => void;
  fetchModels?: () => Promise<string[]>;
  currentModel?: string;
  isLoadingModels?: boolean;
}

const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isStreaming = false,
  isEditing = false,
  longestCodeBlockPosition = null,
  toggleMarkdownCanvas,
  onAskGpt,
  onCopy,
  onEdit,
  onDelete,
  onRegenerate,
  fetchModels,
  currentModel = "",
  isLoadingModels = false,
}) => {
  const [showSelectionPopup, setShowSelectionPopup] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const messageRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 當模型下拉選單打開時，獲取可用模型
  useEffect(() => {
    if (showModelDropdown && fetchModels && !availableModels.length && !loadingModels) {
      setLoadingModels(true);
      fetchModels()
        .then((models) => {
          setAvailableModels(models);
        })
        .catch((err) => {
          console.error("獲取模型列表失敗:", err);
        })
        .finally(() => {
          setLoadingModels(false);
        });
    }
  }, [showModelDropdown, fetchModels, availableModels.length, loadingModels]);

  // 當進入編輯模式時，設置初始內容
  useEffect(() => {
    if (isEditMode) {
      setEditedContent(message.content);
      // 聚焦文本框並移動光標到末尾
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.selectionStart = textareaRef.current.value.length;
          textareaRef.current.selectionEnd = textareaRef.current.value.length;
        }
      }, 0);
    }
  }, [isEditMode, message.content]);

  // 處理點擊外部關閉下拉選單
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowModelDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle mouse up event to detect text selection
  const handleMouseUp = () => {
    if (isEditMode) return; // 編輯模式下不啟用文字選擇

    const selection = window.getSelection();
    // If there's a selection and it's not empty
    if (selection && !selection.isCollapsed && selection.toString().trim() !== "") {
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
      if (messageRef.current && !messageRef.current.contains(event.target as Node)) {
        setShowSelectionPopup(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // 處理複製按鈕點擊事件
  const handleCopy = () => {
    if (onCopy) {
      onCopy(message.content);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } else {
      // 備用方案：直接使用 clipboard API
      navigator.clipboard.writeText(message.content).then(
        () => {
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 2000);
        },
        (err) => {
          console.error("無法複製內容: ", err);
        },
      );
    }
  };

  // 處理編輯按鈕點擊事件
  const handleEdit = () => {
    setIsEditMode(true);
  };

  // 處理保存按鈕點擊事件
  const handleSave = () => {
    if (onEdit && editedContent.trim() !== "") {
      onEdit(message.id, editedContent);
    }
    setIsEditMode(false);
  };

  // 處理取消按鈕點擊事件
  const handleCancel = () => {
    setIsEditMode(false);
    setEditedContent(message.content);
  };

  // 處理刪除按鈕點擊事件
  const handleDelete = () => {
    if (onDelete) {
      onDelete(message.id);
    }
  };

  // 處理重新生成按鈕點擊事件
  const handleRegenerate = (modelName?: string) => {
    if (onRegenerate) {
      onRegenerate(message.id, modelName);
      setShowModelDropdown(false);
    }
  };

  // 切換模型下拉選單
  const toggleModelDropdown = () => {
    setShowModelDropdown(!showModelDropdown);
  };

  // Function to render the message content with a "View Code" button if needed
  const processMessageContent = (): ReactNode[] => {
    // 如果處於編輯模式，渲染文本編輯區
    if (isEditMode && message.role === "assistant") {
      return [
        <div key='edit-container' className='edit-container'>
          <textarea
            ref={textareaRef}
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className='edit-textarea'
            rows={Math.max(5, editedContent.split("\n").length)}
          />
          <div className='edit-buttons'>
            <button onClick={handleSave} className='edit-save-button'>
              Send
            </button>
            <button onClick={handleCancel} className='edit-cancel-button'>
              Cancel
            </button>
          </div>
        </div>,
      ];
    }

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
      const beforeCode = message.content.substring(0, longestCodeBlockPosition.start);
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
    return message.content.split("\n").map((line, i) => <div key={i}>{line || <br />}</div>);
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
      className={`message ${message.role} ${
        isStreaming ? "streaming" : ""
      } ${isEditMode ? "editing" : ""}`}
      onMouseUp={handleMouseUp}
    >
      <div className='message-header'>
        <span className='role'>{message.role === "assistant" ? "AI" : "You"}</span>
        <span className='timestamp'>
          {message.timestamp.toLocaleTimeString()}
          {isStreaming && !message.isGeneratingImage && (
            <span className='streaming-indicator'> (typing...)</span>
          )}
        </span>
      </div>

      <div className='message-content'>
        {processMessageContent()}
        {isStreaming && message.content === "" && !message.isGeneratingImage && (
          <div className='typing-indicator'>...</div>
        )}
        {message.imageUrl && (
          <div className='message-image-container'>
            <img src={message.imageUrl} alt='AI generated content' className='message-image' />
          </div>
        )}
      </div>

      {/* 消息操作按鈕 - 只在助手消息且非編輯模式下顯示 */}
      {message.role === "assistant" && !isEditMode && !isStreaming && (
        <div className='message-actions'>
          <button
            onClick={handleCopy}
            className={`action-button with-icon ${copySuccess ? "copy-success" : ""}`}
            title='Copy to clipboard'
          >
            <img src={copyCodeIcon} alt='Copy' className='icon-action' />
            {copySuccess ? "Copied" : "Copy"}
          </button>

          <button onClick={handleEdit} className='action-button with-icon' title='Edit message'>
            <img src={editCodeIcon} alt='Edit' className='icon-action' />
            Edit
          </button>

          <button
            onClick={handleDelete}
            className='action-button with-icon'
            title='Delete message'
          >
            <img src={deleteIcon} alt='Delete' className='icon-action' />
            Delete
          </button>

          <div className='regenerate-dropdown-container' ref={dropdownRef}>
            <button
              onClick={toggleModelDropdown}
              className='action-button with-icon regenerate-button'
              title='Regenerate response'
            >
              <img src={regenerateIcon} alt='Regenerate' className='icon-action' />
              Regenerate {showModelDropdown ? "▲" : "▼"}
            </button>

            {showModelDropdown && (
              <div className='model-dropdown'>
                <div className='model-dropdown-header'>Choose model:</div>

                {/* 當前模型選項 */}
                <div className='model-dropdown-item' onClick={() => handleRegenerate()}>
                  Current ({currentModel || "default"})
                </div>

                {/* 載入提示 */}
                {(loadingModels || isLoadingModels) && (
                  <div className='model-dropdown-item loading'>Loading models...</div>
                )}

                {/* 可用模型列表 */}
                {availableModels.length > 0 &&
                  !loadingModels &&
                  !isLoadingModels &&
                  availableModels
                    .filter((model) => model !== currentModel) // 過濾掉當前模型
                    .map((model) => (
                      <div
                        key={model}
                        className='model-dropdown-item'
                        onClick={() => handleRegenerate(model)}
                      >
                        {model}
                      </div>
                    ))}

                {/* 沒有模型時顯示提示 */}
                {!loadingModels && !isLoadingModels && availableModels.length === 0 && (
                  <div className='model-dropdown-item no-models'>No other models available</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

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
