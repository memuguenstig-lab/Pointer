import React, { useState, useEffect, useRef } from 'react';
import { FileSystemItem } from '../types';
import { FileSystemService } from '../services/FileSystemService';

interface Node {
  id: string;
  x: number;
  y: number;
  label: string;
  color?: string;
  image?: string; // Base64 data URL
}

interface Edge {
  id: string;
  from: string;
  to: string;
}

interface WorkspaceData {
  nodes: Node[];
  edges: Edge[];
}

export const WorkspaceCanvasViewer: React.FC<{ file: FileSystemItem }> = ({ file }) => {
  const [data, setData] = useState<WorkspaceData>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  // Node editor state
  const [editLabel, setEditLabel] = useState('');
  const [editColor, setEditColor] = useState('#0e639c');
  
  // Edge creation state
  const [edgeSourceId, setEdgeSourceId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadWorkspace = async () => {
      try {
        setLoading(true);
        const content = await FileSystemService.readText(file.path);
        if (content) {
          const parsed = JSON.parse(content);
          setData({
            nodes: parsed.nodes || [],
            edges: parsed.edges || []
          });
        }
      } catch (e) {
        console.error('Failed to parse workspace file', e);
      } finally {
        setLoading(false);
      }
    };
    loadWorkspace();
  }, [file.path]);

  const saveWorkspace = async (updatedData: WorkspaceData) => {
    try {
      await FileSystemService.saveFile(file.path, JSON.stringify(updatedData, null, 2));
    } catch (e) {
      console.error('Failed to save workspace', e);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      setSelectedNodeId(null);
      setEdgeSourceId(null);
    }
  };

  const handleAddNode = () => {
    const text = prompt('Enter text for new node:', 'New Node');
    if (!text) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    const x = rect ? rect.width / 2 - 60 : 100;
    const y = rect ? rect.height / 2 - 30 : 100;

    const newNode: Node = {
      id: `node_${Date.now()}`,
      x,
      y,
      label: text,
      color: '#0e639c'
    };

    const updated = {
      ...data,
      nodes: [...data.nodes, newNode]
    };
    setData(updated);
    saveWorkspace(updated);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileItem = e.target.files?.[0];
    if (!fileItem) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const rect = canvasRef.current?.getBoundingClientRect();
      const x = rect ? rect.width / 2 - 80 : 100;
      const y = rect ? rect.height / 2 - 80 : 100;

      const newNode: Node = {
        id: `node_${Date.now()}`,
        x,
        y,
        label: fileItem.name,
        color: 'transparent',
        image: dataUrl
      };

      const updated = {
        ...data,
        nodes: [...data.nodes, newNode]
      };
      setData(updated);
      saveWorkspace(updated);
    };
    reader.readAsDataURL(fileItem);
  };

  const handleDeleteNode = (id: string) => {
    const updated = {
      nodes: data.nodes.filter(n => n.id !== id),
      edges: data.edges.filter(e => e.from !== id && e.to !== id)
    };
    setData(updated);
    saveWorkspace(updated);
    if (selectedNodeId === id) setSelectedNodeId(null);
    if (edgeSourceId === id) setEdgeSourceId(null);
  };

  const handleMouseDown = (node: Node, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggedNodeId(node.id);
    setSelectedNodeId(node.id);
    setEditLabel(node.label);
    setEditColor(node.color || '#0e639c');
    
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggedNodeId || !canvasRef.current) return;
    
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - canvasRect.left - dragOffset.x;
    const y = e.clientY - canvasRect.top - dragOffset.y;

    setData(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => n.id === draggedNodeId ? { ...n, x, y } : n)
    }));
  };

  const handleMouseUp = () => {
    if (draggedNodeId) {
      setDraggedNodeId(null);
      saveWorkspace(data);
    }
  };

  const handleSaveNodeEdits = () => {
    if (!selectedNodeId) return;
    const updated = {
      ...data,
      nodes: data.nodes.map(n => n.id === selectedNodeId ? { ...n, label: editLabel, color: editColor } : n)
    };
    setData(updated);
    saveWorkspace(updated);
  };

  const startConnectEdge = (id: string) => {
    setEdgeSourceId(id);
  };

  const endConnectEdge = (toId: string) => {
    if (!edgeSourceId || edgeSourceId === toId) return;
    
    // Check if edge already exists
    const exists = data.edges.some(e => e.from === edgeSourceId && e.to === toId);
    if (exists) return;

    const newEdge: Edge = {
      id: `edge_${Date.now()}`,
      from: edgeSourceId,
      to: toId
    };

    const updated = {
      ...data,
      edges: [...data.edges, newEdge]
    };
    setData(updated);
    saveWorkspace(updated);
    setEdgeSourceId(null);
  };

  const deleteEdge = (id: string) => {
    const updated = {
      ...data,
      edges: data.edges.filter(e => e.id !== id)
    };
    setData(updated);
    saveWorkspace(updated);
  };

  if (loading) {
    return (
      <div style={{ padding: 20, color: 'var(--text-secondary)', background: 'var(--bg-primary)', height: '100%' }}>
        Loading visual workspace...
      </div>
    );
  }

  const selectedNode = data.nodes.find(n => n.id === selectedNodeId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)', position: 'relative', overflow: 'hidden' }}>
      {/* Top Controls Toolbar */}
      <div style={{ padding: '8px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 12, alignItems: 'center', zIndex: 10 }}>
        <h4 style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)', marginRight: 'auto' }}>{file.name}</h4>
        
        <button
          onClick={handleAddNode}
          style={{ padding: '4px 10px', fontSize: 11, background: 'var(--accent-color)', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontWeight: 600 }}
        >
          ➕ Add Note Card
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          style={{ padding: '4px 10px', fontSize: 11, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 4, color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}
        >
          🖼️ Upload Photo
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageUpload}
          accept="image/*"
          style={{ display: 'none' }}
        />

        {edgeSourceId && (
          <span style={{ fontSize: 11, color: 'var(--accent-color)', animation: 'pulse 1.5s infinite' }}>
            ⚡ Click another node to connect...
          </span>
        )}
      </div>

      {/* Main Canvas Drawing Workspace */}
      <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
        <div
          ref={canvasRef}
          onClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{
            flex: 1,
            position: 'relative',
            background: 'radial-gradient(circle, var(--border-primary) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            backgroundColor: 'var(--bg-primary)',
            overflow: 'hidden',
            cursor: draggedNodeId ? 'grabbing' : 'default'
          }}
        >
          {/* Render Connection Lines (SVG Edges) */}
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 2 L 8 5 L 0 8 z" fill="var(--text-secondary)" />
              </marker>
            </defs>
            {data.edges.map(edge => {
              const fromNode = data.nodes.find(n => n.id === edge.from);
              const toNode = data.nodes.find(n => n.id === edge.to);
              if (!fromNode || !toNode) return null;

              // Compute center coordinates
              const fromX = fromNode.x + 60;
              const fromY = fromNode.y + 30;
              const toX = toNode.x + 60;
              const toY = toNode.y + 30;

              return (
                <g key={edge.id}>
                  <line
                    x1={fromX}
                    y1={fromY}
                    x2={toX}
                    y2={toY}
                    stroke="var(--text-secondary)"
                    strokeWidth="2"
                    markerEnd="url(#arrow)"
                    opacity="0.6"
                  />
                  {/* Small delete circle on connection line */}
                  <circle
                    cx={(fromX + toX) / 2}
                    cy={(fromY + toY) / 2}
                    r="6"
                    fill="var(--error-color)"
                    style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                    onClick={(e) => { e.stopPropagation(); deleteEdge(edge.id); }}
                  >
                    <title>Delete connection</title>
                  </circle>
                </g>
              );
            })}
          </svg>

          {/* Render Node Cards & Photo Cards */}
          {data.nodes.map(node => {
            const isSelected = selectedNodeId === node.id;
            const isSource = edgeSourceId === node.id;

            return (
              <div
                key={node.id}
                onMouseDown={(e) => handleMouseDown(node, e)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (edgeSourceId) {
                    endConnectEdge(node.id);
                  }
                }}
                style={{
                  position: 'absolute',
                  left: node.x,
                  top: node.y,
                  width: node.image ? 160 : 120,
                  minHeight: node.image ? 120 : 60,
                  borderRadius: 6,
                  background: node.color || 'var(--bg-secondary)',
                  border: isSelected ? '2px solid var(--accent-color)' : isSource ? '2px dashed var(--accent-color)' : '1px solid var(--border-color)',
                  color: '#fff',
                  padding: node.image ? '4px' : '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: draggedNodeId === node.id ? 'grabbing' : 'grab',
                  zIndex: 2,
                  boxShadow: '0 4px 10px rgba(0,0,0,0.25)',
                  userSelect: 'none',
                  fontSize: 12
                }}
              >
                {node.image ? (
                  <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                    <img
                      src={node.image}
                      alt={node.label}
                      style={{ width: '100%', height: 'auto', borderRadius: 4, display: 'block', maxHeight: 120, objectFit: 'cover' }}
                      draggable={false}
                    />
                    <div style={{ fontSize: 10, color: 'var(--text-primary)', textAlign: 'center', padding: '4px 2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {node.label}
                    </div>
                  </div>
                ) : (
                  <span style={{ textAlign: 'center', wordBreak: 'break-word', color: 'inherit' }}>{node.label}</span>
                )}

                {/* Draw Node Controls Menu when Selected */}
                {isSelected && (
                  <div style={{ position: 'absolute', top: '-28px', display: 'flex', gap: 4, background: 'var(--bg-secondary)', padding: '2px 4px', borderRadius: 4, border: '1px solid var(--border-color)', pointerEvents: 'auto' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); startConnectEdge(node.id); }}
                      style={{ fontSize: 9, padding: '2px 6px', background: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: 2, cursor: 'pointer' }}
                      title="Link to another node"
                    >
                      🔗 Link
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id); }}
                      style={{ fontSize: 9, padding: '2px 6px', background: 'var(--error-color)', color: '#fff', border: 'none', borderRadius: 2, cursor: 'pointer' }}
                      title="Delete card"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sidebar Inspector Panel for Selected Node */}
        {selectedNode && !selectedNode.image && (
          <div style={{ width: 200, borderLeft: '1px solid var(--border-color)', background: 'var(--bg-secondary)', padding: 12, display: 'flex', flexDirection: 'column', gap: 12, zIndex: 5 }}>
            <h5 style={{ margin: 0, fontSize: 12, color: 'var(--text-primary)' }}>Edit Note Card</h5>
            
            <div>
              <label style={{ display: 'block', fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>Label Text</label>
              <textarea
                value={editLabel}
                onChange={(e) => { setEditLabel(e.target.value); }}
                onBlur={handleSaveNodeEdits}
                style={{ width: '100%', height: 60, padding: 4, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: 12, borderRadius: 4, outline: 'none', resize: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>Card Color</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['#0e639c', '#3fb950', '#d29922', '#f85149', '#6e56af', '#39c5cf'].map(col => (
                  <div
                    key={col}
                    onClick={() => { setEditColor(col); setData(prev => ({ ...prev, nodes: prev.nodes.map(n => n.id === selectedNodeId ? { ...n, color: col } : n) })); saveWorkspace({ ...data, nodes: data.nodes.map(n => n.id === selectedNodeId ? { ...n, color: col } : n) }); }}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      background: col,
                      cursor: 'pointer',
                      border: editColor === col ? '2px solid #fff' : '1px solid var(--border-color)'
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

export default WorkspaceCanvasViewer;
