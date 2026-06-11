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
 * Identifies incomplete code shadowide blocks where the start tag exists but not the end tag
 * 
 * @param content The content to check for incomplete code blocks
 * @returns An array of objects containing info about incomplete blocks (filename and startIndex)
 */
export function findIncompleteCodeBlocks(content: string): Array<{filename: string, startIndex: number, partialCode: string}> {
  if (!content) return [];
  
  const incompleteBlocks: Array<{filename: string, startIndex: number, partialCode: string}> = [];
  const startTagRegex = /Shadow:Code\+(.*?):start\s*([\s\S]*?)(?=(Shadow:Code\+\1:end|$))/g;
  
  let match;
  while ((match = startTagRegex.exec(content)) !== null) {
    const [fullMatch, filename, partialCode] = match;
    const endTagExists = content.includes(`Shadow:Code+${filename}:end`);
    
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

const LANGUAGE_EXTENSIONS: Record<string, string> = {
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

const DEFAULT_FILENAMES: Record<string, string> = {
  python: 'main.py',
  javascript: 'main.js',
  typescript: 'main.ts',
  tsx: 'App.tsx',
  jsx: 'App.jsx',
  html: 'index.html',
  css: 'styles.css',
  bash: 'script.sh',
  shell: 'script.sh',
  json: 'data.json',
  markdown: 'README.md',
  md: 'README.md',
  ruby: 'main.rb',
  java: 'Main.java',
  cpp: 'main.cpp',
  c: 'main.c',
  go: 'main.go',
  rust: 'main.rs',
  php: 'index.php',
  xml: 'index.xml',
  yaml: 'config.yaml',
  yml: 'config.yml',
  swift: 'main.swift',
  kotlin: 'Main.kt',
  sql: 'query.sql',
};

const slugifyFileBase = (value: string): string => {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase()
    .replace(/['"`]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_');
};

const getExtensionForLanguage = (language: string): string => {
  return LANGUAGE_EXTENSIONS[language.toLowerCase()] || '';
};

const GENERIC_FILENAME_BASES = new Set([
  'main',
  'index',
  'app',
  'script',
  'test',
  'demo',
  'example',
  'component',
  'components',
  'page',
  'screen',
  'view',
  'module',
  'helper',
  'helpers',
  'util',
  'utils',
  'manager',
  'service',
  'controller',
  'handler',
  'engine',
  'core',
  'game',
  'game_loop',
  'gameloop',
  'loop',
  'main_loop',
  'mainloop',
]);

const looksGenericFilenameBase = (base: string): boolean => {
  const normalized = slugifyFileBase(base);
  if (!normalized) return true;
  return GENERIC_FILENAME_BASES.has(normalized) || normalized.length < 3;
};

const extractTopicFromContext = (context: string): string | null => {
  if (!context) return null;

  const patterns = [
    /(?:build|make|create|code|write|implement|generate|fix|refactor)\s+(?:a|an|the)?\s*([A-Za-z][A-Za-z0-9_-]{2,})\s+(?:game|app|project|feature|script|tool|page|screen)\b/i,
    /\b([A-Za-z][A-Za-z0-9_-]{2,})\s+(?:game|app|project|feature|script|tool|page|screen)\b/i,
    /\b(?:for|with|about)\s+([A-Za-z][A-Za-z0-9_-]{2,})\b/i,
  ];

  for (const pattern of patterns) {
    const match = context.match(pattern);
    if (match?.[1]) {
      const topic = slugifyFileBase(match[1]);
      if (topic && !looksGenericFilenameBase(topic)) {
        return topic;
      }
    }
  }

  return null;
};

const buildTopicFilename = (topic: string, ext: string, context: string): string => {
  const base = slugifyFileBase(topic);
  if (!base) return `new_file.${ext}`;

  const hasGameContext = /\bgame\b/i.test(context);
  const hasAppContext = /\bapp\b/i.test(context);

  if (hasGameContext) return `${base}_game.${ext}`;
  if (hasAppContext) return `${base}_app.${ext}`;
  return `${base}.${ext}`;
};

const guessLanguageFromCode = (code: string): string => {
  const trimmed = code.trim();

  if (/^\s*<!doctype html>/i.test(trimmed) || /<html[\s>]/i.test(trimmed) || /<\/[a-z][^>]*>/i.test(trimmed)) {
    return 'html';
  }

  if (/\bimport\s+React\b|\bexport\s+default\b|<\w+[\s/>]|useState\(|useEffect\(/.test(code)) {
    return 'tsx';
  }

  if (/\bfunction\s+\w+\s*\(|\bconst\s+\w+\s*=\s*(?:\(|async\s*\(|\{)/.test(code) || /\bconsole\.log\(/.test(code)) {
    return 'javascript';
  }

  if (/\bdef\s+\w+\s*\(|\bclass\s+\w+\s*[:(]|\bfrom\s+\w+\s+import\b|\bimport\s+\w+\b|pygame/i.test(code)) {
    return 'python';
  }

  if (/\bpackage\s+main\b|\bfunc\s+\w+\s*\(|fmt\.\w+\(/.test(code)) {
    return 'go';
  }

  if (/\bpublic\s+class\s+\w+|\bSystem\.out\.println\(/.test(code)) {
    return 'java';
  }

  if (/\bfn\s+\w+\s*\(|\blet\s+mut\b|\bprintln!\(/.test(code)) {
    return 'rust';
  }

  return '';
};

const inferFilenameFromCode = (code: string, language: string): string | null => {
  const languageKey = (language || guessLanguageFromCode(code)).toLowerCase();
  const ext = getExtensionForLanguage(languageKey);
  if (!ext) return null;

  const candidateMatches = [
    code.match(/\bclass\s+([A-Z][A-Za-z0-9_]+)/),
    code.match(/\bdef\s+([A-Za-z_][A-Za-z0-9_]*)/),
    code.match(/\bfunction\s+([A-Za-z_][A-Za-z0-9_]*)/),
    code.match(/\b(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=/),
  ];

  for (const match of candidateMatches) {
    const rawCandidate = match?.[1] || '';
    const base = slugifyFileBase(rawCandidate);
    if (!base || looksGenericFilenameBase(base)) {
      continue;
    }
    return `${base}.${ext}`;
  }

  return null;
};

const inferFilenameFromContext = (content: string, blockStartIndex: number, language: string, code: string): string | null => {
  const contextStart = Math.max(0, blockStartIndex - 350);
  const context = content.slice(contextStart, blockStartIndex);
  const languageKey = (language || guessLanguageFromCode(code)).toLowerCase();
  const topic = extractTopicFromContext(context);

  const filenamePatterns = [
    /(?:file|filename|name|path)\s*(?:is|:)\s*([^\s`"'<>]+?\.[A-Za-z0-9]+)(?:\b|$)/i,
    /(?:create|make|save|write)\s+(?:a\s+)?([A-Za-z0-9_-]+?\.[A-Za-z0-9]+)(?:\b|$)/i,
  ];

  for (const pattern of filenamePatterns) {
    const match = context.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  const headingMatch = [...context.matchAll(/^(#{1,6})\s+(.+)$/gm)].pop();
  if (headingMatch?.[2]) {
    const headingBase = slugifyFileBase(headingMatch[2]);
    const ext = getExtensionForLanguage(language);
    if (headingBase && !looksGenericFilenameBase(headingBase)) {
      return ext ? `${headingBase}.${ext}` : headingBase;
    }
  }

  const codeDerived = inferFilenameFromCode(code, language);
  if (codeDerived) return codeDerived;

  const ext = getExtensionForLanguage(language);
  if (!ext) return null;

  if (topic) {
    return buildTopicFilename(topic, ext, context);
  }

  const defaultFilename = DEFAULT_FILENAMES[languageKey];
  return defaultFilename || `new_file.${ext}`;
};

export const normalizeFilenameSuggestion = (
  filename: string,
  context: string,
  code: string,
  language: string = ''
): string => {
  const trimmed = filename?.trim();
  const extFromLanguage = getExtensionForLanguage(language || guessLanguageFromCode(code));

  if (!trimmed) {
    return inferFilenameFromContext(context, Math.max(0, context.length - code.length), language, code) || `new_file.${extFromLanguage || 'txt'}`;
  }

  const pathParts = trimmed.split(/[\\/]/);
  const leaf = pathParts[pathParts.length - 1] || trimmed;
  const dir = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : '';
  const leafBase = leaf.replace(/\.[^.\\/]+$/, '');
  const leafExt = leaf.includes('.') ? leaf.split('.').pop() || '' : '';
  const normalizedBase = slugifyFileBase(leafBase);

  if (!normalizedBase) {
    const inferred = inferFilenameFromContext(context, Math.max(0, context.length - code.length), language, code);
    if (inferred) return dir ? `${dir}/${inferred}` : inferred;
    return trimmed;
  }

  if (looksGenericFilenameBase(normalizedBase) || /^new_file(?:\.[^/\\]+)?$/i.test(leaf)) {
    const inferred = inferFilenameFromContext(context, Math.max(0, context.length - code.length), language, code);
    if (inferred) {
      return dir ? `${dir}/${inferred}` : inferred;
    }
  }

  const finalExt = leafExt || extFromLanguage;
  const normalizedLeaf = finalExt ? `${normalizedBase}.${finalExt}` : normalizedBase;
  return dir ? `${dir}/${normalizedLeaf}` : normalizedLeaf;
};

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
 * Removes full markdown code blocks and Shadow workspace code fences from text.
 * This is intended for assistant messages where the actual file content should
 * be applied to the workspace instead of being shown in the chat.
 *
 * @param text - The text to clean
 * @returns The text without code blocks, trimmed and normalized
 */
export const stripWorkspaceCodeBlocks = (text: string): string => {
  if (!text) return text;

  let result = text;

  // Remove Shadow-specific file blocks first so we do not leave behind markers.
  result = result.replace(/Shadow:Code\+[\s\S]*?:start\s*[\s\S]*?Shadow:Code\+[\s\S]*?:end/g, '');

  // Remove fenced code blocks entirely.
  result = result.replace(/```[\s\S]*?```/g, '');

  // Collapse leftover whitespace created by removal.
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim();
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

  const shadowideRegex = /Shadow:Code\+(.+?):start\s*([\s\S]*?)\s*Shadow:Code\+\1:end/g;
  let shadowideMatch;
  while ((shadowideMatch = shadowideRegex.exec(content)) !== null) {
    const filename = shadowideMatch[1].trim();
    const code = shadowideMatch[2].trim();
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
      finalFilename = inferFilenameFromContext(content, matchStart, finalLanguage, cleanedCode) || 'new_file.txt';
    }

    finalFilename = normalizeFilenameSuggestion(finalFilename, content, cleanedCode, finalLanguage);

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
