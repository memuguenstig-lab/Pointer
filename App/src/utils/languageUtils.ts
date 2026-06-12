import * as monaco from 'monaco-editor';

// Language extension mappings
const languageMap: Record<string, string> = {
  // Web
  'html': 'html',
  'htm': 'html',
  'css': 'css',
  'scss': 'scss',
  'less': 'less',
  'js': 'javascript',
  'jsx': 'javascript',
  'ts': 'typescript',
  'tsx': 'typescript',
  'json': 'json',
  'jsonc': 'json',
  
  // Programming Languages
  'py': 'python',
  'java': 'java',
  'cpp': 'cpp',
  'c': 'c',
  'h': 'cpp',
  'hpp': 'cpp',
  'cs': 'csharp',
  'go': 'go',
  'rs': 'rust',
  'rb': 'ruby',
  'php': 'php',
  'swift': 'swift',
  'kt': 'kotlin',
  'scala': 'scala',
  'dart': 'dart',
  
  // Shell Scripts
  'sh': 'shell',
  'bash': 'shell',
  'zsh': 'shell',
  'fish': 'shell',
  'ps1': 'powershell',
  
  // Config Files
  'yml': 'yaml',
  'yaml': 'yaml',
  'toml': 'toml',
  'ini': 'ini',
  'env': 'dotenv',
  'dockerfile': 'dockerfile',
  
  // Markup
  'md': 'markdown',
  'markdown': 'markdown',
  'xml': 'xml',
  'svg': 'xml',
  
  // Other
  'sql': 'sql',
  'graphql': 'graphql',
  'vue': 'vue',
  'r': 'r',
  'matlab': 'matlab',
  'perl': 'perl',
  'lua': 'lua',
  'haskell': 'haskell',
};

export function getLanguageFromFileName(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  return languageMap[extension] || 'plaintext';
}

// Configure Monaco editor with additional language features
export function configureMonacoLanguages() {
  // Register additional language features and syntax highlighting
  
  // Python
  monaco.languages.register({ id: 'python' });
  monaco.languages.setMonarchTokensProvider('python', {
    keywords: [
      'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await',
      'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except',
      'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda',
      'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while',
      'with', 'yield'
    ],
    operators: [
      '+', '-', '*', '**', '/', '//', '%', '@',
      '<<', '>>', '&', '|', '^', '~',
      '<', '>', '<=', '>=', '==', '!='
    ],
    symbols: /[=><!~?:&|+\-*\/\^%]+/,
    
    tokenizer: {
      root: [
        [/[a-zA-Z_]\w*/, { cases: {
          '@keywords': 'keyword',
          '@default': 'identifier'
        }}],
        [/".*?"/, 'string'],
        [/'.*?'/, 'string'],
        [/\d+/, 'number'],
        [/#.*$/, 'comment'],
      ]
    }
  });

  // Rust
  monaco.languages.register({ id: 'rust' });
  monaco.languages.setMonarchTokensProvider('rust', {
    keywords: [
      'as', 'break', 'const', 'continue', 'crate', 'else', 'enum', 'extern',
      'false', 'fn', 'for', 'if', 'impl', 'in', 'let', 'loop', 'match', 'mod',
      'move', 'mut', 'pub', 'ref', 'return', 'self', 'Self', 'static', 'struct',
      'super', 'trait', 'true', 'type', 'unsafe', 'use', 'where', 'while', 'async',
      'await', 'dyn', 'abstract', 'become', 'box', 'do', 'final', 'macro',
      'override', 'priv', 'typeof', 'unsized', 'virtual', 'yield'
    ],
    tokenizer: {
      root: [
        [/[a-zA-Z_]\w*/, { cases: {
          '@keywords': 'keyword',
          '@default': 'identifier'
        }}],
        [/".*?"/, 'string'],
        [/\/\/.*$/, 'comment'],
        [/\/\*/, 'comment', '@comment'],
        [/\d+/, 'number'],
      ],
      comment: [
        [/[^/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[/*]/, 'comment']
      ]
    }
  });

  // Go
  monaco.languages.register({ id: 'go' });
  monaco.languages.setMonarchTokensProvider('go', {
    keywords: [
      'break', 'case', 'chan', 'const', 'continue', 'default', 'defer', 'else',
      'fallthrough', 'for', 'func', 'go', 'goto', 'if', 'import', 'interface',
      'map', 'package', 'range', 'return', 'select', 'struct', 'switch', 'type',
      'var'
    ],
    tokenizer: {
      root: [
        [/[a-zA-Z_]\w*/, { cases: {
          '@keywords': 'keyword',
          '@default': 'identifier'
        }}],
        [/".*?"/, 'string'],
        [/\/\/.*$/, 'comment'],
        [/\/\*/, 'comment', '@comment'],
        [/\d+/, 'number'],
      ],
      comment: [
        [/[^/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[/*]/, 'comment']
      ]
    }
  });

  // Add more language configurations as needed...
}

// Initialize language support
export function initializeLanguageSupport() {
  configureMonacoLanguages();
  
  // Load additional language features dynamically
  // This is where you would load language servers or additional syntax definitions
  // For example, loading the Python language server for better IntelliSense
} 
