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
  lineCount: number;
} => {
  // Find all code blocks using a more compatible approach than matchAll
  const codeBlockRegex = /```[\s\S]*?```/g;
  const matches: Array<{ text: string; index: number; lineCount: number }> = [];

  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Count the number of lines in this code block
    const lineCount = (match[0].match(/\n/g) || []).length;

    matches.push({
      text: match[0],
      index: match.index,
      lineCount: lineCount,
    });
  }

  if (matches.length === 0) {
    return { longestBlock: "", blockPosition: null, lineCount: 0 };
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
    lineCount: longestMatch.lineCount,
  };
};

// New function to find the first code block with more than 5 lines
export const findLongCodeBlock = (
  text: string,
  minLines: number = 5,
): {
  codeBlock: string;
  blockPosition: { start: number; end: number } | null;
  lineCount: number;
} => {
  // Find all code blocks
  const codeBlockRegex = /```[\s\S]*?```/g;

  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Count the number of lines in this code block
    const lineCount = (match[0].match(/\n/g) || []).length;

    // If this code block has more than minLines lines, return it
    if (lineCount >= minLines) {
      const start = match.index;
      const end = start + match[0].length;

      return {
        codeBlock: match[0],
        blockPosition: { start, end },
        lineCount: lineCount,
      };
    }
  }

  // If no code block with > minLines lines is found, return empty
  return {
    codeBlock: "",
    blockPosition: null,
    lineCount: 0,
  };
};

// Function to detect an in-progress code block and check if it has more than minLines
export const detectInProgressCodeBlock = (
  text: string,
  minLines: number = 5,
): {
  codeBlock: string;
  blockPosition: { start: number; end: number } | null;
  lineCount: number;
} => {
  // Find the last occurrence of code block start marker
  const lastBlockStartIndex = text.lastIndexOf("```");

  if (lastBlockStartIndex === -1) {
    return { codeBlock: "", blockPosition: null, lineCount: 0 };
  }

  // Check if there's a closing marker after this opening
  const textAfterLastOpen = text.substring(lastBlockStartIndex);
  const hasClosingMarker = textAfterLastOpen.indexOf("```", 3) !== -1;

  // If there is a closing marker, this block is complete, not in-progress
  if (hasClosingMarker) {
    return { codeBlock: "", blockPosition: null, lineCount: 0 };
  }

  // Count lines in this in-progress code block
  const inProgressBlock = textAfterLastOpen;
  const lineCount = (inProgressBlock.match(/\n/g) || []).length;

  // If the line count is >= minLines, return this block
  if (lineCount >= minLines) {
    return {
      codeBlock: inProgressBlock,
      blockPosition: { start: lastBlockStartIndex, end: text.length },
      lineCount: lineCount,
    };
  }

  return { codeBlock: "", blockPosition: null, lineCount: 0 };
};
