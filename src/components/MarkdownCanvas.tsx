import React, { useState, useEffect, useRef } from "react";

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

  // Update content when it changes
  useEffect(() => {
    setEditableContent(content);
  }, [content]);

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

  if (!isOpen) return null;

  // Simplified implementation that uses a more basic approach with a textarea
  return (
    <div className="markdown-canvas" ref={canvasRef}>
      <div className="markdown-header">
        <h3>Code Editor</h3>
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

      <div className="markdown-content">
        <textarea
          value={editableContent}
          onChange={handleContentChange}
          readOnly={!editMode}
          className={editMode ? "markdown-editor" : "markdown-preview"}
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
            resize: "none"
          }}
        />
      </div>
    </div>
  );
};

export default MarkdownCanvas;
