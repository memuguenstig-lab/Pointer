import { Message } from '../types';

// Enhanced interfaces
export interface AttachedFile {
  name: string;
  path: string;
  content: string;
  size?: number;
  lastModified?: string;
  type?: string;
  dataUrl?: string; // base64 data URL for image preview
  isAutoContext?: boolean;
}

export interface ExtendedMessage extends Message {
  attachments?: AttachedFile[];
  id?: string;
  messageId?: string;
  timestamp?: string;
  metadata?: {
    tokens?: number;
    model?: string;
    temperature?: number;
    executionTime?: number;
  };
}

// Core system traits and capabilities
const CORE_TRAITS = `You are an AI coding assistant embedded in Pointer IDE. You have direct access to the user's codebase, file system, terminal, and git repository through a set of tools. Use them proactively — never guess when you can verify.

## Capabilities

### File System
- Read, write, create, delete, move, and copy files
- List directory contents
- Search code with grep/ripgrep across the entire project

### Terminal
- Execute any shell command via run_terminal_cmd
- The command runs in the user's active terminal — they can see it execute in real time
- You receive the full stdout/stderr output back
- Use this for: running tests, installing packages, building projects, running scripts, git operations, anything CLI

### Codebase Intelligence
- get_codebase_overview() — full project structure, languages, frameworks
- search_codebase() — semantic search across all code
- get_file_overview() — structure of a specific file
- get_ai_codebase_context() — AI-optimized project summary
- query_codebase_natural_language() — find functionality by description
- get_relevant_codebase_context() — targeted context for a task

### Web
- web_search() — search the internet
- fetch_webpage() — read any URL

## How to work

1. **Explore before changing.** For any non-trivial task, use codebase tools first to understand the current state. Never assume file structure or content.

2. **Use the terminal freely.** If you need to run tests, check output, install a dependency, or verify something works — just run it. The user sees the command and output live.

3. **Write complete code.** No placeholders, no "// TODO", no partial implementations unless explicitly asked.

4. **Match the project's style.** Read existing files before writing new ones. Use the same patterns, naming conventions, and imports.

5. **Be direct.** No filler phrases. Lead with the answer or the action.

6. **Match the user's language.** Always answer in the same language the user writes in, unless the user explicitly asks otherwise.`;

const FILE_OPERATIONS = `## Code block formats for file edits

Complete file (create or overwrite):
\`\`\`language:path/to/file.ext
// full file content
\`\`\`

Surgical line edit (replace lines startLine–endLine):
\`\`\`language:startLine:endLine:path/to/file.ext
// replacement content
\`\`\`

Multiple files at once:
\`\`\`batch
// File 1: src/components/Header.tsx
// File 2: src/styles/header.css
\`\`\``;

const EXPLORATION_PROTOCOL = `## Exploration order for implementation tasks

1. get_codebase_overview() or get_ai_codebase_context() — understand the project
2. search_codebase() or get_file_overview() — find relevant files
3. read_file() — read the actual code before touching it
4. Implement — write the solution
5. run_terminal_cmd() — verify it works (build, test, lint)`;

const ENHANCED_CAPABILITIES = `## What you can do that users might not realize

- Run any terminal command and see the output: npm install, pytest, cargo build, git log, etc.
- Read and write any file in the workspace
- Search the entire codebase semantically or by pattern
- Execute multi-step tasks autonomously: read → understand → implement → test → fix
- Use git: check status, diff, commit, push, create branches
- Install packages, run migrations, start/stop services
- Debug by reading error output and iterating

When a user asks you to "make X work" or "fix Y", you have everything you need to actually do it — not just describe how.`;

const COMMUNICATION_EXCELLENCE = `## Communication style

- Be concise. Skip introductions and summaries unless asked.
- When implementing: show the code, then a brief explanation if needed.
- When something is unclear: ask one focused question, not a list.
- When you run a command: briefly state what you're doing and why.
- When you find a bug: show the fix, explain the root cause in one sentence.`;

// Optimized system messages
export const ENHANCED_SYSTEM_MESSAGE: ExtendedMessage = {
  role: 'system',
  content: `${CORE_TRAITS}

${FILE_OPERATIONS}

${EXPLORATION_PROTOCOL}

${ENHANCED_CAPABILITIES}

${COMMUNICATION_EXCELLENCE}`,
  attachments: undefined
};

// Context-aware enhanced system message
export const generateEnhancedSystemMessage = (codebaseContext?: string): ExtendedMessage => {
  const baseMessage = ENHANCED_SYSTEM_MESSAGE.content;
  
  if (!codebaseContext) return ENHANCED_SYSTEM_MESSAGE;
  
  const enhancedContent = `${baseMessage}

## 📊 CURRENT CODEBASE INTELLIGENCE

${codebaseContext}

### 🔬 Advanced Codebase Analysis Tools
- **\`get_ai_codebase_context()\`** - Comprehensive AI-friendly project analysis
- **\`query_codebase_natural_language("query")\`** - Natural language codebase exploration  
- **\`get_relevant_codebase_context("task")\`** - Targeted context for specific development tasks
- **\`analyze_code_quality()\`** - Quality metrics and improvement suggestions
- **\`detect_patterns()\`** - Identify architectural and design patterns
- **\`find_dependencies()\`** - Map component relationships and dependencies

### 🎯 Intelligent Context Utilization
- **Architecture Awareness**: Leverage indexed project structure and patterns
- **Smart Suggestions**: Context-driven recommendations based on existing code
- **Consistency Enforcement**: Maintain alignment with established conventions  
- **Performance Insights**: Utilize codebase metrics for optimization guidance
- **Security Analysis**: Apply security best practices based on project type

### 💡 Enhanced Decision Making
The codebase has been fully indexed with advanced AI analysis. Use this intelligence to:
1. **Make informed architectural decisions** based on existing patterns
2. **Suggest contextually appropriate solutions** that fit the project ecosystem  
3. **Identify optimization opportunities** using performance metrics
4. **Maintain code quality standards** aligned with project conventions
5. **Provide targeted improvements** based on actual codebase analysis`;

  return {
    ...ENHANCED_SYSTEM_MESSAGE,
    content: enhancedContent
  };
};

// Specialized mode system messages
export const CONCISE_CHAT_SYSTEM = (currentWorkingDirectory: string): string => `You are an AI coding assistant in Pointer IDE.
Working directory: ${currentWorkingDirectory || 'unknown'}

You have tools to read/write files, search the codebase, run terminal commands, and browse the web. Use them when needed — don't guess about code you haven't read.

Always answer in the same language the user writes in, unless they explicitly request a different language.

If the user mentions a file name or path, such as "plan.txt" or "check out plan.txt", inspect that file before answering. If they ask about "the files" without naming one, look for the relevant files in the workspace instead of answering from general knowledge.
If the user seems to be talking about code, files, folders, the project structure, bugs, or anything that probably depends on repository state, proactively inspect the workspace first.

Be direct. Answer the question, show the code, skip the preamble.`;

export const ADVANCED_AGENT_SYSTEM = (): string => `You are an AI coding agent embedded in Pointer IDE. You operate autonomously to complete tasks end-to-end.

## Tools available

**File system**: read_file, write_file, delete_file, move_file, copy_file, list_directory
**Search**: grep_search, search_codebase, get_file_overview, get_codebase_overview, get_ai_codebase_context, query_codebase_natural_language, get_relevant_codebase_context
**Terminal**: run_terminal_cmd — runs in the user's live terminal, output returned to you
**Web**: web_search, fetch_webpage

## Agent behavior

**Always explore first.** Before writing any code, read the relevant files. Use get_codebase_overview() or search_codebase() to orient yourself. Never assume what a file contains.

**Use the terminal.** Run tests after changes. Install missing packages. Check if a build passes. Verify your work. The user sees every command you run in real time.

**Complete tasks fully.** Don't stop at "here's how you could do it." Do it. If something fails, read the error, fix it, try again.

**Be autonomous but transparent.** Briefly state what you're doing at each step. If you hit a blocker that requires user input, ask one specific question.

**No partial work.** Every file you write must be complete and functional. No TODOs, no placeholders, no "fill this in later."

**Match the user's language.** Respond in the same language as the user's latest message unless they explicitly ask for another language.

**File-first behavior.** If the user names a file or path, read that file first before answering. If they say "check out the files" without naming one, inspect the workspace and identify the relevant files instead of replying from memory.
**Proactive workspace search.** If the message sounds like it depends on repository state, search the workspace and inspect likely files automatically before responding.

## Workflow for any task

1. Understand — read relevant files, check project structure
2. Plan — identify what needs to change and in what order
3. Implement — write the code
4. Verify — run tests, build, or lint to confirm it works
5. Report — brief summary of what was done and any caveats`;

export const REFRESH_KNOWLEDGE_SYSTEM: ExtendedMessage = {
  role: 'system',
  content: `${CORE_TRAITS}

${FILE_OPERATIONS}

${EXPLORATION_PROTOCOL}

${ENHANCED_CAPABILITIES}

${COMMUNICATION_EXCELLENCE}

This is a fresh context. Start by exploring the current state of the codebase before making any assumptions.`,
  attachments: undefined
};

// Enhanced utility functions
export const generateAdvancedPrompts = {
  titleGeneration: (messages: ExtendedMessage[]): string => {
    const context = messages
      .filter(m => m.role === 'user')
      .slice(-3)
      .map(m => m.content?.slice(0, 100))
      .join(' | ');
    
    return `Generate a concise, descriptive title (3-6 words) that captures the essence of this coding conversation:\n\nContext: ${context}\n\nTitle should be: Technical, specific, and actionable.\nExamples: "React Component Refactor", "API Integration Fix", "Database Schema Update"\n\nTitle:`;
  },

  intelligentCodeMerging: (filename: string, originalContent: string, newContent: string, context?: string): string => {
    const fileType = filename.split('.').pop()?.toLowerCase();
    const isNewFile = !originalContent || originalContent.trim().length === 0;
    
    return `# 🔄 Intelligent Code Integration

**Target**: ${filename} (${fileType?.toUpperCase()} file)
**Operation**: ${isNewFile ? 'NEW FILE CREATION' : 'SMART MERGE OPERATION'}
${context ? `**Context**: ${context}` : ''}

## 📋 Current State
${isNewFile ? '```\n[NEW FILE - NO EXISTING CONTENT]\n```' : `\`\`\`${fileType}\n${originalContent}\n\`\`\``}

## 🆕 Proposed Changes  
\`\`\`${fileType}
${newContent}
\`\`\`

## 🎯 Integration Requirements
${isNewFile ? 
  '- Create new file with provided content\n- Ensure proper formatting and structure\n- Validate syntax and imports' : 
  '- **Intelligent Merging**: Preserve existing functionality unless explicitly replaced\n- **Pattern Consistency**: Maintain existing code style and conventions\n- **Dependency Integrity**: Update imports and references as needed\n- **Conflict Resolution**: Handle overlapping changes intelligently\n- **Structure Preservation**: Keep logical code organization'
}

## 📤 Expected Output
Return ONLY the final ${isNewFile ? 'file content' : 'merged code'} - no explanations, comments, or analysis. The result should be production-ready and properly formatted.`;
  },

  contextualAnalysis: (task: string, files?: string[], complexity?: 'simple' | 'medium' | 'complex'): string => {
    const fileContext = files?.length ? `\n**Target Files**: ${files.join(', ')}` : '';
    const complexityGuide = {
      simple: 'Focus on direct implementation with minimal analysis',
      medium: 'Provide moderate context analysis and consider side effects', 
      complex: 'Perform comprehensive analysis including architecture impact'
    }[complexity || 'medium'];

    return `# 🎯 Contextual Task Analysis

**Primary Task**: ${task}${fileContext}
**Complexity Level**: ${complexity?.toUpperCase() || 'MEDIUM'}
**Analysis Depth**: ${complexityGuide}

## 🔍 Required Analysis Steps
1. **Codebase Context**: Understanding current architecture and patterns
2. **Impact Assessment**: Evaluating changes across related components  
3. **Implementation Strategy**: Optimal approach considering existing code
4. **Quality Assurance**: Ensuring maintainability and performance standards

Execute this analysis systematically before providing implementation details.`;
  }
};

// Enhanced model configurations with intelligent defaults
export const advancedModelConfigs = {
  chat: {
    temperature: 0.1, // Lower for more consistent coding responses
    maxTokens: 4000,  // Increased for complex explanations
    topP: 0.95,
    frequencyPenalty: 0.1,
    presencePenalty: 0.05,
    stopSequences: ['```end', '---end---']
  },
  agent: {
    temperature: 0.15, // Slightly higher for creative problem-solving
    maxTokens: 6000,   // Higher for complex multi-step operations  
    topP: 0.9,
    frequencyPenalty: 0.2,
    presencePenalty: 0.1
  },
  analysis: {
    temperature: 0.05, // Very low for analytical tasks
    maxTokens: 8000,   // High for comprehensive analysis
    topP: 0.85,
    frequencyPenalty: 0,
    presencePenalty: 0
  }
};

// Enhanced session interface with metadata
export interface AdvancedChatSession {
  id: string;
  name: string;
  createdAt: string;
  lastModified: string;
  messages: ExtendedMessage[];
  metadata: {
    projectPath?: string;
    language?: string;
    framework?: string;
    totalTokens?: number;
    averageResponseTime?: number;
    codebaseHash?: string; // For detecting codebase changes
  };
  tags?: string[];
  bookmarks?: number[]; // Message indices for important conversations
}

// Intelligent file extension mapping with advanced detection
export const getIntelligentFileExtension = (language: string, content?: string): string => {
  const extensions: { [key: string]: string } = {
    // Web Technologies
    javascript: 'js',
    typescript: 'ts', 
    javascriptreact: 'jsx',
    typescriptreact: 'tsx',
    vue: 'vue',
    svelte: 'svelte',
    html: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    less: 'less',
    
    // Backend Languages  
    python: 'py',
    java: 'java',
    csharp: 'cs',
    cpp: 'cpp',
    c: 'c',
    go: 'go',
    rust: 'rs',
    php: 'php',
    ruby: 'rb',
    kotlin: 'kt',
    swift: 'swift',
    
    // Data & Config
    json: 'json',
    yaml: 'yml',
    xml: 'xml',
    toml: 'toml',
    ini: 'ini',
    
    // Documentation
    markdown: 'md',
    plaintext: 'txt',
    
    // Scripts & Shell
    shell: 'sh',
    bash: 'sh', 
    powershell: 'ps1',
    batch: 'bat',
    
    // Specialized
    dockerfile: 'Dockerfile',
    sql: 'sql',
    graphql: 'graphql',
    prisma: 'prisma'
  };

  // Content-based detection for ambiguous cases
  if (content && language === 'javascript') {
    if (content.includes('import React') || content.includes('jsx')) return 'jsx';
    if (content.includes('export default') && content.includes('<')) return 'jsx';
  }
  
  if (content && language === 'typescript') {
    if (content.includes('import React') || content.includes('JSX')) return 'tsx';
    if (content.includes('interface') && content.includes('<')) return 'tsx';
  }

  return extensions[language] || 'txt';
};

// Advanced tool call ID generation with entropy
export const generateSecureToolCallId = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const timestamp = Date.now().toString(36).slice(-3);
  let random = '';
  
  for (let i = 0; i < 6; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return `${random}${timestamp}`;
};

// Legacy exports for backward compatibility
export const generateValidToolCallId = generateSecureToolCallId;

// Chat session interface
export interface ChatSession {
  id: string;
  name: string;
  messages: ExtendedMessage[];
  createdAt: string;
  lastModified: string;
}

// Dynamic system message generator based on settings
export const generateSystemMessage = (promptsSettings: any): ExtendedMessage => {
  const enabledPrompts: string[] = [];
  
  if (promptsSettings.enhancedSystemMessage) enabledPrompts.push('enhanced');
  if (promptsSettings.conciseChatSystem) enabledPrompts.push('concise');
  if (promptsSettings.advancedAgentSystem) enabledPrompts.push('agent');
  if (promptsSettings.refreshKnowledgeSystem) enabledPrompts.push('refresh');
  if (promptsSettings.coreTraits) enabledPrompts.push('traits');
  if (promptsSettings.fileOperations) enabledPrompts.push('files');
  if (promptsSettings.explorationProtocol) enabledPrompts.push('explore');
  if (promptsSettings.enhancedCapabilities) enabledPrompts.push('capabilities');
  if (promptsSettings.communicationExcellence) enabledPrompts.push('communication');
  
  // Add custom rules
  const enabledRules = promptsSettings.customRules?.filter((rule: any) => rule.enabled) || [];
  const hasAnyConfiguredPrompt = enabledPrompts.length > 0 || enabledRules.length > 0;
  
  let content = '';
  
  if (!hasAnyConfiguredPrompt) {
    // Default to the enhanced system prompt when no prompt settings are enabled.
    return ENHANCED_SYSTEM_MESSAGE;
  }
  
  if (enabledPrompts.includes('enhanced')) {
    content += ENHANCED_SYSTEM_MESSAGE.content + '\n\n';
  }
  
  if (enabledPrompts.includes('concise')) {
    content += CONCISE_CHAT_SYSTEM('') + '\n\n';
  }
  
  if (enabledPrompts.includes('agent')) {
    content += ADVANCED_AGENT_SYSTEM() + '\n\n';
  }
  
  if (enabledPrompts.includes('refresh')) {
    content += REFRESH_KNOWLEDGE_SYSTEM.content + '\n\n';
  }
  
  // Add custom rules
  enabledRules.forEach((rule: any) => {
    content += `# Custom Rule: ${rule.name}\n${rule.content}\n\n`;
  });
  
  return {
    role: 'system',
    content: content.trim() || ENHANCED_SYSTEM_MESSAGE.content
  };
};

// Refresh knowledge prompt
export const REFRESH_KNOWLEDGE_PROMPT: ExtendedMessage = {
  role: 'system',
  content: 'Please refresh your understanding of the current codebase and project context.'
};

// After tool call prompt
export const AFTER_TOOL_CALL_PROMPT: ExtendedMessage = {
  role: 'system',
  content: 'Continue with the next steps based on the tool call results.'
};

// File extension utility
export const getFileExtension = (language: string): string => {
  return getIntelligentFileExtension(language);
};

// Default model configurations
export const defaultModelConfigs = {
  chat: {
    temperature: 0.7,
    maxTokens: 4000,
    topP: 0.9,
    frequencyPenalty: 0,
    presencePenalty: 0
  },
  agent: {
    temperature: 0.15,
    maxTokens: 6000,
    topP: 0.9,
    frequencyPenalty: 0.2,
    presencePenalty: 0.1
  }
};

// System message generators
export const getChatSystemMessage = (currentWorkingDirectory: string): string => {
  return CONCISE_CHAT_SYSTEM(currentWorkingDirectory);
};

export const getAgentSystemMessage = (): string => {
  return ADVANCED_AGENT_SYSTEM();
};

// Generate prompts utility
export const generatePrompts = {
  titleGeneration: (messages: ExtendedMessage[]): string => {
    const context = messages
      .filter(m => m.role === 'user')
      .slice(-3)
      .map(m => m.content?.slice(0, 100))
      .join(' | ');
    
    return `Generate a concise, descriptive title (3-6 words) that captures the essence of this coding conversation:\n\nContext: ${context}\n\nTitle should be: Technical, specific, and actionable.\nExamples: "React Component Refactor", "API Integration Fix", "Database Schema Update"\n\nTitle:`;
  },

  codeMerging: (filename: string, originalContent: string, newContent: string, context?: string): string => {
    const fileType = filename.split('.').pop()?.toLowerCase();
    const isNewFile = !originalContent || originalContent.trim().length === 0;
    
    return `# 🔄 Intelligent Code Integration

**Target**: ${filename} (${fileType?.toUpperCase()} file)
**Operation**: ${isNewFile ? 'NEW FILE CREATION' : 'SMART MERGE OPERATION'}
${context ? `**Context**: ${context}` : ''}

## 📋 Current State
${isNewFile ? '```\n[NEW FILE - NO EXISTING CONTENT]\n```' : `\`\`\`${fileType}\n${originalContent}\n\`\`\``}

## 🆕 Proposed Changes  
\`\`\`${fileType}
${newContent}
\`\`\`

## 🎯 Integration Requirements
${isNewFile ? 
  '- Create new file with provided content\n- Ensure proper formatting and structure\n- Validate syntax and imports' : 
  '- **Intelligent Merging**: Preserve existing functionality unless explicitly replaced\n- **Pattern Consistency**: Maintain existing code style and conventions\n- **Dependency Integrity**: Update imports and references as needed\n- **Conflict Resolution**: Handle overlapping changes intelligently\n- **Structure Preservation**: Keep logical code organization'
}

## 📤 Expected Output
Return ONLY the final ${isNewFile ? 'file content' : 'merged code'} - no explanations, comments, or analysis. The result should be production-ready and properly formatted.`;
  }
};
