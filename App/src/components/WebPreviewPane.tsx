import React, { useState, useEffect, useRef } from 'react';

const COMMON_PORTS = [3000, 3001, 3002, 5173, 8000, 8080];

export const WebPreviewPane: React.FC = () => {
  const [url, setUrl] = useState('http://localhost:3001/');
  const [inputUrl, setInputUrl] = useState('http://localhost:3001/');
  const [activePorts, setActivePorts] = useState<number[]>([]);
  const [iframeKey, setIframeKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Scan for active local ports
  useEffect(() => {
    const scanPorts = async () => {
      const active: number[] = [];
      for (const port of COMMON_PORTS) {
        try {
          // Use fetch with a timeout to probe
          const controller = new AbortController();
          const id = setTimeout(() => controller.abort(), 600);
          
          await fetch(`http://localhost:${port}`, {
            mode: 'no-cors',
            signal: controller.signal
          });
          clearTimeout(id);
          active.push(port);
        } catch (e) {
          // Port not active or blocked
        }
      }
      setActivePorts(active);
      // Auto-select first active port if current URL is default
      if (active.length > 0 && url === 'http://localhost:3001/' && !active.includes(3001)) {
        const firstPortUrl = `http://localhost:${active[0]}/`;
        setUrl(firstPortUrl);
        setInputUrl(firstPortUrl);
      }
    };

    scanPorts();
    const interval = setInterval(scanPorts, 10000); // scan every 10s
    return () => clearInterval(interval);
  }, []);

  // Listen to file saved events for hot reload
  useEffect(() => {
    const handleFileSaved = () => {
      console.log('WebPreviewPane: file saved event received, reloading iframe...');
      setIsLoading(true);
      setIframeKey(prev => prev + 1);
    };

    window.addEventListener('editor-file-saved', handleFileSaved);
    return () => window.removeEventListener('editor-file-saved', handleFileSaved);
  }, []);

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    let target = inputUrl.trim();
    if (!/^https?:\/\//i.test(target)) {
      target = 'http://' + target;
    }
    setUrl(target);
    setInputUrl(target);
    setIframeKey(prev => prev + 1);
  };

  const handleReload = () => {
    setIsLoading(true);
    setIframeKey(prev => prev + 1);
  };

  const handlePortSelect = (port: number) => {
    const newUrl = `http://localhost:${port}/`;
    setUrl(newUrl);
    setInputUrl(newUrl);
    setIframeKey(prev => prev + 1);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: 'var(--bg-secondary)',
      borderLeft: '1px solid var(--border-color)',
      color: 'var(--text-primary)',
      fontFamily: 'system-ui, sans-serif'
    }}>
      {/* Browser Nav Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        backgroundColor: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-color)'
      }}>
        {/* Navigation buttons */}
        <button 
          onClick={handleReload}
          title="Reload Preview"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: 16,
            padding: '4px 8px',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.05)'
          }}
        >
          🔄
        </button>

        {/* Address Bar */}
        <form onSubmit={handleNavigate} style={{ flex: 1, display: 'flex' }}>
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.2)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px 0 0 4px',
              padding: '6px 12px',
              color: 'var(--text-primary)',
              fontSize: 12,
              outline: 'none'
            }}
          />
          <button
            type="submit"
            style={{
              backgroundColor: 'var(--accent-color)',
              color: '#fff',
              border: 'none',
              borderRadius: '0 4px 4px 0',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 'bold'
            }}
          >
            Go
          </button>
        </form>

        {/* Active Ports Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Detected:</span>
          <select
            value={url.includes('localhost') ? url.match(/:(\d+)/)?.[1] || '' : ''}
            onChange={(e) => handlePortSelect(Number(e.target.value))}
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              padding: '4px 8px',
              color: 'var(--text-primary)',
              fontSize: 11,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="">(None)</option>
            {activePorts.map(port => (
              <option key={port} value={port}>Port {port}</option>
            ))}
            {!activePorts.includes(3001) && <option value="3001">Port 3001</option>}
            {!activePorts.includes(3000) && <option value="3000">Port 3000</option>}
          </select>
        </div>
      </div>

      {/* Browser Iframe viewport */}
      <div style={{ flex: 1, position: 'relative', backgroundColor: '#fff' }}>
        {isLoading && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            backgroundColor: 'var(--accent-color)',
            animation: 'pulse 1.5s infinite'
          }} />
        )}
        <iframe
          key={iframeKey}
          ref={iframeRef}
          src={url}
          onLoad={() => setIsLoading(false)}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            backgroundColor: '#ffffff'
          }}
          title="Local Web Server Preview"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
      </div>
    </div>
  );
};

export default WebPreviewPane;
