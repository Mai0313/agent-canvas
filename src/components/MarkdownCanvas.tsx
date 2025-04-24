import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { ChatCompletion } from "../services/openai";
import { Message } from "../types";
import { getDefaultModelSettings } from "../utils/modelUtils";
import { Components } from "react-markdown";

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
  const [copySuccess, setCopySuccess] = useState(false);
  const [contentFullyLoaded, setContentFullyLoaded] = useState(false);
  const [shouldGenerateTitle, setShouldGenerateTitle] = useState(false);

  // Extract language from code block
  const [codeLanguage, setCodeLanguage] = useState<string>("plaintext");

  // Store scroll position of the parent container
  const [scrollPosition, setScrollPosition] = useState(0);

  // Update content when it changes
  useEffect(() => {
    setEditableContent(content);
    setTitle("Code Editor"); // Reset title on content change
    setContentFullyLoaded(false);

    // Try to extract language from code block - match from the beginning of the content
    // to handle streaming content properly
    const languageMatch = content.match(/^```([^\s\n]+)/);
    if (languageMatch && languageMatch[1]) {
      setCodeLanguage(languageMatch[1]);
    } else {
      setCodeLanguage("plaintext");
    }

    // Set a delay to ensure all code blocks are fully processed
    const fullLoadTimer = setTimeout(() => {
      setContentFullyLoaded(true);
      // Flag that we should generate a new title
      setShouldGenerateTitle(true);
    }, 300);

    return () => clearTimeout(fullLoadTimer);
  }, [content]);

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
      // Each time the editor opens, we should generate a new title
      setShouldGenerateTitle(true);
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

  // Adjust textarea height on resize
  useEffect(() => {
    const handleResize = () => {
      if (textareaRef.current && canvasRef.current) {
        const headerHeight =
          canvasRef.current.querySelector(".markdown-header")?.clientHeight ||
          0;
        const containerHeight = canvasRef.current.clientHeight;
        textareaRef.current.style.height = `${containerHeight - headerHeight - 10}px`;
      }
    };

    // Set initial size
    handleResize();

    // Add resize event listener
    window.addEventListener("resize", handleResize);

    // Create a MutationObserver to watch for changes in parent container size
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    if (canvasRef.current) {
      resizeObserver.observe(canvasRef.current);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
    };
  }, [isOpen, editMode]);

  // Get clean code content (without markdown fence)
  const getCleanCodeContent = useCallback((): string => {
    // Clean the content by removing markdown code fence markers
    let cleanContent = editableContent;

    // Remove opening code fence with language identifier (```python, ```javascript, etc.)
    cleanContent = cleanContent.replace(/^```[\w-]*\s*\n/m, "");

    // Remove closing code fence - only if it exists and is at the end
    if (cleanContent.trim().endsWith("```")) {
      cleanContent = cleanContent.replace(/\n```\s*$/m, "");
    }

    return cleanContent;
  }, [editableContent]);

  const handleEdit = () => {
    setEditMode(true);
  };

  const handleSave = () => {
    onSave(editableContent);
    setEditMode(false);
    // Generate new title after saving edits
    setShouldGenerateTitle(true);
  };

  const handleCancel = () => {
    setEditableContent(content);
    setEditMode(false);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditableContent(e.target.value);

    // Try to extract language from code block as user types
    const languageMatch = e.target.value.match(/^```([^\s\n]+)/);
    if (languageMatch && languageMatch[1]) {
      setCodeLanguage(languageMatch[1]);
    }
  };

  const handleCopyCode = () => {
    const cleanContent = getCleanCodeContent();

    navigator.clipboard.writeText(cleanContent).then(
      () => {
        setCopySuccess(true);
      },
      () => {
        console.error("Failed to copy code");
      },
    );
  };

  // Wrap generateTitle in useCallback to memoize it
  const generateTitle = useCallback(async () => {
    if (!editableContent.trim()) return;

    setIsGeneratingTitle(true);
    console.log("Generating title via Chat Completion API");

    try {
      // Default settings for the API call with specific model for title generation
      const settings = getDefaultModelSettings("gpt-4o-mini");

      const messages: Message[] = [
        {
          id: "system-msg",
          role: "system",
          content:
            "You are an assistant that helps name code snippets concisely.",
          timestamp: new Date(),
        },
        {
          id: "user-msg",
          role: "user",
          content: `Given this code snippet, provide a short, descriptive title (3-5 words) that describes what the code does. Don't include words like "code", "function", "class", etc. Just give the title directly:\n\n${getCleanCodeContent()}`,
          timestamp: new Date(),
        },
      ];

      let generatedTitle = "";
      await ChatCompletion(messages, settings, (token) => {
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
      // Reset the flag after generation attempt
      setShouldGenerateTitle(false);
    }
  }, [editableContent, getCleanCodeContent]); // Add getCleanCodeContent as a dependency

  // Effect for title generation based on shouldGenerateTitle flag
  useEffect(() => {
    // Only attempt to generate a title when:
    // 1. The shouldGenerateTitle flag is true
    // 2. Content is fully loaded
    // 3. The canvas is open
    // 4. There is content to analyze
    // 5. We're not already generating a title
    if (
      shouldGenerateTitle &&
      contentFullyLoaded &&
      isOpen &&
      editableContent.trim() &&
      !isGeneratingTitle
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
    editableContent,
    isGeneratingTitle,
    generateTitle,
  ]);

  // Handle close button click
  const handleClose = () => {
    onClose();
  };

  // For wheel handling in preview mode
  const previewRef = useRef<HTMLDivElement>(null);
  const handleWheel = (event: React.WheelEvent) => {
    const element = editMode ? textareaRef.current : previewRef.current;
    if (!element) return;

    const { scrollTop, scrollHeight, clientHeight } = element;
    const isAtTop = scrollTop === 0;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;

    // If we're at the boundaries, let the event propagate to the parent
    if ((isAtTop && event.deltaY < 0) || (isAtBottom && event.deltaY > 0)) {
      return; // Let parent handle it
    } else {
      // Otherwise prevent propagation to allow scrolling within the element
      event.stopPropagation();
    }
  };

  // Prepare markdown content for react-markdown
  const prepareMarkdownContent = (): string => {
    const cleanContent = getCleanCodeContent();
    // Make sure there's no trailing backticks that could be misinterpreted
    const safeContent = cleanContent.replace(/```\s*$/g, "");

    // Ensure we have proper opening and closing markers
    // This prevents react-markdown from misinterpreting markers
    return `\`\`\`${codeLanguage}\n${safeContent}${!safeContent.endsWith("\n") ? "\n" : ""}\`\`\``;
  };

  if (!isOpen) return null;

  // Define component mapping for ReactMarkdown
  const components: Components = {
    code({ className, children, ...rest }) {
      // Extract language from class name
      const match = /language-(\w+)/.exec(className || "");
      const language = match ? match[1] : "text";
      let codeString = String(children).replace(/\n$/, "");

      // Remove any triple backticks that might have been included incorrectly
      codeString = codeString.replace(/```/g, "");

      return !className?.includes("inline") ? (
        <div className='code-block-container'>
          <SyntaxHighlighter
            style={vscDarkPlus as any}
            language={language}
            wrapLines={false}
            wrapLongLines={false}
            customStyle={{
              margin: 0,
              padding: "16px",
              borderRadius: "6px",
              overflow: "auto",
              maxWidth: "100%",
            }}
          >
            {codeString}
          </SyntaxHighlighter>
        </div>
      ) : (
        <code className={className} {...rest}>
          {children}
        </code>
      );
    },
  };

  return (
    <div className='markdown-canvas' ref={canvasRef}>
      <div className='markdown-header'>
        <div style={{ display: "flex", alignItems: "center" }}>
          <button
            onClick={handleClose}
            title='Close editor'
            className='close-button'
          >
            <svg
              width='24'
              height='24'
              viewBox='0 0 24 24'
              fill='none'
              xmlns='http://www.w3.org/2000/svg'
            >
              <path
                fillRule='evenodd'
                clipRule='evenodd'
                d='M5.63603 5.63604C6.02656 5.24552 6.65972 5.24552 7.05025 5.63604L12 10.5858L16.9497 5.63604C17.3403 5.24552 17.9734 5.24552 18.364 5.63604C18.7545 6.02657 18.7545 6.65973 18.364 7.05025L13.4142 12L18.364 16.9497C18.7545 17.3403 18.7545 17.9734 18.364 18.364C17.9734 18.7545 17.3403 18.7545 16.9497 18.364L12 13.4142L7.05025 18.364C6.65972 18.7545 6.02656 18.7545 5.63603 18.364C5.24551 17.9734 5.24551 17.3403 5.63603 16.9497L10.5858 12L5.63603 7.05025C5.24551 6.65973 5.24551 6.02657 5.63603 5.63604Z'
                fill='currentColor'
              ></path>
            </svg>
          </button>
          <h3>{title}</h3>
          <div className='language-badge'>
            {codeLanguage !== "plaintext" && codeLanguage}
          </div>
          <button
            onClick={() => setShouldGenerateTitle(true)}
            disabled={isGeneratingTitle}
            className='title-button'
          >
            {isGeneratingTitle ? "Generating..." : "AI Title"}
          </button>
        </div>
        <div className='markdown-controls'>
          <button
            onClick={handleCopyCode}
            className={`icon-button ${copySuccess ? "success" : ""}`}
            title={copySuccess ? "Copied!" : "Copy code"}
          >
            <svg
              width='24'
              height='24'
              viewBox='0 0 24 24'
              fill='none'
              xmlns='http://www.w3.org/2000/svg'
            >
              <path
                fillRule='evenodd'
                clipRule='evenodd'
                d='M7 5C7 3.34315 8.34315 2 10 2H19C20.6569 2 22 3.34315 22 5V14C22 15.6569 20.6569 17 19 17H17V19C17 20.6569 15.6569 22 14 22H5C3.34315 22 2 20.6569 2 19V10C2 8.34315 3.34315 7 5 7H7V5ZM9 7H14C15.6569 7 17 8.34315 17 10V15H19C19.5523 15 20 14.5523 20 14V5C20 4.44772 19.5523 4 19 4H10C9.44772 4 9 4.44772 9 5V7ZM5 9C4.44772 9 4 9.44772 4 10V19C4 19.5523 4.44772 20 5 20H14C14.5523 20 15 19.5523 15 19V10C15 9.44772 14.5523 9 14 9H5Z'
                fill='currentColor'
              ></path>
            </svg>
          </button>
          {!editMode ? (
            <button
              onClick={handleEdit}
              className='icon-button'
              title='Edit code'
            >
              <svg
                width='24'
                height='24'
                viewBox='0 0 24 24'
                fill='none'
                xmlns='http://www.w3.org/2000/svg'
              >
                <path
                  d='M5.66282 16.5231L5.18413 19.3952C5.12203 19.7678 5.09098 19.9541 5.14876 20.0888C5.19933 20.2067 5.29328 20.3007 5.41118 20.3512C5.54589 20.409 5.73218 20.378 6.10476 20.3159L8.97693 19.8372C9.72813 19.712 10.1037 19.6494 10.4542 19.521C10.7652 19.407 11.0608 19.2549 11.3343 19.068C11.6425 18.8575 11.9118 18.5882 12.4503 18.0497L20 10.5C21.3807 9.11929 21.3807 6.88071 20 5.5C18.6193 4.11929 16.3807 4.11929 15 5.5L7.45026 13.0497C6.91175 13.5882 6.6425 13.8575 6.43197 14.1657C6.24513 14.4392 6.09299 14.7348 5.97903 15.0458C5.85062 15.3963 5.78802 15.7719 5.66282 16.5231Z'
                  stroke='currentColor'
                  strokeWidth='2'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                ></path>
                <path
                  d='M14.5 7L18.5 11'
                  stroke='currentColor'
                  strokeWidth='2'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                ></path>
              </svg>
            </button>
          ) : (
            <>
              <button onClick={handleSave} className='action-button'>
                Save
              </button>
              <button onClick={handleCancel} className='action-button'>
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
      <div className='markdown-content'>
        {editMode ? (
          <textarea
            ref={textareaRef}
            value={editableContent}
            onChange={handleContentChange}
            className='markdown-editor'
            onWheel={handleWheel}
            wrap='off' // Disable line wrapping to allow horizontal scrolling
          />
        ) : (
          <div
            className='markdown-preview'
            ref={previewRef}
            onWheel={handleWheel}
          >
            <ReactMarkdown components={components}>
              {prepareMarkdownContent()}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarkdownCanvas;
