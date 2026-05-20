/**
 * Text utilities for processing and formatting text
 */

/**
 * Removes all markdown code blocks (triple backticks) from a string
 * and returns the cleaned content.
 * 
 * This function specifically handles triple backticks (```) and excludes
 * single backticks (`) which are used for inline code.
 * 
 * This function handles both:
 * 1. Code blocks with language specifiers: ```javascript ... ```
 * 2. Code blocks without language specifiers: ``` ... ```
 * 
 * @param content The string content containing code blocks
 * @returns The content with code blocks' backticks removed but the code preserved
 */
export function removeMarkdownCodeBlocks(content: string): string {
  if (!content) return content;
  
  // Replace code blocks with language specifier: ```javascript\n... ```
  // Ensure we only match triple backticks, not single backticks
  let result = content.replace(/```[\w-]*\n([\s\S]*?)```/g, (_, code) => code);
  
  // Replace code blocks without language specifier: ```\n... ```
  result = result.replace(/```\n([\s\S]*?)```/g, (_, code) => code);
  
  // Handle edge case where language specifier and code are on the same line: ```javascript code```
  result = result.replace(/```([\w-]+)\s+([\s\S]*?)```/g, (_, lang, code) => code);
  
  // Replace any stray triple backticks (in case the regex missed some)
  result = result.replace(/^```[\w-]*$/gm, '').replace(/^```$/gm, '');
  
  return result.trim();
}

/**
 * Cleans up AI response content by:
 * 1. Removing triple backticks from code blocks while preserving the code
 * 2. Trimming whitespace
 * 3. Normalizing line endings
 * 
 * @param content The AI response content to clean
 * @returns The cleaned content
 */
export function cleanAIResponse(content: string): string {
  if (!content) return content;
  
  try {
    // Remove code blocks formatting
    let result = removeMarkdownCodeBlocks(content);
    
    // Normalize line endings
    result = result.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    return result.trim();
  } catch (error) {
    console.error('Error cleaning AI response:', error);
    // If there's an error, return the original content as a fallback
    return content;
  }
}

/**
 * Checks if a string contains markdown code blocks (triple backticks)
 * 
 * This function specifically looks for triple backticks (```) and excludes
 * single backticks (`) which are used for inline code.
 * 
 * @param content The string content to check
 * @returns boolean True if the content contains code blocks
 */
export function containsMarkdownCodeBlocks(content: string): boolean {
  if (!content) return false;
  
  // Check for proper code blocks (triple backticks with newlines)
  // This excludes inline code (single backticks) which don't have newlines
  // More specific patterns to ensure we only match triple backticks
  // Each pattern must start and end with exactly three backticks
  return /```[\w-]*\n[\s\S]*?```/g.test(content) || 
         /```\n[\s\S]*?```/g.test(content) ||
         /```[\w-]+\s+[\s\S]*?```/g.test(content);
}

/**
 * Identifies incomplete code pointer blocks where the start tag exists but not the end tag
 * 
 * @param content The content to check for incomplete code blocks
 * @returns An array of objects containing info about incomplete blocks (filename and startIndex)
 */
export function findIncompleteCodeBlocks(content: string): Array<{filename: string, startIndex: number, partialCode: string}> {
  if (!content) return [];
  
  const incompleteBlocks: Array<{filename: string, startIndex: number, partialCode: string}> = [];
  const startTagRegex = /Pointer:Code\+(.*?):start\s*([\s\S]*?)(?=(Pointer:Code\+\1:end|$))/g;
  
  let match;
  while ((match = startTagRegex.exec(content)) !== null) {
    const [fullMatch, filename, partialCode] = match;
    const endTagExists = content.includes(`Pointer:Code+${filename}:end`);
    
    if (!endTagExists) {
      incompleteBlocks.push({
        filename: filename.trim(),
        startIndex: match.index,
        partialCode: partialCode.trim()
      });
    }
  }
  
  return incompleteBlocks;
}

/**
 * Extracts the language from a filename based on its extension
 * 
 * @param filename The filename to extract language from
 * @returns The language identifier for syntax highlighting
 */
export function getLanguageFromFilename(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  
  // Map common file extensions to language identifiers
  const extensionToLanguage: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'jsx',
    'ts': 'typescript',
    'tsx': 'tsx',
    'py': 'python',
    'rb': 'ruby',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'cs': 'csharp',
    'go': 'go',
    'rs': 'rust',
    'php': 'php',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'json': 'json',
    'md': 'markdown',
    'sql': 'sql',
    'sh': 'bash',
    'bash': 'bash',
    'yaml': 'yaml',
    'yml': 'yaml',
    'xml': 'xml',
    'swift': 'swift',
    'kt': 'kotlin',
  };
  
  return extensionToLanguage[extension] || extension || 'plaintext';
}

/**
 * Utility functions for text processing
 */

/**
 * Remove <think> and </think> tags and their content from text
 * @param text - The text to clean
 * @returns The text with thinking blocks removed
 */
export const stripThinkTags = (text: string): string => {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
};

/**
 * Extract code blocks with filenames from message content, excluding those in thinking blocks
 * @param content - The message content to parse
 * @returns Array of code blocks with language, filename, content, and optional line range for editing
 */
export const extractCodeBlocks = (content: string) => {
  const codeBlocks: {
    language: string;
    filename: string;
    content: string;
    startLine?: number;
    endLine?: number;
    isLineEdit?: boolean;
  }[] = [];

  if (!content || typeof content !== 'string') {
    return codeBlocks;
  }

  const thinkBlocks: Array<{start: number; end: number}> = [];
  let searchStart = 0;

  while (searchStart < content.length) {
    const thinkStartIndex = content.indexOf('<think>', searchStart);
    if (thinkStartIndex === -1) break;

    const thinkEndIndex = content.indexOf('</think>', thinkStartIndex);
    if (thinkEndIndex === -1) {
      thinkBlocks.push({
        start: thinkStartIndex,
        end: content.length
      });
      break;
    } else {
      thinkBlocks.push({
        start: thinkStartIndex,
        end: thinkEndIndex + 8
      });
      searchStart = thinkEndIndex + 8;
    }
  }

  const isInThinkBlock = (position: number) => {
    return thinkBlocks.some(block => position >= block.start && position <= block.end);
  };

  const parseCodeFenceHeader = (header: string) => {
    const result = {
      language: '',
      filename: '',
      startLine: undefined as number | undefined,
      endLine: undefined as number | undefined,
      isLineEdit: false,
    };

    if (!header) return result;

    const trimmedHeader = header.trim();
    const windowsPathOnly = trimmedHeader.match(/^[A-Za-z]:[\\/].+$/);
    if (windowsPathOnly) {
      result.filename = windowsPathOnly[0];
      return result;
    }

    const windowsLangPath = trimmedHeader.match(/^([\w-]+):([A-Za-z]:[\\/].+)$/);
    if (windowsLangPath) {
      result.language = windowsLangPath[1];
      result.filename = windowsLangPath[2];
      return result;
    }

    const parts = trimmedHeader.split(':').map(part => part.trim()).filter(Boolean);
    if (parts.length >= 3 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1])) {
      result.startLine = parseInt(parts[0], 10);
      result.endLine = parseInt(parts[1], 10);
      result.filename = parts.slice(2).join(':');
      result.isLineEdit = true;
      return result;
    }

    if (parts.length >= 4 && /^\d+$/.test(parts[1]) && /^\d+$/.test(parts[2])) {
      result.language = parts[0];
      result.startLine = parseInt(parts[1], 10);
      result.endLine = parseInt(parts[2], 10);
      result.filename = parts.slice(3).join(':');
      result.isLineEdit = true;
      return result;
    }

    const lastPart = parts[parts.length - 1] || '';
    if (lastPart && (/\.[a-zA-Z0-9]+$/.test(lastPart) || lastPart.includes('/') || lastPart.includes('\\'))) {
      result.filename = lastPart;
      result.language = parts.slice(0, -1).join(':');
      return result;
    }

    if (parts.length === 1) {
      if (/\.[a-zA-Z0-9]+$/.test(parts[0]) || parts[0].includes('/') || parts[0].includes('\\')) {
        result.filename = parts[0];
      } else {
        result.language = parts[0];
      }
      return result;
    }

    result.language = parts.join(':');
    return result;
  };

  const pointerRegex = /Pointer:Code\+(.+?):start\s*([\s\S]*?)\s*Pointer:Code\+\1:end/g;
  let pointerMatch;
  while ((pointerMatch = pointerRegex.exec(content)) !== null) {
    const filename = pointerMatch[1].trim();
    const code = pointerMatch[2].trim();
    if (filename && code) {
      codeBlocks.push({
        language: '',
        filename,
        content: stripThinkTags(code)
      });
    }
  }

  const codeBlockRegex = /```([^\n]*)\n([\s\S]*?)```/g;
  let match;
  let iterationCount = 0;
  const maxIterations = 200;

  while ((match = codeBlockRegex.exec(content)) !== null && iterationCount < maxIterations) {
    iterationCount++;

    const [fullMatch, header, code] = match;
    const matchStart = match.index;
    if (isInThinkBlock(matchStart)) continue;

    const { language, filename, startLine, endLine, isLineEdit } = parseCodeFenceHeader(header || '');
    let cleanedCode = code.trim();
    let finalFilename = filename;
    let finalLanguage = language;
    let finalStartLine = startLine;
    let finalEndLine = endLine;
    let finalIsLineEdit = isLineEdit;

    if (!finalFilename) {
      const lines = cleanedCode.split('\n');
      const firstLine = lines[0]?.trim() || '';
      const commentPatterns = [
        /^<!--\s*([^\n]+?\.[a-zA-Z0-9]+)\s*-->/,
        /^\/\/\s*([^\n]+?\.[a-zA-Z0-9]+)\s*$/,
        /^#\s*([^\n]+?\.[a-zA-Z0-9]+)\s*$/,
        /^\/\*\s*([^\n]+?\.[a-zA-Z0-9]+)\s*\*\//,
        /^--\s*([^\n]+?\.[a-zA-Z0-9]+)\s*$/,
        /^%\s*([^\n]+?\.[a-zA-Z0-9]+)\s*$/,
        /^;\s*([^\n]+?\.[a-zA-Z0-9]+)\s*$/,
        /^(?:\/\/|#|\/\*|--)\s*(?:filename|file|path):\s*([^\s\n]+)/i,
        /^(?:\/\/|#|\/\*|--)\s*@file:\s*([^\s\n]+)/i,
      ];

      for (const pattern of commentPatterns) {
        const commentMatch = firstLine.match(pattern);
        if (commentMatch && commentMatch[1]) {
          const potentialPath = commentMatch[1].trim();
          if (potentialPath.includes('.') && !potentialPath.includes(' ')) {
            finalFilename = potentialPath;
            cleanedCode = lines.slice(1).join('\n').trim();
            break;
          }
        }
      }
    }

    if (!finalFilename) {
      const hint = header.trim();
      if (hint && (/\.[a-zA-Z0-9]+$/.test(hint) || hint.includes('/') || hint.includes('\\'))) {
        finalFilename = hint;
      }
    }

    if (!finalFilename) {
      const languageToExtension: Record<string, string> = {
        python: 'py',
        javascript: 'js',
        typescript: 'ts',
        tsx: 'tsx',
        jsx: 'jsx',
        html: 'html',
        css: 'css',
        bash: 'sh',
        shell: 'sh',
        json: 'json',
        markdown: 'md',
        md: 'md',
        ruby: 'rb',
        java: 'java',
        cpp: 'cpp',
        c: 'c',
        go: 'go',
        rust: 'rs',
        php: 'php',
        xml: 'xml',
        yaml: 'yaml',
        yml: 'yml',
        swift: 'swift',
        kotlin: 'kt',
        sql: 'sql',
      };

      const extension = languageToExtension[finalLanguage.toLowerCase()] || '';
      finalFilename = extension ? `new_file.${extension}` : 'new_file.txt';
    }

    if (finalFilename && cleanedCode) {
      const finalCode = stripThinkTags(cleanedCode).trim();
      if (finalCode) {
        codeBlocks.push({
          language: finalLanguage,
          filename: finalFilename,
          content: finalCode,
          ...(finalIsLineEdit && { startLine: finalStartLine, endLine: finalEndLine, isLineEdit: true })
        });
      }
    }
  }

  if (iterationCount >= maxIterations) {
    console.warn(`extractCodeBlocks: Hit iteration limit (${maxIterations}), stopping extraction`);
  }

  return codeBlocks;
};
