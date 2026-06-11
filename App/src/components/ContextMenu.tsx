import React, { useEffect, useRef } from 'react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  options: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  }[];
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, options }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: y,
        left: x,
        zIndex: 1000,
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        borderRadius: '4px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
        overflow: 'hidden',
        minWidth: '150px',
      }}
    >
      {options.map((option, index) => (
        <div
          key={index}
          onClick={() => {
            if (!option.disabled) {
              option.onClick();
              onClose();
            }
          }}
          style={{
            padding: '8px 12px',
            cursor: option.disabled ? 'not-allowed' : 'shadowide',
            opacity: option.disabled ? 0.5 : 1,
            borderBottom: index < options.length - 1 ? '1px solid var(--border-color)' : 'none',
            color: 'var(--text-primary)',
            fontSize: '14px',
            userSelect: 'none',
          }}
          onMouseOver={(e) => {
            if (!option.disabled) {
              e.currentTarget.style.background = 'var(--bg-hover)';
            }
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          {option.label}
        </div>
      ))}
    </div>
  );
};

export default ContextMenu; 