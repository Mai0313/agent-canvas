import React, { useState, useEffect, useRef, useCallback } from "react";
import { Message } from "../types";
import { getDefaultModelSettings } from "../utils/modelUtils";
import { chatCompletion } from "../services/openai";
import SelectionPopup from "./SelectionPopup";

// Import BlockNote components and styles
import "@blocknote/core/fonts/inter.css";
import {
  useCreateBlockNote,
  getDefaultReactSlashMenuItems,
  BlockNoteViewRaw,
  SuggestionMenuController,
} from "@blocknote/react";
import "@blocknote/react/style.css";

// 導入圖標
import closeIcon from "../assets/icon/close-icon.svg";
import copyCodeIcon from "../assets/icon/copy-code.svg";
import editCodeIcon from "../assets/icon/edit-code.svg";

interface MarkdownCanvasProps {
  content: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (content: string) => void;
  onAskGpt?: (selectedText: string) => void;
}

const MarkdownCanvas: React.FC<MarkdownCanvasProps> = ({
  content,
  isOpen,
  onClose,
  onSave,
  onAskGpt,
}) => {
  // Create the editor instance with proper configuration
  const editor = useCreateBlockNote({
    // Providing a default block to avoid the "initialContent must be non-empty" error
    initialContent: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Loading...",
            styles: {}, // Add the required styles property
          },
        ],
      },
    ],
  });

  const [editMode, setEditMode] = useState(false);
  const [rawMarkdown, setRawMarkdown] = useState("");
  const [isRawView, setIsRawView] = useState(false);
  const [loadingEditor, setLoadingEditor] = useState(true);

  // Other existing states
  const canvasRef = useRef<HTMLDivElement>(null);
  const rawEditorRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState("Code Editor");
  const [codeLanguage, setCodeLanguage] = useState("plaintext");
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [contentFullyLoaded, setContentFullyLoaded] = useState(false);
  const [shouldGenerateTitle, setShouldGenerateTitle] = useState(false);
  const [hasClosingBackticks, setHasClosingBackticks] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);

  // Text selection state
  const [showSelectionPopup, setShowSelectionPopup] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });

  // 檢測是否存在結束標記（用於檢測完整代碼塊）
  const hasEndingBackticks = useCallback((text: string): boolean => {
    // 分析文本是否有結束的```
    const lines = text.split("\n");
    // 找到第一個```之後，再找是否有另一個```
    let foundFirst = false;

    for (const line of lines) {
      if (!foundFirst && line.trim().startsWith("```")) {
        foundFirst = true;
        continue;
      }

      if (foundFirst && line.trim() === "```") {
        return true;
      }
    }

    return false;
  }, []);

  // Toggle editor editability when edit mode changes
  useEffect(() => {
    if (editor) {
      // In newer versions of BlockNote, editable is a property not a method
      // We need to recreate the editor with new options
      editor._tiptapEditor.setEditable(editMode);
    }
  }, [editMode, editor]);

  // Convert code to BlockNote format and update editor
  useEffect(() => {
    setLoadingEditor(true);

    // Try to extract language from code block
    const languageMatch = content.match(/^```([^\s\n]+)/);
    if (languageMatch && languageMatch[1]) {
      setCodeLanguage(languageMatch[1]);
    } else {
      setCodeLanguage("plaintext");
    }

    // 檢查內容是否有結束的```標記
    const hasClosing = hasEndingBackticks(content);
    setHasClosingBackticks(hasClosing);

    // Clean the content by removing markdown code fence markers
    let cleanContent = content;
    cleanContent = cleanContent.replace(/^```[\w-]*\s*\n/m, "");
    // 檢查是否以```結束並去除
    if (cleanContent.includes("\n```")) {
      cleanContent = cleanContent.replace(/\n```\s*$/m, "");
    }

    // Update raw markdown for raw view mode
    setRawMarkdown(cleanContent);

    // Update BlockNote editor content
    const importMarkdown = async () => {
      try {
        // Prepare markdown with proper code fence
        const markdownContent = `\`\`\`${codeLanguage}\n${cleanContent}\n\`\`\``;

        // Convert markdown to BlockNote blocks
        const blocks = await editor.tryParseMarkdownToBlocks(markdownContent);

        // Make sure we have valid blocks before replacing
        if (blocks && blocks.length > 0) {
          editor.replaceBlocks(editor.document, blocks);
        }

        setContentFullyLoaded(true);

        // 當有結束標記時才生成標題
        setShouldGenerateTitle(hasClosing);
      } catch (error) {
        console.error("Error parsing markdown to blocks:", error);
      } finally {
        setLoadingEditor(false);
      }
    };

    importMarkdown();
  }, [content, editor, codeLanguage, hasEndingBackticks]);

  // Reset copy success message after 2 seconds
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (copySuccess) {
      timeout = setTimeout(() => {
        setCopySuccess(false);
      }, 2000);
    }
    return () => clearTimeout(timeout);
  }, [copySuccess]);

  // Capture the scroll position when the editor is opened
  useEffect(() => {
    if (isOpen) {
      // Store the current scroll position
      setScrollPosition(window.scrollY || document.documentElement.scrollTop);
      // 只有當程式碼區塊完整時（有結束標記）才生成標題
      setShouldGenerateTitle(hasClosingBackticks);
    }
  }, [isOpen, hasClosingBackticks]);

  // Restore the scroll position when editor state changes
  useEffect(() => {
    if (isOpen) {
      // Use a small timeout to ensure the DOM has updated
      const timer = setTimeout(() => {
        window.scrollTo(0, scrollPosition);
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [isOpen, editMode, scrollPosition]);

  // Listen for selection changes in the editor
  useEffect(() => {
    const handleSelection = () => {
      if (isRawView || editMode) return;

      const selection = window.getSelection();
      // Check if there's a text selection
      if (selection && !selection.isCollapsed && selection.toString().trim() !== "") {
        const selectedContent = selection.toString();
        setSelectedText(selectedContent);

        // Calculate position for the popup
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        setPopupPosition({
          top: rect.bottom + window.scrollY + 5,
          left: rect.left + window.scrollX + rect.width / 2 - 40,
        });

        setShowSelectionPopup(true);
      } else {
        setShowSelectionPopup(false);
      }
    };

    // Handle mouse up events for selection
    const handleMouseUp = () => {
      handleSelection();
    };

    document.addEventListener("mouseup", handleMouseUp);

    // Create a mutation observer to watch for selection changes
    const selectionObserver = new MutationObserver(() => {
      handleSelection();
    });

    // Observe the editor container
    const editorContainer = document.querySelector(".bn-container");
    if (editorContainer) {
      selectionObserver.observe(editorContainer, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    return () => {
      selectionObserver.disconnect();
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [editor, isRawView, editMode]);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (previewRef.current && !previewRef.current.contains(event.target as Node)) {
        setShowSelectionPopup(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Get clean code content from the editor
  const getCleanCodeContent = useCallback(async (): Promise<string> => {
    if (isRawView) {
      return rawMarkdown;
    }

    try {
      const markdown = await editor.blocksToMarkdownLossy(editor.document);
      // Remove markdown fence if present
      let cleanContent = markdown;
      cleanContent = cleanContent.replace(/^```[\w-]*\s*\n/m, "");
      if (cleanContent.includes("\n```")) {
        cleanContent = cleanContent.replace(/\n```\s*$/m, "");
      }
      return cleanContent;
    } catch (error) {
      console.error("Error converting blocks to markdown:", error);
      return rawMarkdown;
    }
  }, [editor, isRawView, rawMarkdown]);

  // Toggle edit mode
  const handleEdit = () => {
    setEditMode(true);
  };

  // Save changes
  const handleSave = async () => {
    let contentToSave;

    if (isRawView) {
      contentToSave = rawMarkdown;

      // Update the BlockNote editor content from raw markdown
      try {
        const markdownContent = `\`\`\`${codeLanguage}\n${rawMarkdown}\n\`\`\``;
        const blocks = await editor.tryParseMarkdownToBlocks(markdownContent);
        editor.replaceBlocks(editor.document, blocks);
      } catch (error) {
        console.error("Error updating editor content:", error);
      }
    } else {
      contentToSave = await getCleanCodeContent();
    }

    onSave(contentToSave);
    setEditMode(false);

    // 檢查儲存的內容是否有完整的代碼塊（開始和結束標記）
    const hasEndingMarker = hasEndingBackticks(`\`\`\`${codeLanguage}\n${contentToSave}\n\`\`\``);
    setShouldGenerateTitle(hasEndingMarker);
    setHasClosingBackticks(hasEndingMarker);
  };

  // Cancel edit
  const handleCancel = () => {
    setIsRawView(false);
    setEditMode(false);

    // Reset editor content to original
    const importOriginalMarkdown = async () => {
      try {
        const cleanContent = content.replace(/^```[\w-]*\s*\n/m, "").replace(/\n```\s*$/m, "");
        const markdownContent = `\`\`\`${codeLanguage}\n${cleanContent}\n\`\`\``;
        const blocks = await editor.tryParseMarkdownToBlocks(markdownContent);
        editor.replaceBlocks(editor.document, blocks);
      } catch (error) {
        console.error("Error resetting editor content:", error);
      }
    };

    importOriginalMarkdown();
  };

  // Handle raw markdown changes in textarea
  const handleRawMarkdownChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setRawMarkdown(newContent);

    // 檢查原始編輯模式中是否有完整的代碼塊
    // 我們將原始文本包裝在代碼標記中進行檢查
    const wrappedContent = `\`\`\`${codeLanguage}\n${newContent}\n\`\`\``;
    const hasClosing = hasEndingBackticks(wrappedContent);
    setHasClosingBackticks(hasClosing);
  };

  // Copy code to clipboard
  const handleCopyCode = async () => {
    const cleanContent = await getCleanCodeContent();

    navigator.clipboard.writeText(cleanContent).then(
      () => {
        setCopySuccess(true);
      },
      () => {
        console.error("Failed to copy code");
      },
    );
  };

  // Handle "Ask GPT" button click
  const handleAskGpt = (text: string) => {
    if (onAskGpt) {
      onAskGpt(text);
      setShowSelectionPopup(false);
    }
  };

  // Toggle raw view
  const toggleRawView = () => {
    if (!isRawView) {
      // Get current content as markdown before switching to raw view
      editor.blocksToMarkdownLossy(editor.document).then((markdown) => {
        let cleanContent = markdown;
        cleanContent = cleanContent.replace(/^```[\w-]*\s*\n/m, "");
        if (cleanContent.includes("\n```")) {
          cleanContent = cleanContent.replace(/\n```\s*$/m, "");
        }
        setRawMarkdown(cleanContent);
        setIsRawView(true);
      });
    } else {
      setIsRawView(false);

      // Update the editor with the raw markdown
      const updateFromRaw = async () => {
        try {
          const markdownContent = `\`\`\`${codeLanguage}\n${rawMarkdown}\n\`\`\``;
          const blocks = await editor.tryParseMarkdownToBlocks(markdownContent);
          editor.replaceBlocks(editor.document, blocks);

          // 檢查轉換後的內容是否有完整代碼塊
          const hasClosing = hasEndingBackticks(markdownContent);
          setHasClosingBackticks(hasClosing);
        } catch (error) {
          console.error("Error updating from raw markdown:", error);
        }
      };

      updateFromRaw();
    }
  };

  // Generate title for the code snippet
  const generateTitle = useCallback(async () => {
    // 只有當編輯器載入完成且代碼塊完整時才生成標題
    if (loadingEditor || !hasClosingBackticks) return;

    const cleanContent = await getCleanCodeContent();
    if (!cleanContent.trim()) return;

    setIsGeneratingTitle(true);
    console.log("Generating title via Chat Completion API");

    try {
      // Default settings for the API call with specific model for title generation
      const settings = getDefaultModelSettings("gpt-4o-mini");

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
          content: `Given this code snippet, provide a short, descriptive title (3-5 words) that describes what the code does. Don't include words like "code", "function", "class", etc. Just give the title directly:\n\n${cleanContent}`,
          timestamp: new Date(),
        },
      ];

      let generatedTitle = "";
      await chatCompletion(messages, settings, (token) => {
        generatedTitle += token;
      });

      // Clean up the title (remove quotes if present)
      generatedTitle = generatedTitle.replace(/^["']|["']$/g, "").trim();
      if (generatedTitle) {
        setTitle(generatedTitle);
      }
    } catch (error) {
      console.error("Error generating title:", error);
    } finally {
      setIsGeneratingTitle(false);
      setShouldGenerateTitle(false);
    }
  }, [getCleanCodeContent, loadingEditor, hasClosingBackticks]);

  // Effect for title generation based on shouldGenerateTitle flag
  useEffect(() => {
    if (
      shouldGenerateTitle &&
      contentFullyLoaded &&
      isOpen &&
      !isGeneratingTitle &&
      !loadingEditor &&
      hasClosingBackticks // 只有當有結束標記時才生成標題
    ) {
      const titleTimer = setTimeout(() => {
        generateTitle();
      }, 100);
      return () => clearTimeout(titleTimer);
    }
  }, [
    shouldGenerateTitle,
    contentFullyLoaded,
    isOpen,
    isGeneratingTitle,
    generateTitle,
    loadingEditor,
    hasClosingBackticks,
  ]);

  // Manual title generation function
  const handleManualGenerateTitle = () => {
    if (hasClosingBackticks) {
      setShouldGenerateTitle(true);
    } else {
      console.log("無法生成標題：代碼塊不完整（缺少結束標記```）");
      // 可以選擇顯示通知給用戶，告知需要完整的代碼塊
    }
  };

  // Handle close button click
  const handleClose = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className='markdown-canvas' ref={canvasRef}>
      <div className='markdown-header'>
        <div style={{ display: "flex", alignItems: "center" }}>
          <button onClick={handleClose} title='Close editor' className='close-button'>
            <img src={closeIcon} alt='Close' width='24' height='24' />
          </button>
          <h3>{title}</h3>
          <div className='language-badge'>{codeLanguage !== "plaintext" && codeLanguage}</div>
          <button
            onClick={handleManualGenerateTitle}
            disabled={isGeneratingTitle || !hasClosingBackticks}
            className='title-button'
            title={!hasClosingBackticks ? "需要完整的代碼塊（有結束標記```）才能生成標題" : ""}
          >
            {isGeneratingTitle ? "生成中..." : "AI 標題"}
          </button>
          <button onClick={toggleRawView} className='title-button' style={{ marginLeft: "8px" }}>
            {isRawView ? "保存" : "編輯"}
          </button>
        </div>
        <div className='markdown-controls'>
          <button
            onClick={handleCopyCode}
            className={`icon-button ${copySuccess ? "success" : ""}`}
            title={copySuccess ? "已複製！" : "複製代碼"}
          >
            <img src={copyCodeIcon} alt='Copy' width='24' height='24' />
          </button>
          {!editMode ? (
            <button onClick={handleEdit} className='icon-button' title='編輯代碼'>
              <img src={editCodeIcon} alt='Edit' width='24' height='24' />
            </button>
          ) : (
            <>
              <button onClick={handleSave} className='action-button'>
                保存
              </button>
              <button onClick={handleCancel} className='action-button'>
                取消
              </button>
            </>
          )}
        </div>
      </div>

      <div className='markdown-content'>
        {loadingEditor ? (
          <div className='loading-editor'>載入編輯器中...</div>
        ) : isRawView ? (
          <textarea
            ref={rawEditorRef}
            value={rawMarkdown}
            onChange={handleRawMarkdownChange}
            className='markdown-editor'
            wrap='off'
          />
        ) : (
          <div className='blocknote-container' ref={previewRef} style={{ height: "100%" }}>
            {/* Using BlockNoteViewRaw with proper configuration */}
            <BlockNoteViewRaw editor={editor} theme='dark' editable={editMode}>
              <SuggestionMenuController
                triggerCharacter='/'
                getItems={async () => getDefaultReactSlashMenuItems(editor)}
              />
            </BlockNoteViewRaw>

            {showSelectionPopup && (
              <SelectionPopup
                position={popupPosition}
                selectedText={selectedText}
                onAskGpt={handleAskGpt}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MarkdownCanvas;
