import React, { useMemo, useState, useRef, useEffect } from 'react';
import { RgbaColorPicker } from 'react-colorful';
import tinycolor from 'tinycolor2';

interface ColorInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  variable: string;
}

export const ColorInput: React.FC<ColorInputProps> = ({ label, value, onChange, variable }) => {
  const defaultValue = useMemo(() => getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || '#000000', [variable]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentColorObj = useMemo(() => {
    const color = value || defaultValue;
    const parsed = tinycolor(color);
    return parsed.isValid() ? parsed.toRgb() : { r: 0, g: 0, b: 0, a: 1 };
  }, [value, defaultValue]);

  const displayColorStr = useMemo(() => {
    const color = value || defaultValue;
    const parsed = tinycolor(color);
    if (!parsed.isValid()) return '#000000';
    return parsed.getAlpha() < 1 ? parsed.toRgbString() : parsed.toHexString();
  }, [value, defaultValue]);

  const updateColor = (nextColor: string) => {
    const parsed = tinycolor(nextColor);
    if (parsed.isValid()) {
      onChange(parsed.getAlpha() < 1 ? parsed.toRgbString() : parsed.toHexString());
    } else {
      onChange(nextColor);
    }
  };

  useEffect(() => {
    if (!isPickerOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPickerOpen]);

  return (
    <div ref={containerRef} style={{ marginBottom: '10px' }}>
      <label style={{ display: 'flex', alignItems: 'center', fontSize: '13px', marginBottom: '4px' }}>
        <span style={{ flex: 1 }}>{label}</span>
        <button
          type="button"
          aria-label="Open color picker"
          onClick={() => setIsPickerOpen((open) => !open)}
          style={{
            width: '22px',
            height: '22px',
            borderRadius: '4px',
            border: `1px solid var(--border-primary)`,
            background: `linear-gradient(${displayColorStr}, ${displayColorStr}), repeating-conic-gradient(#555 0% 25%, #222 0% 50%) 50% / 8px 8px`,
            cursor: 'shadowide',
            marginRight: '6px',
            padding: 0,
          }}
        />
        <input
          type="text"
          value={displayColorStr}
          onChange={(e) => updateColor(e.target.value)}
          style={{
            width: '120px',
            marginRight: '8px',
            padding: '4px 8px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            borderRadius: '4px',
            color: 'var(--text-primary)',
            fontSize: '12px',
          }}
        />
        <button
          type="button"
          onClick={() => updateColor(tinycolor(displayColorStr).lighten(10).toRgbString())}
          style={{ fontSize: '12px', padding: '4px 8px', marginRight: '4px', borderRadius: '4px', border: '1px solid var(--border-primary)', cursor: 'shadowide' }}
        >
          +
        </button>
        <button
          type="button"
          onClick={() => updateColor(tinycolor(displayColorStr).darken(10).toRgbString())}
          style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-primary)', cursor: 'shadowide' }}
        >
          -
        </button>
      </label>

      {isPickerOpen && (
        <div style={{ position: 'relative', marginTop: '6px' }}>
          <div style={{ position: 'absolute', zIndex: 200, boxShadow: '0 4px 12px rgba(0,0,0,0.25)', borderRadius: '8px', background: 'var(--bg-secondary)', padding: '6px' }}>
            <RgbaColorPicker
              color={currentColorObj}
              onChange={(newColor) => {
                const tc = tinycolor(newColor);
                onChange(tc.getAlpha() < 1 ? tc.toRgbString() : tc.toHexString());
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ColorInput; 
