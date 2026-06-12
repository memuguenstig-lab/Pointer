export const isPreviewableFile = (filename: string): boolean => {
  return isHTMLFile(filename) || isMarkdownFile(filename);
};

export const isHTMLFile = (filename: string): boolean => {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  return ['html', 'htm'].includes(extension);
};

export const isMarkdownFile = (filename: string): boolean => {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  return ['md', 'markdown'].includes(extension);
};

export const getPreviewType = (filename: string): 'html' | 'markdown' | null => {
  if (isHTMLFile(filename)) return 'html';
  if (isMarkdownFile(filename)) return 'markdown';
  return null;
}; 
