'use client';

import { useEffect } from 'react';

export default function ForceDarkMode() {
  useEffect(() => {
    // Force dark mode regardless of system preference
    document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = 'dark';
    
    // Override any attempt to switch to light mode
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class' && 
            !document.documentElement.classList.contains('dark')) {
          document.documentElement.classList.add('dark');
        }
        if (mutation.attributeName === 'style' && 
            document.documentElement.style.colorScheme !== 'dark') {
          document.documentElement.style.colorScheme = 'dark';
        }
      });
    });
    
    observer.observe(document.documentElement, { 
      attributes: true,
      attributeFilter: ['class', 'style'] 
    });
    
    return () => observer.disconnect();
  }, []);
  
  return null;
} 