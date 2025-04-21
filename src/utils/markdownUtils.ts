export const containsMarkdown = (text: string): boolean => {
  // Basic detection of markdown-like content
  const markdownPatterns = [
    /^#+\s+.+$/m, // Headers
    /\*\*.+\*\*/, // Bold
    /\*.+\*/, // Italic
    /^>\s+.+$/m, // Blockquotes
    /^```[\s\S]*?```$/m, // Code blocks
    /^\s*[-*+]\s+.+$/m, // Lists
    /^\s*\d+\.\s+.+$/m, // Numbered lists
    /\[.+\]\(.+\)/, // Links
    /!\[.+\]\(.+\)/, // Images
    /^[\s-]{3,}$/m, // Horizontal rules
  ];

  return markdownPatterns.some((pattern) => pattern.test(text));
};

export const extractLongestCodeBlock = (
  text: string,
): {
  longestBlock: string;
  blockPosition: { start: number; end: number } | null;
} => {
  // Find all code blocks using a more compatible approach than matchAll
  const codeBlockRegex = /```[\s\S]*?```/g;
  const matches: Array<{ text: string; index: number }> = [];

  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    matches.push({
      text: match[0],
      index: match.index,
    });
  }

  if (matches.length === 0) {
    return { longestBlock: "", blockPosition: null };
  }

  // Find the longest code block
  let longestBlockIndex = 0;
  let maxLength = 0;

  matches.forEach((match, index) => {
    if (match.text.length > maxLength) {
      maxLength = match.text.length;
      longestBlockIndex = index;
    }
  });

  const longestMatch = matches[longestBlockIndex];
  const start = longestMatch.index;
  const end = start + longestMatch.text.length;

  return {
    longestBlock: longestMatch.text,
    blockPosition: { start, end },
  };
};
