import React, { useState, useEffect, useRef } from 'react';
import { FileSystemItem } from '../types';
import { FileSystemService } from '../services/FileSystemService';

interface ApiRequestNode {
  id: string;
  x: number;
  y: number;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  headers: { key: string; value: string }[];
  body: string;
  outputVar?: string; // e.g. "token"
  chainFromVar?: string; // e.g. "token"
  nextRequestId?: string; // sequential execution chaining
  color?: string;
  response?: {
    status: number;
    statusText: string;
    data: any;
    time: number;
  };
}

interface ApiPlaygroundData {
  requests: ApiRequestNode[];
  variables: Record<string, string>;
}

const PALETTE = ['#1e1d28', '#0e639c', '#3fb950', '#d29922', '#f85149', '#6e56af', '#39c5cf'];

const getContrastColor = (hex: string) => {
  if (!hex || hex === 'transparent') return '#ffffff';
  const color = hex.replace('#', '');
  if (color.length !== 6) return '#ffffff';
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#0f1015' : '#ffffff';
};

export const ApiPlayground: React.FC<{ file: FileSystemItem }> = ({ file }) => {
  const [data, setData] = useState<ApiPlaygroundData>({ requests: [], variables: {} });
  const [loading, setLoading] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [activeTab, setActiveTab] = useState<'headers' | 'body' | 'response' | 'code'>('headers');

  // Sequence linking state
  const [sequenceSourceId, setSequenceSourceId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isExecutingSequence, setIsExecutingSequence] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);

  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    nodeId: string | null;
  } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, nodeId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setContextMenu({
      visible: true,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      nodeId
    });
  };

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const handleAddRequestAt = (x: number, y: number) => {
    const newRequest: ApiRequestNode = {
      id: `req_${Date.now()}`,
      x,
      y,
      name: 'New Request',
      method: 'GET',
      url: 'https://api.github.com/users/octocat',
      headers: [{ key: 'Content-Type', value: 'application/json' }],
      body: '{}',
      color: '#1e1d28'
    };

    const updated = {
      ...data,
      requests: [...data.requests, newRequest]
    };
    updateApiData(updated);
    setSelectedNodeId(newRequest.id);
  };

  // Load API data
  useEffect(() => {
    if (!file?.path) return;
    const loadApi = async () => {
      try {
        setLoading(true);
        const content = await FileSystemService.readText(file.path);
        if (content && content.trim()) {
          try {
            const parsed = JSON.parse(content);
            setData({
              requests: Array.isArray(parsed?.requests) ? parsed.requests : [],
              variables: parsed?.variables || {}
            });
            return;
          } catch (e) {
            console.error('Failed to parse api file JSON:', e);
          }
        }
        setData({ requests: [], variables: {} });
      } catch (e) {
        console.error('Failed to read api file:', e);
        setData({ requests: [], variables: {} });
      } finally {
        setLoading(false);
      }
    };
    loadApi();
  }, [file?.path]);

  const saveApi = async (updatedData: ApiPlaygroundData) => {
    if (!file?.path) return;
    try {
      await FileSystemService.saveFile(file.path, JSON.stringify(updatedData, null, 2));
    } catch (e) {
      console.error('Failed to save API data:', e);
    }
  };

  const updateApiData = (updated: ApiPlaygroundData) => {
    setData(updated);
    saveApi(updated);
  };

  const handleAddRequest = () => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const x = rect ? rect.width / 2 - 140 : 100;
    const y = rect ? rect.height / 2 - 100 : 100;

    const newRequest: ApiRequestNode = {
      id: `req_${Date.now()}`,
      x,
      y,
      name: 'New Request',
      method: 'GET',
      url: 'https://api.github.com/users/octocat',
      headers: [{ key: 'Content-Type', value: 'application/json' }],
      body: '{}',
      color: '#1e1d28'
    };

    const updated = {
      ...data,
      requests: [...data.requests, newRequest]
    };
    updateApiData(updated);
    setSelectedNodeId(newRequest.id);
  };

  const handleDeleteRequest = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = {
      ...data,
      requests: data.requests.map(r => {
        const item = { ...r };
        if (item.nextRequestId === id) {
          delete item.nextRequestId;
        }
        return item;
      }).filter(r => r.id !== id)
    };
    updateApiData(updated);
    if (selectedNodeId === id) setSelectedNodeId(null);
    if (sequenceSourceId === id) setSequenceSourceId(null);
  };

  const handleMouseDown = (node: ApiRequestNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sequenceSourceId) return;
    setDraggedNodeId(node.id);
    setSelectedNodeId(node.id);
    
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (sequenceSourceId && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      return;
    }

    if (!draggedNodeId || !canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - canvasRect.left - dragOffset.x;
    const y = e.clientY - canvasRect.top - dragOffset.y;

    setData(prev => ({
      ...prev,
      requests: prev.requests.map(r => r.id === draggedNodeId ? { ...r, x, y } : r)
    }));
  };

  const handleMouseUp = () => {
    if (draggedNodeId) {
      setDraggedNodeId(null);
      saveApi(data);
    }
  };

  const executeRequest = async (nodeId: string, currentVars: Record<string, string>): Promise<Record<string, string>> => {
    const node = data.requests.find(r => r.id === nodeId);
    if (!node) return currentVars;

    // Substitute placeholders
    let finalUrl = node.url;
    Object.entries(currentVars).forEach(([key, val]) => {
      finalUrl = finalUrl.replace(`{{${key}}}`, val);
    });

    let finalHeaders: Record<string, string> = {};
    node.headers.forEach(h => {
      if (h.key && h.value) {
        let val = h.value;
        Object.entries(currentVars).forEach(([k, v]) => {
          val = val.replace(`{{${k}}}`, v);
        });
        finalHeaders[h.key] = val;
      }
    });

    let finalBody = node.body;
    Object.entries(currentVars).forEach(([k, v]) => {
      finalBody = finalBody.replace(`{{${k}}}`, v);
    });

    const startTime = Date.now();
    let responseData: any = null;
    let status = 0;
    let statusText = 'Error';

    try {
      const fetchOpts: RequestInit = {
        method: node.method,
        headers: finalHeaders,
      };

      if (node.method !== 'GET' && node.method !== 'DELETE') {
        fetchOpts.body = finalBody;
      }

      const res = await fetch(finalUrl, fetchOpts);
      status = res.status;
      statusText = res.statusText;
      try {
        responseData = await res.json();
      } catch {
        responseData = await res.text();
      }
    } catch (err: any) {
      responseData = err.message || 'Request failed';
      statusText = 'Network Error';
    }

    const resTime = Date.now() - startTime;
    const newVars = { ...currentVars };

    if (node.outputVar && responseData && status >= 200 && status < 300) {
      const path = node.outputVar.split('.');
      let extractedVal: any = responseData;
      for (const segment of path) {
        if (extractedVal && typeof extractedVal === 'object') {
          extractedVal = extractedVal[segment];
        } else {
          extractedVal = null;
          break;
        }
      }
      if (extractedVal !== undefined && extractedVal !== null) {
        newVars[node.outputVar] = typeof extractedVal === 'object' ? JSON.stringify(extractedVal) : String(extractedVal);
      }
    }

    // Update request state locally
    setData(prev => {
      const updatedRequests = prev.requests.map(r => {
        if (r.id === nodeId) {
          return {
            ...r,
            response: {
              status,
              statusText,
              data: responseData,
              time: resTime
            }
          };
        }
        return r;
      });
      return {
        requests: updatedRequests,
        variables: newVars
      };
    });

    return newVars;
  };

  const handleRunSequence = async (startNodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExecutingSequence(true);
    let activeVars = { ...data.variables };
    let currentId: string | undefined = startNodeId;

    while (currentId) {
      const node: ApiRequestNode | undefined = data.requests.find(r => r.id === currentId);
      if (!node) break;
      activeVars = await executeRequest(currentId, activeVars);
      currentId = node.nextRequestId;
      // Small delay between chained requests
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    setIsExecutingSequence(false);
    saveApi({
      requests: data.requests,
      variables: activeVars
    });
  };

  const startConnectSequence = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSequenceSourceId(id);
    const node = data.requests.find(r => r.id === id);
    if (node) {
      setMousePos({ x: node.x + 280, y: node.y + 60 });
    }
  };

  const endConnectSequence = (toId: string) => {
    if (!sequenceSourceId || sequenceSourceId === toId) return;
    const updated = {
      ...data,
      requests: data.requests.map(r => r.id === sequenceSourceId ? { ...r, nextRequestId: toId } : r)
    };
    updateApiData(updated);
    setSequenceSourceId(null);
  };

  const deleteSequenceLink = (fromId: string) => {
    const updated = {
      ...data,
      requests: data.requests.map(r => {
        if (r.id === fromId) {
          const item = { ...r };
          delete item.nextRequestId;
          return item;
        }
        return r;
      })
    };
    updateApiData(updated);
  };

  const getCodeSnippet = (node: ApiRequestNode) => {
    if (node.method === 'GET') {
      return `fetch("${node.url}")\n  .then(res => res.json())\n  .then(console.log);`;
    }
    return `fetch("${node.url}", {\n  method: "${node.method}",\n  headers: {\n${node.headers.map(h => `    "${h.key}": "${h.value}"`).join(',\n')}\n  },\n  body: JSON.stringify(${node.body})\n})\n.then(res => res.json());`;
  };

  if (loading) {
    return <div style={{ padding: 20, color: 'var(--text-secondary)' }}>Loading API Playground...</div>;
  }

  const selectedNode = data.requests.find(r => r.id === selectedNodeId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)', overflow: 'hidden' }}>
      {/* Top Controls Toolbar */}
      <div style={{ padding: '8px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 12, alignItems: 'center', zIndex: 10 }}>
        <h4 style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)' }}>🔌 API Playground: {file.name}</h4>
        
        <button
          onClick={handleAddRequest}
          style={{ padding: '4px 10px', fontSize: 11, background: 'var(--accent-color)', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontWeight: 600 }}
        >
          ➕ Add Request Card
        </button>

        {sequenceSourceId && (
          <span style={{ fontSize: 11, color: 'var(--accent-color)', animation: 'pulse 1.5s infinite' }}>
            ⚡ Click another card to chain sequence...
          </span>
        )}

        {Object.keys(data.variables).length > 0 && (
          <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-secondary)', marginLeft: 'auto' }}>
            <strong>Chained Variables:</strong>
            {Object.entries(data.variables).map(([k, v]) => (
              <span key={k} style={{ background: '#0e639c44', color: '#58a6ff', padding: '1px 6px', borderRadius: 4, border: '1px solid #0e639c88' }}>
                {k}: {v.substring(0, 10)}{v.length > 10 ? '...' : ''}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Main Sandbox Area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={() => { setSequenceSourceId(null); setSelectedNodeId(null); }}
          onContextMenu={(e) => handleContextMenu(e, null)}
          style={{
            flex: 1,
            position: 'relative',
            background: 'radial-gradient(circle, var(--border-primary) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            backgroundColor: 'var(--bg-primary)',
            overflow: 'auto',
            minHeight: '100%'
          }}
        >
          {/* SVG Connection Lines for Sequential flow */}
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
            <defs>
              <marker id="api-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 2 L 8 5 L 0 8 z" fill="#3b82f6" />
              </marker>
            </defs>

            {/* Live draft sequence link */}
            {sequenceSourceId && (() => {
              const srcNode = data.requests.find(r => r.id === sequenceSourceId);
              if (!srcNode) return null;
              return (
                <line
                  x1={srcNode.x + 280}
                  y1={srcNode.y + 60}
                  x2={mousePos.x}
                  y2={mousePos.y}
                  stroke="#3b82f6"
                  strokeWidth="2.5"
                  strokeDasharray="4 4"
                  opacity="0.8"
                />
              );
            })()}

            {/* Saved links */}
            {data.requests.map(req => {
              if (!req.nextRequestId) return null;
              const targetNode = data.requests.find(r => r.id === req.nextRequestId);
              if (!targetNode) return null;

              const startX = req.x + 280;
              const startY = req.y + 60;
              const endX = targetNode.x;
              const endY = targetNode.y + 60;

              const midX = (startX + endX) / 2;
              const midY = (startY + endY) / 2;

              return (
                <g key={`seq_${req.id}`}>
                  <line
                    x1={startX}
                    y1={startY}
                    x2={endX}
                    y2={endY}
                    stroke="#3b82f6"
                    strokeWidth="2.5"
                    markerEnd="url(#api-arrow)"
                    opacity="0.8"
                  />
                  <circle
                    cx={midX}
                    cy={midY}
                    r="6"
                    fill="#ef4444"
                    style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                    onClick={(e) => { e.stopPropagation(); deleteSequenceLink(req.id); }}
                  >
                    <title>Delete sequence link</title>
                  </circle>
                </g>
              );
            })}
          </svg>

          {/* Render Request Cards */}
          {data.requests.map(node => {
            const isSelected = selectedNodeId === node.id;
            const hasSuccess = node.response && node.response.status >= 200 && node.response.status < 300;
            const hasErr = node.response && (node.response.status === 0 || node.response.status >= 400);

            const cardColor = node.color || '#1e1d28';
            const textColor = getContrastColor(cardColor);

            return (
              <div
                key={node.id}
                onMouseDown={(e) => handleMouseDown(node, e)}
                onContextMenu={(e) => handleContextMenu(e, node.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (sequenceSourceId) {
                    endConnectSequence(node.id);
                  }
                }}
                style={{
                  position: 'absolute',
                  left: node.x,
                  top: node.y,
                  width: 280,
                  borderRadius: 8,
                  background: cardColor,
                  border: isSelected ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                  color: textColor,
                  padding: '12px',
                  cursor: draggedNodeId === node.id ? 'grabbing' : 'grab',
                  zIndex: 2,
                  boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                    {node.name}
                  </span>
                  <div style={{ display: 'flex', gap: 4, pointerEvents: 'auto' }}>
                    <button
                      onClick={(e) => handleRunSequence(node.id, e)}
                      disabled={isExecutingSequence}
                      style={{ padding: '2px 8px', fontSize: 10, background: '#3fb950', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontWeight: 600 }}
                    >
                      ▶ Run
                    </button>
                    <button
                      onClick={(e) => handleDeleteRequest(node.id, e)}
                      style={{ padding: '2px 4px', fontSize: 10, background: '#f85149', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 'bold',
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: node.method === 'GET' ? '#2ea04333' : node.method === 'POST' ? '#005cc533' : '#d2992233',
                    color: node.method === 'GET' ? '#56d364' : node.method === 'POST' ? '#79c0ff' : '#e3b341'
                  }}>
                    {node.method}
                  </span>
                  <span style={{ fontSize: 11, opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {node.url}
                  </span>
                </div>

                {node.response && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 10,
                    background: 'rgba(0,0,0,0.2)',
                    padding: '4px 8px',
                    borderRadius: 4,
                    border: hasSuccess ? '1px solid #2ea043' : hasErr ? '1px solid #f85149' : '1px solid var(--border-color)',
                  }}>
                    <span style={{ color: hasSuccess ? '#56d364' : hasErr ? '#ff7b72' : 'inherit' }}>
                      Status: {node.response.status}
                    </span>
                    <span style={{ opacity: 0.8 }}>
                      {node.response.time}ms
                    </span>
                  </div>
                )}

                {/* Draw Node Controls Menu when Selected */}
                {isSelected && (
                  <div style={{ position: 'absolute', top: '-28px', left: 4, display: 'flex', gap: 4, background: 'var(--bg-secondary)', padding: '2px 4px', borderRadius: 4, border: '1px solid var(--border-color)', pointerEvents: 'auto' }}>
                    <button
                      onClick={(e) => startConnectSequence(node.id, e)}
                      style={{ fontSize: 9, padding: '2px 6px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 2, cursor: 'pointer' }}
                      title="Link to next request"
                    >
                      🔗 Link Sequence
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Custom Right-Click Context Menu */}
          {contextMenu && contextMenu.visible && (
            <div style={{
              position: 'absolute',
              left: contextMenu.x,
              top: contextMenu.y,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              padding: '4px 0',
              minWidth: 160,
              zIndex: 1000,
              fontSize: 12,
              color: 'var(--text-primary)',
              pointerEvents: 'auto'
            }}>
              <style>{`
                .ctx-menu-item {
                  padding: 6px 12px;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  transition: background 0.15s, color 0.15s;
                }
                .ctx-menu-item:hover {
                  background: var(--bg-hover);
                  color: var(--accent-color);
                }
              `}</style>
              {contextMenu.nodeId ? (
                <>
                  <div onClick={() => startConnectSequence(contextMenu.nodeId!, null as any)} className="ctx-menu-item">
                    🔗 Connect Sequence Link
                  </div>
                  <div onClick={() => {
                    setSelectedNodeId(contextMenu.nodeId);
                  }} className="ctx-menu-item">
                    📝 Edit Request
                  </div>
                  <div onClick={(e) => handleDeleteRequest(contextMenu.nodeId!, e as any)} className="ctx-menu-item" style={{ color: 'var(--error-color)' }}>
                    🗑️ Delete Request
                  </div>
                </>
              ) : (
                <>
                  <div onClick={() => handleAddRequestAt(contextMenu.x, contextMenu.y)} className="ctx-menu-item">
                    ➕ Add Request Card
                  </div>
                  <div onClick={() => {
                    if (data.requests.length > 0) {
                      handleRunSequence(data.requests[0].id, null as any);
                    }
                  }} className="ctx-menu-item">
                    ▶ Run All Requests
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Sidebar request inspector */}
        {selectedNode && (
          <div style={{ width: 320, borderLeft: '1px solid var(--border-color)', background: 'var(--bg-secondary)', padding: '16px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
            <h4 style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)' }}>Request Settings</h4>

            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Request Name</label>
              <input
                type="text"
                value={selectedNode.name}
                onChange={(e) => {
                  const updated = data.requests.map(r => r.id === selectedNode.id ? { ...r, name: e.target.value } : r);
                  updateApiData({ ...data, requests: updated });
                }}
                style={{ width: '100%', padding: '6px', fontSize: 12, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 4 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ width: 80 }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Method</label>
                <select
                  value={selectedNode.method}
                  onChange={(e) => {
                    const updated = data.requests.map(r => r.id === selectedNode.id ? { ...r, method: e.target.value as any } : r);
                    updateApiData({ ...data, requests: updated });
                  }}
                  style={{ width: '100%', padding: '6px', fontSize: 12, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 4 }}
                >
                  <option>GET</option>
                  <option>POST</option>
                  <option>PUT</option>
                  <option>DELETE</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Endpoint URL</label>
                <input
                  type="text"
                  value={selectedNode.url}
                  onChange={(e) => {
                    const updated = data.requests.map(r => r.id === selectedNode.id ? { ...r, url: e.target.value } : r);
                    updateApiData({ ...data, requests: updated });
                  }}
                  style={{ width: '100%', padding: '6px', fontSize: 12, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 4 }}
                />
              </div>
            </div>

            {/* Request tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
              {['headers', 'body', 'response', 'code'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  style={{
                    flex: 1,
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === tab ? '2px solid var(--accent-color)' : 'none',
                    color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                    padding: '6px 0',
                    fontSize: 11,
                    cursor: 'pointer',
                    textTransform: 'capitalize'
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === 'headers' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Headers</span>
                  <button
                    onClick={() => {
                      const updated = data.requests.map(r => {
                        if (r.id === selectedNode.id) {
                          return { ...r, headers: [...(r.headers || []), { key: '', value: '' }] };
                        }
                        return r;
                      });
                      updateApiData({ ...data, requests: updated });
                    }}
                    style={{ background: 'none', border: 'none', color: '#58a6ff', fontSize: 10, cursor: 'pointer' }}
                  >
                    + Add Header
                  </button>
                </div>
                {(selectedNode.headers || []).map((h, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 6 }}>
                    <input
                      placeholder="Header Name"
                      value={h.key}
                      onChange={(e) => {
                        const updatedHeaders = [...selectedNode.headers];
                        updatedHeaders[idx].key = e.target.value;
                        const updated = data.requests.map(r => r.id === selectedNode.id ? { ...r, headers: updatedHeaders } : r);
                        updateApiData({ ...data, requests: updated });
                      }}
                      style={{ flex: 1, padding: '4px', fontSize: 11, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 4 }}
                    />
                    <input
                      placeholder="Value (e.g. {{token}})"
                      value={h.value}
                      onChange={(e) => {
                        const updatedHeaders = [...selectedNode.headers];
                        updatedHeaders[idx].value = e.target.value;
                        const updated = data.requests.map(r => r.id === selectedNode.id ? { ...r, headers: updatedHeaders } : r);
                        updateApiData({ ...data, requests: updated });
                      }}
                      style={{ flex: 1, padding: '4px', fontSize: 11, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 4 }}
                    />
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'body' && (
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Raw JSON Body</label>
                <textarea
                  value={selectedNode.body}
                  onChange={(e) => {
                    const updated = data.requests.map(r => r.id === selectedNode.id ? { ...r, body: e.target.value } : r);
                    updateApiData({ ...data, requests: updated });
                  }}
                  style={{ width: '100%', height: 120, fontFamily: 'monospace', fontSize: 11, padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 4, resize: 'none' }}
                />
              </div>
            )}

            {activeTab === 'response' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Extract value to variable:</label>
                  <input
                    placeholder="Variable Key (e.g. token)"
                    value={selectedNode.outputVar || ''}
                    onChange={(e) => {
                      const updated = data.requests.map(r => r.id === selectedNode.id ? { ...r, outputVar: e.target.value } : r);
                      updateApiData({ ...data, requests: updated });
                    }}
                    style={{ width: '100%', padding: '4px', fontSize: 11, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 4 }}
                  />
                </div>

                <div style={{ flex: 1, minHeight: 120, background: '#0f1015', border: '1px solid #2e303f', borderRadius: 4, padding: 8, overflow: 'auto' }}>
                  <pre style={{ margin: 0, fontSize: 10, color: '#a6accd', fontFamily: 'monospace' }}>
                    {selectedNode.response 
                      ? JSON.stringify(selectedNode.response.data, null, 2)
                      : 'No response data yet. Click Send!'}
                  </pre>
                </div>
              </div>
            )}

            {activeTab === 'code' && (
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>JavaScript Code Snippet</label>
                <div style={{ background: '#0f1015', border: '1px solid #2e303f', borderRadius: 4, padding: 8, overflow: 'auto' }}>
                  <pre style={{ margin: 0, fontSize: 10, color: '#f78c6c', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                    {getCodeSnippet(selectedNode)}
                  </pre>
                </div>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Card Color</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {PALETTE.map(col => (
                  <div
                    key={col}
                    onClick={() => {
                      const updated = data.requests.map(r => r.id === selectedNode.id ? { ...r, color: col } : r);
                      updateApiData({ ...data, requests: updated });
                    }}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 4,
                      background: col,
                      cursor: 'pointer',
                      border: selectedNode.color === col ? '2px solid #fff' : '1px solid var(--border-color)'
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiPlayground;
