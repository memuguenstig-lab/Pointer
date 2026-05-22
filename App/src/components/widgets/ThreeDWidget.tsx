import React, { useRef, useEffect } from 'react';

interface ThreeDData {
  type: 'cube' | 'sphere' | 'model' | 'scene';
  description?: string;
  code?: string;
  parameters?: Record<string, any>;
}

interface ThreeDWidgetProps {
  model: ThreeDData;
}

const ThreeDWidget: React.FC<ThreeDWidgetProps> = ({ model }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Simple 3D-like rendering using 2D canvas
    const render3D = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const size = 80;

      // Draw a simple rotating cube representation
      const time = Date.now() * 0.001;
      const rotation = time;

      ctx.strokeStyle = 'var(--accent-color)';
      ctx.lineWidth = 2;

      // Front face
      ctx.beginPath();
      ctx.moveTo(centerX - size, centerY - size);
      ctx.lineTo(centerX + size, centerY - size);
      ctx.lineTo(centerX + size, centerY + size);
      ctx.lineTo(centerX - size, centerY + size);
      ctx.closePath();
      ctx.stroke();

      // Back face (offset for 3D effect)
      const offset = 30 * Math.sin(rotation);
      ctx.beginPath();
      ctx.moveTo(centerX - size + offset, centerY - size - offset);
      ctx.lineTo(centerX + size + offset, centerY - size - offset);
      ctx.lineTo(centerX + size + offset, centerY + size - offset);
      ctx.lineTo(centerX - size + offset, centerY + size - offset);
      ctx.closePath();
      ctx.stroke();

      // Connecting lines
      ctx.beginPath();
      ctx.moveTo(centerX - size, centerY - size);
      ctx.lineTo(centerX - size + offset, centerY - size - offset);
      ctx.moveTo(centerX + size, centerY - size);
      ctx.lineTo(centerX + size + offset, centerY - size - offset);
      ctx.moveTo(centerX + size, centerY + size);
      ctx.lineTo(centerX + size + offset, centerY + size - offset);
      ctx.moveTo(centerX - size, centerY + size);
      ctx.lineTo(centerX - size + offset, centerY + size - offset);
      ctx.stroke();
    };

    const animationId = requestAnimationFrame(function animate() {
      render3D();
      requestAnimationFrame(animate);
    });

    return () => cancelAnimationFrame(animationId);
  }, []);

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      padding: '16px',
      margin: '12px 0',
      maxWidth: '400px',
      boxShadow: 'var(--shadow-sm, 0 2px 8px rgba(0,0,0,0.2))'
    }}>
      <div style={{
        fontSize: '14px',
        fontWeight: 'bold',
        color: 'var(--text-primary)',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <span>🎮</span>
        <span>3D Preview</span>
      </div>

      <canvas
        ref={canvasRef}
        width={300}
        height={200}
        style={{
          width: '100%',
          height: '200px',
          background: 'var(--bg-primary)',
          borderRadius: '4px',
          border: '1px solid var(--border-color)'
        }}
      />

      {model.description && (
        <div style={{
          marginTop: '12px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          lineHeight: '1.5'
        }}>
          {model.description}
        </div>
      )}

      {model.code && (
        <div style={{
          marginTop: '12px',
          padding: '8px',
          background: 'var(--bg-primary)',
          borderRadius: '4px',
          border: '1px solid var(--border-color)',
          fontFamily: 'monospace',
          fontSize: '11px',
          color: 'var(--text-secondary)',
          whiteSpace: 'pre-wrap',
          maxHeight: '100px',
          overflow: 'auto'
        }}>
          {model.code}
        </div>
      )}
    </div>
  );
};

export default ThreeDWidget;
