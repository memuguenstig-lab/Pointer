import React from 'react';
import { isDatabaseFile } from './FileViewer';

const iconColors = {
  js: '#F1DD3F',
  ts: '#3178C6',
  jsx: '#61DAFB',
  tsx: '#61DAFB',
  css: '#2965F1',
  html: '#E44D26',
  json: '#F1DD3F',
  md: '#ffffff',
  py: '#3776AB',
  java: '#E76F00',
  cpp: '#659AD2',
  c: '#659AD2',
  go: '#00ADD8',
  rs: '#DEA584',
  php: '#777BB4',
  rb: '#CC342D',
  sql: '#CC2927',
  db: '#7E57C2',  // Database color (purple)
  yaml: '#FF5F00',
  xml: '#F1662A',
  default: '#8B8B8B'
};

export const getIconForFile = (filename: string) => {
  // Check if it's a database file first
  if (isDatabaseFile(filename)) {
    return <DatabaseIcon />;
  }

  const extension = filename.split('.').pop()?.toLowerCase() || '';

  switch (extension) {
    case 'js':
      return <JavaScriptIcon />;
    case 'jsx':
      return <JSXIcon />;
    case 'ts':
      return <TypeScriptIcon />;
    case 'tsx':
      return <TSXIcon />;
    case 'json':
      return <JSONIcon />;
    case 'html':
    case 'htm':
      return <HTMLIcon />;
    case 'css':
      return <CSSIcon />;
    case 'scss':
    case 'sass':
      return <SCSSIcon />;
    case 'less':
      return <LESSIcon />;
    case 'md':
      return <MarkdownIcon />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return <ImageIcon />;
    case 'pdf':
      return <PDFIcon />;
    case 'zip':
    case 'rar':
    case 'gz':
    case '7z':
      return <ArchiveIcon />;
    case 'gitignore':
      return <GitIcon />;
    case 'xml':
      return <XMLIcon />;
    default:
      return <DefaultFileIcon />;
  }
};

export const FolderIcon: React.FC<{ isOpen?: boolean }> = ({ isOpen }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d={isOpen 
        ? "M1.5 3h5l1 2h7v8h-13V3z"
        : "M1.5 3h5l1 2h7v7h-13V3z"
      }
      fill="currentColor"
      style={{ 
        color: isOpen 
          ? 'var(--explorer-folder-expanded-fg, #DCB67A)' 
          : 'var(--explorer-folder-fg, #DCB67A)'
      }}
      stroke="currentColor"
      strokeWidth=".3"
      strokeOpacity="0.4"
    />
  </svg>
);

export const ChevronIcon: React.FC<{ isExpanded: boolean }> = ({ isExpanded }) => (
  <svg 
    width="16" 
    height="16" 
    viewBox="0 0 16 16" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    style={{
      transform: isExpanded ? 'rotate(90deg)' : 'none',
      transition: 'transform 100ms ease',
    }}
  >
    <path
      d="M6 4l4 4-4 4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const JavaScriptIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 3V13H13V3H3ZM8.5 10.5C8.5 11.2 8.2 11.7 7.6 12C7.3 12.1 7 12.2 6.6 12.2C6 12.2 5.5 12 5.3 11.7L5.5 11.1C5.8 11.4 6.1 11.5 6.5 11.5C6.7 11.5 6.9 11.5 7 11.4C7.2 11.3 7.3 11 7.3 10.7V8H8.6V10.5H8.5ZM10.7 10.5C10.7 11 10.5 11.3 10.1 11.7C9.8 11.9 9.4 12 9.1 12C8.5 12 8.2 11.8 7.8 11.4L8.3 10.8C8.5 11.1 8.7 11.3 9 11.3C9.2 11.3 9.3 11.3 9.4 11.2C9.5 11.1 9.6 11 9.6 10.8C9.6 10.6 9.5 10.4 9.2 10.3C9.1 10.3 9 10.2 8.8 10.2C8.7 10.1 8.6 10.1 8.4 10C8 9.8 7.7 9.5 7.7 9C7.7 8.6 7.8 8.3 8.1 8.1C8.4 7.9 8.6 7.8 9 7.8C9.5 7.8 9.9 8 10.1 8.1L9.8 8.7C9.6 8.5 9.4 8.4 9.1 8.4C9 8.4 8.9 8.4 8.8 8.5C8.7 8.6 8.6 8.7 8.6 8.8C8.6 9 8.7 9.1 9 9.2C9.1 9.2 9.1 9.3 9.2 9.3C9.3 9.3 9.4 9.4 9.5 9.4C10 9.7 10.6 10 10.6 10.7L10.7 10.5Z" 
      fill="currentColor" />
  </svg>
);

export const JSXIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 3V13H13V3H3ZM10.5 9C10.5 9.7 10.3 10.3 9.9 10.7C9.5 11.2 8.9 11.4 8.1 11.4C7.3 11.4 6.7 11.2 6.3 10.7C5.9 10.3 5.7 9.7 5.7 9C5.7 8.3 5.9 7.7 6.3 7.3C6.7 6.8 7.3 6.6 8.1 6.6C8.9 6.6 9.5 6.8 9.9 7.3C10.3 7.7 10.5 8.3 10.5 9ZM9.8 9C9.8 8.5 9.7 8.1 9.5 7.8C9.2 7.5 8.8 7.3 8.2 7.3C7.6 7.3 7.2 7.5 6.9 7.8C6.7 8.1 6.5 8.5 6.5 9C6.5 9.5 6.6 9.9 6.9 10.2C7.1 10.5 7.6 10.7 8.2 10.7C8.8 10.7 9.2 10.5 9.5 10.2C9.7 9.9 9.8 9.5 9.8 9Z" 
      fill="currentColor" />
  </svg>
);

export const TypeScriptIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 3V13H13V3H3ZM10.2 8.4V7.6H6.8V8.4H8V11.7H9V8.4H10.2ZM5.2 11.5L5.8 10.9C6 11.1 6.2 11.2 6.4 11.2C6.7 11.2 6.8 11.1 6.8 10.8V7.6H7.8V10.8C7.8 11.6 7.4 12 6.5 12C5.9 12 5.5 11.8 5.2 11.5Z" 
      fill="currentColor" />
  </svg>
);

export const TSXIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 3V13H13V3H3ZM8.5 8C8.5 7.6 8.3 7.2 8 7C8.3 6.7 8.5 6.4 8.5 6C8.5 5.1 7.8 4.5 7 4.5C6.1 4.5 5.5 5.2 5.5 6H6.5C6.5 5.7 6.7 5.5 7 5.5C7.3 5.5 7.5 5.7 7.5 6C7.5 6.3 7.3 6.5 7 6.5H6.5V7.5H7C7.3 7.5 7.5 7.7 7.5 8C7.5 8.3 7.3 8.5 7 8.5C6.7 8.5 6.5 8.3 6.5 8H5.5C5.5 8.8 6.1 9.5 7 9.5C7.8 9.5 8.5 8.8 8.5 8ZM11.5 8C11.5 7.6 11.3 7.2 11 7C11.3 6.7 11.5 6.4 11.5 6C11.5 5.1 10.8 4.5 10 4.5C9.1 4.5 8.5 5.2 8.5 6H9.5C9.5 5.7 9.7 5.5 10 5.5C10.3 5.5 10.5 5.7 10.5 6C10.5 6.3 10.3 6.5 10 6.5H9.5V7.5H10C10.3 7.5 10.5 7.7 10.5 8C10.5 8.3 10.3 8.5 10 8.5C9.7 8.5 9.5 8.3 9.5 8H8.5C8.5 8.8 9.1 9.5 10 9.5C10.8 9.5 11.5 8.8 11.5 8Z" 
      fill="currentColor" />
  </svg>
);

export const JSONIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 3V13H13V3H3ZM8 9.5C8 10.3 7.3 11 6.5 11C5.7 11 5 10.3 5 9.5V7.5C5 6.7 5.7 6 6.5 6C7.3 6 8 6.7 8 7.5H7C7 7.2 6.8 7 6.5 7C6.2 7 6 7.2 6 7.5V9.5C6 9.8 6.2 10 6.5 10C6.8 10 7 9.8 7 9.5V9H6.5V8H8V9.5ZM11 9.5C11 10.3 10.3 11 9.5 11C8.7 11 8 10.3 8 9.5V7.5C8 6.7 8.7 6 9.5 6C10.3 6 11 6.7 11 7.5H10C10 7.2 9.8 7 9.5 7C9.2 7 9 7.2 9 7.5V9.5C9 9.8 9.2 10 9.5 10C9.8 10 10 9.8 10 9.5H11Z" 
      fill="currentColor" />
  </svg>
);

export const HTMLIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 3V13H13V3H3ZM10 8.5L8 10L6 8.5V7.5L8 9L10 7.5V8.5ZM10 6.5L8 5L6 6.5V5.5L8 4L10 5.5V6.5Z" 
      fill="currentColor" />
  </svg>
);

export const CSSIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 3V13H13V3H3ZM10 6L8 4L6 6H7L8 5L9 6H10ZM10 10L8 12L6 10H7L8 11L9 10H10Z" 
      fill="currentColor" />
  </svg>
);

export const SCSSIcon = CSSIcon;
export const LESSIcon = CSSIcon;

export const MarkdownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 3V13H13V3H3ZM11 10H10V6H8.5L7 8L5.5 6H4V10H5V7.5L7 10L9 7.5V10H11Z" 
      fill="currentColor" />
  </svg>
);

export const ImageIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 3V13H13V3H3ZM6 5.5C6 4.7 5.3 4 4.5 4V5.5H6ZM4.5 7C5.9 7 7 5.9 7 4.5H4V7H4.5ZM5 9L7 7L9 9L11 7V11H5V9Z" 
      fill="currentColor" />
  </svg>
);

export const PDFIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 3V13H13V3H3ZM4 8H5V9H4V8ZM4 6H5V7H4V6ZM4 4H5V5H4V4ZM6 4H12V5H6V4ZM6 8H12V9H6V8ZM6 6H12V7H6V6ZM4 10H12V11H4V10Z" 
      fill="currentColor" />
  </svg>
);

export const ArchiveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 3V13H13V3H3ZM10 11H6V10H10V11ZM10 9H6V8H10V9ZM10 7H6V6H10V7ZM10 5H6V4H10V5Z" 
      fill="currentColor" />
  </svg>
);

export const GitIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 3V13H13V3H3ZM10.2 9.2L9.5 8.5V10H8.5V8.5L7.8 9.2L7.1 8.5L8.5 7.1V6H9.5V7.1L10.9 8.5L10.2 9.2ZM7 8H6V7H7V8ZM6 6H5V5H6V6Z" 
      fill="currentColor" />
  </svg>
);

export const XMLIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 3V13H13V3H3ZM6 11L4 8L6 5H7.5L5.5 8L7.5 11H6ZM10 11L8 8L10 5H11.5L9.5 8L11.5 11H10Z" 
      fill="currentColor" />
  </svg>
);

export const DefaultFileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 3V13H13V3H3ZM11 11H5V10H11V11ZM11 9H5V8H11V9ZM11 7H5V6H11V7ZM11 5H5V4H11V5Z" 
      fill="currentColor" />
  </svg>
);

export const DatabaseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 3C5.24 3 3 3.9 3 5V11C3 12.1 5.24 13 8 13C10.76 13 13 12.1 13 11V5C13 3.9 10.76 3 8 3ZM8 4C10.42 4 12 4.87 12 5.5C12 6.13 10.42 7 8 7C5.58 7 4 6.13 4 5.5C4 4.87 5.58 4 8 4ZM4 6.71C4.91 7.22 6.36 7.5 8 7.5C9.64 7.5 11.09 7.22 12 6.71V8.5C12 9.13 10.42 10 8 10C5.58 10 4 9.13 4 8.5V6.71ZM4 9.71C4.91 10.22 6.36 10.5 8 10.5C9.64 10.5 11.09 10.22 12 9.71V11C12 11.63 10.42 12 8 12C5.58 12 4 11.63 4 11V9.71Z" 
      fill="currentColor" />
  </svg>
);

export const PreviewIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 3C4.5 3 1.73 5.86 1 8c.73 2.14 3.5 5 7 5s6.27-2.86 7-5c-.73-2.14-3.5-5-7-5zM8 11.5c-1.38 0-2.5-1.12-2.5-2.5S6.62 6.5 8 6.5s2.5 1.12 2.5 2.5S9.38 11.5 8 11.5zM8 7.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5S8.83 7.5 8 7.5z" 
      fill="currentColor" />
  </svg>
); 
