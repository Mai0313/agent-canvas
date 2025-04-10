export const containsMarkdown = (text: string): boolean => {
  // Basic detection of markdown-like content
  const markdownPatterns = [
    /^#+\s+.+$/m, // Headers
    /\*\*.+\*\*/,  // Bold
    /\*.+\*/,      // Italic
    /^>\s+.+$/m,   // Blockquotes
    /^```[\s\S]*?```$/m, // Code blocks
    /^\s*[-*+]\s+.+$/m, // Lists
    /^\s*\d+\.\s+.+$/m, // Numbered lists
    /\[.+\]\(.+\)/,   // Links
    /!\[.+\]\(.+\)/,  // Images
    /^[\s-]{3,}$/m    // Horizontal rules
  ];

  return markdownPatterns.some(pattern => pattern.test(text));
};
