import React, { useState, useEffect, useRef } from "react";
import { ChatCompletion } from "../services/openai";
import { ModelSetting, Message } from "../types";

interface MarkdownCanvasProps {
  content: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (content: string) => void;
}

const MarkdownCanvas: React.FC<MarkdownCanvasProps> = ({
  content,
  isOpen,
  onClose,
  onSave,
}) => {
  const [editMode, setEditMode] = useState(false);
  const [editableContent, setEditableContent] = useState(content);
  const canvasRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState("Code Editor");
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);

  // Store scroll position of the parent container
  const [scrollPosition, setScrollPosition] = useState(0);

  // Update content when it changes
  useEffect(() => {
    setEditableContent(content);
  }, [content]);

  // Capture the scroll position when the editor is opened
  useEffect(() => {
    if (isOpen) {
      // Store the current scroll position
      setScrollPosition(window.scrollY || document.documentElement.scrollTop);
    }
  }, [isOpen]);

  // Restore the scroll position when editor state changes
  useEffect(() => {
    if (isOpen) {
      // Use a small timeout to ensure the DOM has updated
      const timer = setTimeout(() => {
        window.scrollTo(0, scrollPosition);
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [isOpen, scrollPosition, editMode]);

  useEffect(() => {
    // Add click event listener to detect clicks outside the panel
    const handleClickOutside = (event: MouseEvent) => {
      if (
        canvasRef.current &&
        !canvasRef.current.contains(event.target as Node) &&
        !event.target?.toString().includes("code-block-link")
      ) {
        // Only close if we're not clicking on the toggle element itself
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Prevent wheel events on the canvas from propagating 
  // to the parent container, but allow scrolling within the textarea
  const handleWheel = (event: React.WheelEvent) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const { scrollTop, scrollHeight, clientHeight } = textarea;
    const isAtTop = scrollTop === 0;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;

    // If we're at the boundaries, let the event propagate to the parent
    if ((isAtTop && event.deltaY < 0) || (isAtBottom && event.deltaY > 0)) {
      return; // Let parent handle it
    } else {
      // Otherwise prevent propagation to allow scrolling within the textarea
      event.stopPropagation();
    }
  };

  const handleEdit = () => {
    setEditMode(true);
  };

  const handleSave = () => {
    onSave(editableContent);
    setEditMode(false);
  };

  const handleCancel = () => {
    setEditableContent(content);
    setEditMode(false);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditableContent(e.target.value);
  };

  const generateTitle = async () => {
    if (!editableContent.trim()) return;
    
    setIsGeneratingTitle(true);
    
    try {
      // Default settings for the API call
      const settings: ModelSetting = {
        api_type: "openai",
        model: "gpt-4o",
        baseUrl: process.env.BASE_URL || "https://tma.mediatek.inc/tma/sdk/api",
        apiKey: process.env.API_KEY || "srv_dvc_tma001",
        temperature: 0.7,
        maxTokens: 50,
        azureDeployment: "",
        azureApiVersion: "2025-03-01-preview",
      };

      const messages: Message[] = [
        {
          id: "system-msg",
          role: "system",
          content: "You are an assistant that helps name code snippets concisely.",
          timestamp: new Date(),
        },
        {
          id: "user-msg",
          role: "user",
          content: `Given this code snippet, provide a short, descriptive title (3-5 words) that describes what the code does. Don't include words like "code", "function", "class", etc. Just give the title directly:\n\n${editableContent}`,
          timestamp: new Date(),
        },
      ];

      let generatedTitle = "";
      await ChatCompletion(messages, settings, (token) => {
        generatedTitle += token;
      });

      // Clean up the title (remove quotes if present)
      generatedTitle = generatedTitle.replace(/^["']|["']$/g, '').trim();
      
      if (generatedTitle) {
        setTitle(generatedTitle);
      }
    } catch (error) {
      console.error("Error generating title:", error);
    } finally {
      setIsGeneratingTitle(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="markdown-canvas" 
      ref={canvasRef}
      style={{ position: "relative", overflow: "hidden" }}
    >
      <div className="markdown-header">
        <div style={{ display: "flex", alignItems: "center" }}>
          <h3>{title}</h3>
          <button 
            onClick={generateTitle} 
            disabled={isGeneratingTitle}
            style={{ 
              marginLeft: "10px", 
              fontSize: "12px", 
              padding: "3px 6px"
            }}
          >
            {isGeneratingTitle ? "Generating..." : "AI Title"}
          </button>
        </div>
        <div className="markdown-controls">
          {!editMode ? (
            <button onClick={handleEdit}>Edit</button>
          ) : (
            <>
              <button onClick={handleSave}>Save</button>
              <button onClick={handleCancel}>Cancel</button>
            </>
          )}
          <button onClick={onClose}>Close</button>
        </div>
      </div>

      <div className="markdown-content" style={{ overflow: "hidden" }}>
        <textarea
          ref={textareaRef}
          value={editableContent}
          onChange={handleContentChange}
          readOnly={!editMode}
          className={editMode ? "markdown-editor" : "markdown-preview"}
          onWheel={handleWheel}
          style={{
            width: "100%",
            height: "100%", 
            backgroundColor: "#282c34",
            color: "#f8f9fa",
            padding: "20px",
            fontFamily: "Consolas, 'Courier New', monospace",
            fontSize: "14px",
            border: "none",
            outline: editMode ? "1px solid #495057" : "none",
            resize: "none",
            overflowY: "auto" // Keep this as the only scrollable element
          }}
        />
      </div>
    </div>
  );
};

export default MarkdownCanvas;
