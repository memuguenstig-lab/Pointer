import React, { useState, useEffect, useRef } from 'react';
import { FileSystemItem } from '../types';
import { FileSystemService } from '../services/FileSystemService';

interface Metric {
  label: string;
  value: number; // numeric value for charts
  color?: string;
}

interface TaskItem {
  id: string;
  text: string;
  done: boolean;
}

interface Node {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  label: string; // Card Title
  color?: string;
  image?: string; // Base64 data URL
  video?: string; // Base64 data URL for video
  showLabel?: boolean;
  zoom?: number;
  panX?: number;
  panY?: number;
  type?: 'text' | 'stat' | 'tasklist' | 'link' | 'code';
  chartType?: 'bar' | 'column' | 'pie';
  metrics?: Metric[];
  tasks?: TaskItem[];
  linkUrl?: string;
  codeLanguage?: string;
  codeContent?: string;
}

interface Edge {
  id: string;
  from: string;
  to: string;
  controlX?: number;
  controlY?: number;
}

interface Stroke {
  points: { x: number; y: number }[];
  color: string;
}

interface WorkspaceData {
  nodes: Node[];
  edges: Edge[];
  drawings?: Stroke[];
}

const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function getContrastColor(hexColor: string): string {
  if (!hexColor || hexColor === 'transparent') return '#ffffff';
  let color = hexColor.trim();
  if (color.startsWith('#')) {
    color = color.substring(1);
  }
  if (color.length === 3) {
    color = color.split('').map(char => char + char).join('');
  }
  if (color.length !== 6) {
    if (color.startsWith('rgb')) {
      const match = color.match(/\d+/g);
      if (match && match.length >= 3) {
        const r = parseInt(match[0], 10);
        const g = parseInt(match[1], 10);
        const b = parseInt(match[2], 10);
        const yiq = (r * 299 + g * 587 + b * 114) / 1000;
        return yiq >= 128 ? '#111827' : '#ffffff';
      }
    }
    return '#ffffff';
  }
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#111827' : '#ffffff';
}

export const WorkspaceCanvasViewer: React.FC<{ file: FileSystemItem }> = ({ file }) => {
  const [data, setData] = useState<WorkspaceData>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Resize State
  const [resizingNodeId, setResizingNodeId] = useState<string | null>(null);
  const [initialResizeSize, setInitialResizeSize] = useState({ width: 0, height: 0 });
  const [initialResizePos, setInitialResizePos] = useState({ x: 0, y: 0 });

  // Edge control point dragging
  const [draggedEdgeId, setDraggedEdgeId] = useState<string | null>(null);

  // Drawing Tool State
  const [toolMode, setToolMode] = useState<'select' | 'pen'>('select');
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[]>([]);
  const [penColor, setPenColor] = useState('#ef4444');
  
  // Undo/Redo History state
  const [history, setHistory] = useState<WorkspaceData[]>([]);

  // Node editor state (sidebar bindings)
  const [editLabel, setEditLabel] = useState('');
  const [editColor, setEditColor] = useState('#0e639c');
  const [editLinkUrl, setEditLinkUrl] = useState('');
  const [editCodeLanguage, setEditCodeLanguage] = useState('javascript');
  const [editCodeContent, setEditCodeContent] = useState('');
  const [editChartType, setEditChartType] = useState<'bar' | 'column' | 'pie'>('bar');
  
  // Edge creation state
  const [edgeSourceId, setEdgeSourceId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // New Card Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCardType, setNewCardType] = useState<'text' | 'stat' | 'tasklist' | 'link' | 'code'>('text');
  const [newCardLabel, setNewCardLabel] = useState('');
  const [newCardColor, setNewCardColor] = useState('#1e1d28');
  const [newCardLinkUrl, setNewCardLinkUrl] = useState('');
  const [newCardCodeLanguage, setNewCardCodeLanguage] = useState('javascript');
  const [newCardCodeContent, setNewCardCodeContent] = useState('');
  const [newCardChartType, setNewCardChartType] = useState<'bar' | 'column' | 'pie'>('bar');

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    nodeId: string | null;
  } | null>(null);

  const [uploadPos, setUploadPos] = useState<{ x: number; y: number } | null>(null);

  const pushHistory = (currentState: WorkspaceData) => {
    setHistory(prev => [...prev.slice(-29), JSON.parse(JSON.stringify(currentState))]);
  };

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

  useEffect(() => {
    if (!file?.path) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        const activeTag = document.activeElement?.tagName;
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;
        
        e.preventDefault();
        setHistory(prev => {
          if (prev.length === 0) return prev;
          const newHistory = [...prev];
          const previousState = newHistory.pop()!;
          setData(previousState);
          FileSystemService.saveFile(file.path, JSON.stringify(previousState, null, 2)).catch(console.error);
          return newHistory;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history, data, file?.path]);

  useEffect(() => {
    if (!file?.path) return;
    const loadWorkspace = async () => {
      try {
        setLoading(true);
        const content = await FileSystemService.readText(file.path);
        if (content && content.trim()) {
          try {
            const parsed = JSON.parse(content);
            setData({
              nodes: Array.isArray(parsed?.nodes) ? parsed.nodes : [],
              edges: Array.isArray(parsed?.edges) ? parsed.edges : [],
              drawings: Array.isArray(parsed?.drawings) ? parsed.drawings : []
            });
            return;
          } catch (jsonErr) {
            console.error('Failed to parse workspace JSON:', jsonErr);
          }
        }
        setData({ nodes: [], edges: [], drawings: [] });
      } catch (e) {
        console.error('Failed to read workspace file:', e);
        setData({ nodes: [], edges: [], drawings: [] });
      } finally {
        setLoading(false);
      }
    };
    loadWorkspace();
  }, [file?.path]);

  const saveWorkspace = async (updatedData: WorkspaceData) => {
    if (!file?.path) return;
    try {
      await FileSystemService.saveFile(file.path, JSON.stringify(updatedData, null, 2));
    } catch (e) {
      console.error('Failed to save workspace', e);
    }
  };

  const updateWorkspaceData = (updated: WorkspaceData) => {
    pushHistory(data);
    setData(updated);
    saveWorkspace(updated);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (toolMode === 'pen' && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      setIsDrawing(true);
      setCurrentStroke([pt]);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      setSelectedNodeId(null);
      setEdgeSourceId(null);
    }
  };

  const openAddCardModal = () => {
    setNewCardLabel('New Card');
    setNewCardColor('#1e1d28');
    setNewCardType('text');
    setNewCardLinkUrl('https://');
    setNewCardCodeLanguage('javascript');
    setNewCardCodeContent('// write code here');
    setNewCardChartType('bar');
    setIsModalOpen(true);
  };

  const handleCreateCard = () => {
    if (!newCardLabel.trim()) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    const x = rect ? rect.width / 2 - 90 : 100;
    const y = rect ? rect.height / 2 - 70 : 100;

    let defaultWidth = 160;
    let defaultHeight = 110;

    if (newCardType === 'stat') {
      defaultWidth = 240;
      defaultHeight = 180;
    } else if (newCardType === 'code') {
      defaultWidth = 260;
      defaultHeight = 160;
    } else if (newCardType === 'tasklist') {
      defaultWidth = 200;
      defaultHeight = 160;
    }

    const newNode: Node = {
      id: `node_${Date.now()}`,
      x,
      y,
      width: defaultWidth,
      height: defaultHeight,
      label: newCardLabel,
      color: newCardColor,
      type: newCardType,
      chartType: newCardType === 'stat' ? newCardChartType : undefined,
      linkUrl: newCardType === 'link' ? newCardLinkUrl : undefined,
      codeLanguage: newCardType === 'code' ? newCardCodeLanguage : undefined,
      codeContent: newCardType === 'code' ? newCardCodeContent : undefined,
      metrics: newCardType === 'stat' ? [
        { label: 'Q1 Sales', value: 350 },
        { label: 'Q2 Sales', value: 520 },
        { label: 'Q3 Sales', value: 410 }
      ] : undefined,
      tasks: newCardType === 'tasklist' ? [
        { id: `t_1`, text: 'Task 1', done: false },
        { id: `t_2`, text: 'Task 2', done: true }
      ] : undefined
    };

    const updated = {
      ...data,
      nodes: [...data.nodes, newNode]
    };
    updateWorkspaceData(updated);
    setIsModalOpen(false);
  };

  const addNewCardAt = (type: 'text' | 'stat' | 'tasklist' | 'link' | 'code', x: number, y: number) => {
    let defaultWidth = 140;
    let defaultHeight = 90;
    if (type === 'stat') {
      defaultWidth = 180;
      defaultHeight = 110;
    } else if (type === 'code') {
      defaultWidth = 200;
      defaultHeight = 160;
    } else if (type === 'tasklist') {
      defaultWidth = 150;
      defaultHeight = 130;
    }

    const newNode: Node = {
      id: `node_${Date.now()}`,
      x,
      y,
      width: defaultWidth,
      height: defaultHeight,
      label: type === 'text' ? 'New text card' : type === 'stat' ? 'New Statistik' : type === 'tasklist' ? 'New Checkliste' : type === 'link' ? 'New Bookmark' : 'New Code',
      color: '#1e1d28',
      type: type,
      metrics: type === 'stat' ? [
        { label: 'Metric A', value: 30 },
        { label: 'Metric B', value: 70 }
      ] : undefined,
      tasks: type === 'tasklist' ? [
        { id: `t_1`, text: 'Task A', done: false }
      ] : undefined
    };

    updateWorkspaceData({
      ...data,
      nodes: [...data.nodes, newNode]
    });
  };

  const handleMediaUpload = (type: 'image' | 'video', e: React.ChangeEvent<HTMLInputElement>) => {
    const fileItem = e.target.files?.[0];
    if (!fileItem) return;

    if (selectedNodeId) {
      const node = data.nodes.find(n => n.id === selectedNodeId);
      if (node && (node.image || node.video)) {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const updated = data.nodes.map(n => n.id === selectedNodeId ? {
            ...n,
            image: type === 'image' ? dataUrl : undefined,
            video: type === 'video' ? dataUrl : undefined,
            label: fileItem.name
          } : n);
          updateWorkspaceData({ ...data, nodes: updated });
        };
        reader.readAsDataURL(fileItem);
        return;
      }
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const x = uploadPos ? uploadPos.x : 100;
      const y = uploadPos ? uploadPos.y : 100;

      const newNode: Node = {
        id: `node_${Date.now()}`,
        x,
        y,
        width: 200,
        height: 150,
        label: fileItem.name,
        color: 'transparent',
        image: type === 'image' ? dataUrl : undefined,
        video: type === 'video' ? dataUrl : undefined,
        showLabel: false,
        zoom: 1,
        panX: 0,
        panY: 0
      };

      updateWorkspaceData({
        ...data,
        nodes: [...data.nodes, newNode]
      });
      setUploadPos(null);
    };
    reader.readAsDataURL(fileItem);
  };

  const handleDeleteNode = (id: string) => {
    const updated = {
      ...data,
      nodes: data.nodes.filter(n => n.id !== id),
      edges: data.edges.filter(e => e.from !== id && e.to !== id)
    };
    updateWorkspaceData(updated);
    if (selectedNodeId === id) setSelectedNodeId(null);
    if (edgeSourceId === id) setEdgeSourceId(null);
  };

  const handleMouseDown = (node: Node, e: React.MouseEvent) => {
    e.stopPropagation();
    if (toolMode === 'pen') return;
    pushHistory(data);
    setDraggedNodeId(node.id);
    setSelectedNodeId(node.id);
    setEditLabel(node.label);
    setEditColor(node.color || '#0e639c');
    setEditLinkUrl(node.linkUrl || '');
    setEditCodeLanguage(node.codeLanguage || 'javascript');
    setEditCodeContent(node.codeContent || '');
    setEditChartType(node.chartType || 'bar');
    
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleResizeStart = (node: Node, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setResizingNodeId(node.id);
    setSelectedNodeId(node.id);
    setInitialResizeSize({
      width: node.width || 140,
      height: node.height || 90
    });
    setInitialResizePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (toolMode === 'pen' && isDrawing && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      setCurrentStroke(prev => [...prev, pt]);
      return;
    }

    if (resizingNodeId) {
      const deltaX = e.clientX - initialResizePos.x;
      const deltaY = e.clientY - initialResizePos.y;
      const newWidth = Math.max(120, initialResizeSize.width + deltaX);
      const newHeight = Math.max(60, initialResizeSize.height + deltaY);
      
      setData(prev => ({
        ...prev,
        nodes: prev.nodes.map(n => n.id === resizingNodeId ? { ...n, width: newWidth, height: newHeight } : n)
      }));
      return;
    }

    if (draggedEdgeId && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      setData(prev => {
        const edge = prev.edges.find(eg => eg.id === draggedEdgeId);
        if (!edge) return prev;
        
        const fromNode = prev.nodes.find(n => n.id === edge.from);
        const toNode = prev.nodes.find(n => n.id === edge.to);
        if (!fromNode || !toNode) return prev;

        const fromWidth = fromNode.width || 140;
        const fromHeight = fromNode.height || 90;
        const toWidth = toNode.width || 140;
        const toHeight = toNode.height || 90;

        const startX = fromNode.x + fromWidth / 2;
        const startY = fromNode.y + fromHeight / 2;
        const toX = toNode.x + toWidth / 2;
        const toY = toNode.y + toHeight / 2;

        const midX = (startX + toX) / 2;
        const midY = (startY + toY) / 2;

        const newCtrlX = 2 * mouseX - midX;
        const newCtrlY = 2 * mouseY - midY;

        return {
          ...prev,
          edges: prev.edges.map(eg => eg.id === draggedEdgeId ? { ...eg, controlX: newCtrlX, controlY: newCtrlY } : eg)
        };
      });
      return;
    }

    if (edgeSourceId && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }

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
    if (toolMode === 'pen' && isDrawing) {
      setIsDrawing(false);
      if (currentStroke.length > 1) {
        const newStroke: Stroke = { points: currentStroke, color: penColor };
        updateWorkspaceData({
          ...data,
          drawings: [...(data.drawings || []), newStroke]
        });
      }
      setCurrentStroke([]);
    }

    if (draggedNodeId || resizingNodeId || draggedEdgeId) {
      setDraggedNodeId(null);
      setResizingNodeId(null);
      setDraggedEdgeId(null);
      saveWorkspace(data);
    }
  };

  const handleSaveNodeEdits = () => {
    if (!selectedNodeId) return;
    const updated = {
      ...data,
      nodes: data.nodes.map(n => n.id === selectedNodeId ? { 
        ...n, 
        label: editLabel, 
        color: editColor,
        chartType: n.type === 'stat' ? editChartType : undefined,
        linkUrl: n.type === 'link' ? editLinkUrl : undefined,
        codeLanguage: n.type === 'code' ? editCodeLanguage : undefined,
        codeContent: n.type === 'code' ? editCodeContent : undefined
      } : n)
    };
    updateWorkspaceData(updated);
  };

  const startConnectEdge = (id: string) => {
    setEdgeSourceId(id);
    const node = data.nodes.find(n => n.id === id);
    if (node) {
      setMousePos({ x: node.x + (node.width || 140) / 2, y: node.y + (node.height || 90) / 2 });
    }
  };

  const endConnectEdge = (toId: string) => {
    if (!edgeSourceId || edgeSourceId === toId) return;
    
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
    updateWorkspaceData(updated);
    setEdgeSourceId(null);
  };

  const deleteEdge = (id: string) => {
    const updated = {
      ...data,
      edges: data.edges.filter(e => e.id !== id)
    };
    updateWorkspaceData(updated);
  };

  const toggleTask = (nodeId: string, taskId: string) => {
    const updatedNodes = data.nodes.map(n => {
      if (n.id === nodeId && n.tasks) {
        return {
          ...n,
          tasks: n.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t)
        };
      }
      return n;
    });
    updateWorkspaceData({ ...data, nodes: updatedNodes });
  };

  const clearDrawings = () => {
    updateWorkspaceData({
      ...data,
      drawings: []
    });
  };

  if (!file) {
    return <div style={{ padding: 20, color: 'var(--text-secondary)' }}>No workspace selected</div>;
  }

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
        <h4 style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)' }}>{file.name}</h4>
        
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: 2, borderRadius: 6, border: '1px solid var(--border-color)' }}>
          <button
            onClick={() => setToolMode('select')}
            style={{
              padding: '4px 8px', fontSize: 11, border: 'none', borderRadius: 4,
              background: toolMode === 'select' ? 'var(--accent-color)' : 'transparent',
              color: '#fff', cursor: 'pointer'
            }}
          >
            🖱️ Select Mode
          </button>
          <button
            onClick={() => setToolMode('pen')}
            style={{
              padding: '4px 8px', fontSize: 11, border: 'none', borderRadius: 4,
              background: toolMode === 'pen' ? 'var(--accent-color)' : 'transparent',
              color: '#fff', cursor: 'pointer'
            }}
          >
            ✏️ Pen Draw
          </button>
        </div>

        {toolMode === 'pen' && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {['#ef4444', '#3fb950', '#f59e0b', '#3b82f6', '#fff'].map(col => (
              <div
                key={col}
                onClick={() => setPenColor(col)}
                style={{
                  width: 14, height: 14, borderRadius: '50%', background: col, cursor: 'pointer',
                  border: penColor === col ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)'
                }}
              />
            ))}
            <button
              onClick={clearDrawings}
              style={{ padding: '2px 8px', fontSize: 10, background: '#f85149', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}
            >
              🧹 Clear Drawings
            </button>
          </div>
        )}

        <button
          onClick={openAddCardModal}
          style={{ padding: '4px 10px', fontSize: 11, background: 'var(--accent-color)', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontWeight: 600, marginLeft: 'auto' }}
        >
          ➕ Add Card
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
          onChange={e => handleMediaUpload('image', e)}
          accept="image/*"
          style={{ display: 'none' }}
        />
        <input
          type="file"
          ref={videoInputRef}
          onChange={e => handleMediaUpload('video', e)}
          accept="video/*"
          style={{ display: 'none' }}
        />

        {edgeSourceId && (
          <span style={{ fontSize: 11, color: 'var(--accent-color)', animation: 'pulse 1.5s infinite' }}>
            ⚡ Click another card to link...
          </span>
        )}
      </div>

      {/* Main Canvas Drawing Workspace */}
      <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
        <div
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDown}
          onClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onContextMenu={(e) => handleContextMenu(e, null)}
          style={{
            flex: 1,
            position: 'relative',
            background: 'radial-gradient(circle, var(--border-primary) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            backgroundColor: 'var(--bg-primary)',
            overflow: 'hidden',
            cursor: toolMode === 'pen' ? 'crosshair' : draggedNodeId ? 'grabbing' : 'default'
          }}
        >
          {/* Render Connections & Drawings in SVG layer */}
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 2 L 8 5 L 0 8 z" fill="var(--text-secondary)" />
              </marker>
            </defs>

            {/* Render Pen Drawings */}
            {(data.drawings || []).map((stroke, idx) => {
              if (stroke.points.length < 2) return null;
              const d = stroke.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
              return (
                <path
                  key={`stroke_${idx}`}
                  d={d}
                  fill="none"
                  stroke={stroke.color}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })}

            {/* Active Drawing Stroke */}
            {currentStroke.length > 1 && (() => {
              const d = currentStroke.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
              return (
                <path
                  d={d}
                  fill="none"
                  stroke={penColor}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })()}

            {/* Realtime connecting mouse draft line */}
            {edgeSourceId && (() => {
              const srcNode = data.nodes.find(n => n.id === edgeSourceId);
              if (!srcNode) return null;
              const startX = srcNode.x + (srcNode.width || 140) / 2;
              const startY = srcNode.y + (srcNode.height || 90) / 2;
              return (
                <line
                  x1={startX}
                  y1={startY}
                  x2={mousePos.x}
                  y2={mousePos.y}
                  stroke="var(--accent-color)"
                  strokeWidth="2.5"
                  strokeDasharray="4 4"
                  opacity="0.8"
                />
              );
            })()}

            {/* Connections / Edges with drag bend control point */}
            {data.edges.map(edge => {
              const fromNode = data.nodes.find(n => n.id === edge.from);
              const toNode = data.nodes.find(n => n.id === edge.to);
              if (!fromNode || !toNode) return null;

              const fromWidth = fromNode.width || 140;
              const fromHeight = fromNode.height || 90;
              const toWidth = toNode.width || 140;
              const toHeight = toNode.height || 90;

              const startX = fromNode.x + fromWidth / 2;
              const startY = fromNode.y + fromHeight / 2;
              const toX = toNode.x + toWidth / 2;
              const toY = toNode.y + toHeight / 2;

              const midX = (startX + toX) / 2;
              const midY = (startY + toY) / 2;

              const ctrlX = edge.controlX !== undefined ? edge.controlX : midX;
              const ctrlY = edge.controlY !== undefined ? edge.controlY : midY;

              const dPath = `M ${startX} ${startY} Q ${ctrlX} ${ctrlY} ${toX} ${toY}`;

              const midCurveX = 0.25 * startX + 0.5 * ctrlX + 0.25 * toX;
              const midCurveY = 0.25 * startY + 0.5 * ctrlY + 0.25 * toY;

              const isHovered = hoveredEdgeId === edge.id || draggedEdgeId === edge.id;

              return (
                <g 
                  key={edge.id}
                  onMouseEnter={() => setHoveredEdgeId(edge.id)}
                  onMouseLeave={() => setHoveredEdgeId(null)}
                >
                  <path
                    d={dPath}
                    fill="none"
                    stroke="var(--text-secondary)"
                    strokeWidth="2.5"
                    markerEnd="url(#arrow)"
                    opacity="0.75"
                  />
                  
                  {/* Draggable bend point handle */}
                  <circle
                    cx={midCurveX}
                    cy={midCurveY}
                    r="6.5"
                    fill="#3b82f6"
                    stroke="#fff"
                    strokeWidth="1.5"
                    style={{ cursor: 'move', pointerEvents: 'auto' }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setDraggedEdgeId(edge.id);
                    }}
                  >
                    <title>Drag to bend link</title>
                  </circle>

                  {/* Delete button shown on hover/drag */}
                  {isHovered && (
                    <g 
                      onClick={(e) => { e.stopPropagation(); deleteEdge(edge.id); }} 
                      style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                    >
                      <circle
                        cx={midCurveX + 14}
                        cy={midCurveY - 14}
                        r="6"
                        fill="var(--error-color)"
                      />
                      <text
                        x={midCurveX + 14}
                        y={midCurveY - 11.5}
                        fill="#fff"
                        fontSize="8px"
                        fontWeight="bold"
                        textAnchor="middle"
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        ×
                      </text>
                      <title>Delete connection</title>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Render Cards */}
          {data.nodes.map(node => {
            const isSelected = selectedNodeId === node.id;
            const isSource = edgeSourceId === node.id;
            const isStat = node.type === 'stat';
            const isTask = node.type === 'tasklist';
            const isLink = node.type === 'link';
            const isCode = node.type === 'code';

            const cardWidth = node.width || (node.image ? 180 : 140);
            const cardHeight = node.height || (node.image ? 140 : 90);

            // Compute total for pie charts
            const totalMetrics = isStat && node.metrics ? node.metrics.reduce((acc, m) => acc + m.value, 0) : 0;

            const textColor = getContrastColor(node.color || 'var(--bg-secondary)');
            const isDarkCard = textColor === '#ffffff';

            return (
              <div
                key={node.id}
                onMouseDown={(e) => handleMouseDown(node, e)}
                onContextMenu={(e) => handleContextMenu(e, node.id)}
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
                  width: cardWidth,
                  height: cardHeight,
                  borderRadius: 10,
                  background: node.color || 'var(--bg-secondary)',
                  border: isSelected ? '2px solid var(--accent-color)' : isSource ? '2px dashed var(--accent-color)' : '1px solid var(--border-color)',
                  color: textColor,
                  padding: node.image ? '4px' : '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  justifyContent: 'flex-start',
                  cursor: toolMode === 'pen' ? 'crosshair' : draggedNodeId === node.id ? 'grabbing' : 'grab',
                  zIndex: 2,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  userSelect: 'none',
                  fontSize: 12,
                  overflow: 'hidden'
                }}
              >
                {/* Resize corner handle */}
                <div
                  onMouseDown={(e) => handleResizeStart(node, e)}
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 14,
                    height: 14,
                    cursor: 'se-resize',
                    background: `linear-gradient(135deg, transparent 6px, ${isDarkCard ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)'} 6px)`,
                    zIndex: 10
                  }}
                />

                {node.image ? (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 6 }}>
                    <div style={{ width: '100%', height: node.showLabel ? 'calc(100% - 20px)' : '100%', overflow: 'hidden', position: 'relative', borderRadius: 6 }}>
                      <img
                        src={node.image}
                        alt={node.label}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block',
                          transform: `scale(${node.zoom ?? 1}) translate(${node.panX ?? 0}px, ${node.panY ?? 0}px)`,
                          transformOrigin: 'center center'
                        }}
                        draggable={false}
                      />
                    </div>
                    {node.showLabel && (
                      <div style={{ fontSize: 10, color: textColor, textAlign: 'center', padding: '4px 2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {node.label}
                      </div>
                    )}
                  </div>
                ) : node.video ? (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 6 }}>
                    <div style={{ width: '100%', height: node.showLabel ? 'calc(100% - 20px)' : '100%', overflow: 'hidden', position: 'relative', borderRadius: 6 }}>
                      <video
                        src={node.video}
                        controls
                        muted
                        loop
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block',
                          transform: `scale(${node.zoom ?? 1}) translate(${node.panX ?? 0}px, ${node.panY ?? 0}px)`,
                          transformOrigin: 'center center'
                        }}
                      />
                    </div>
                    {node.showLabel && (
                      <div style={{ fontSize: 10, color: textColor, textAlign: 'center', padding: '4px 2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {node.label}
                      </div>
                    )}
                  </div>
                ) : isStat ? (
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 6 }}>
                    <span style={{ fontSize: 10, color: textColor, opacity: 0.7, fontWeight: 'bold', textTransform: 'uppercase', borderBottom: `1px solid ${isDarkCard ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'}`, paddingBottom: 4 }}>
                      📊 {node.label}
                    </span>
                    
                    <div style={{ flex: 1, display: 'flex', gap: 10, overflow: 'hidden' }}>
                      {/* Left: values/details */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center', overflowY: 'auto' }}>
                        {(node.metrics || []).map((m, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, alignItems: 'center' }}>
                            <span style={{ color: textColor, opacity: 0.8, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.color || PALETTE[idx % PALETTE.length] }} />
                              {m.label}
                            </span>
                            <span style={{ fontWeight: 'bold' }}>{m.value}</span>
                          </div>
                        ))}
                      </div>

                      {/* Right: SVG Diagram Rendering */}
                      <div style={{ width: '45%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {node.chartType === 'pie' ? (
                          <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                            {(() => {
                              let cumulativePercent = 0;
                              return (node.metrics || []).map((m, idx) => {
                                const percent = totalMetrics > 0 ? (m.value / totalMetrics) * 100 : 0;
                                const strokeDash = `${percent} ${100 - percent}`;
                                const strokeOffset = 100 - cumulativePercent;
                                cumulativePercent += percent;
                                return (
                                  <circle
                                    key={idx}
                                    cx="18" cy="18" r="15.915"
                                    fill="transparent"
                                    stroke={m.color || PALETTE[idx % PALETTE.length]}
                                    strokeWidth="4"
                                    strokeDasharray={strokeDash}
                                    strokeDashoffset={strokeOffset}
                                  />
                                );
                              });
                            })()}
                          </svg>
                        ) : node.chartType === 'column' ? (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: '100%', width: '100%', padding: '10px 0 4px' }}>
                            {(() => {
                              const maxVal = Math.max(...(node.metrics || []).map(m => m.value), 1);
                              return (node.metrics || []).map((m, idx) => {
                                const heightPct = (m.value / maxVal) * 80;
                                return (
                                  <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'flex-end' }}>
                                    <div style={{ height: `${heightPct}%`, background: m.color || PALETTE[idx % PALETTE.length], borderRadius: '2px 2px 0 0' }} title={`${m.label}: ${m.value}`} />
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        ) : (
                          // Horizontal Bar Chart
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', justifyContent: 'center' }}>
                            {(() => {
                              const maxVal = Math.max(...(node.metrics || []).map(m => m.value), 1);
                              return (node.metrics || []).map((m, idx) => {
                                const widthPct = (m.value / maxVal) * 100;
                                return (
                                  <div key={idx} style={{ width: '100%', background: isDarkCard ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', borderRadius: 2, overflow: 'hidden', height: 6 }}>
                                    <div style={{ width: `${widthPct}%`, background: m.color || PALETTE[idx % PALETTE.length], height: '100%' }} />
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : isTask ? (
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 6, overflowY: 'auto' }}>
                    <span style={{ fontSize: 10, color: textColor, opacity: 0.7, fontWeight: 'bold', textTransform: 'uppercase', borderBottom: `1px solid ${isDarkCard ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'}`, paddingBottom: 4 }}>
                      ✅ {node.label}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, pointerEvents: 'auto' }}>
                      {(node.tasks || []).map((t) => (
                        <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={t.done}
                            onChange={() => toggleTask(node.id, t.id)}
                            style={{ margin: 0 }}
                          />
                          <span style={{ textDecoration: t.done ? 'line-through' : 'none', color: textColor, opacity: t.done ? 0.5 : 1 }}>
                            {t.text}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : isLink ? (
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 6, justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 10, color: isDarkCard ? '#58a6ff' : '#0969da', fontWeight: 'bold', textTransform: 'uppercase' }}>Bookmark</span>
                      <span style={{ fontWeight: 'bold', fontSize: 13, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{node.label}</span>
                      <span style={{ fontSize: 9, color: textColor, opacity: 0.7, wordBreak: 'break-all', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{node.linkUrl}</span>
                    </div>
                    {node.linkUrl && (
                      <button
                        onClick={(e) => { e.stopPropagation(); window.open(node.linkUrl, '_blank'); }}
                        style={{
                          width: '100%',
                          padding: '5px 0',
                          background: isDarkCard ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
                          border: 'none',
                          borderRadius: 4,
                          color: textColor,
                          fontSize: 10,
                          cursor: 'pointer',
                          pointerEvents: 'auto',
                          fontWeight: 'bold'
                        }}
                      >
                        🌐 Visit Site
                      </button>
                    )}
                  </div>
                ) : isCode ? (
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${isDarkCard ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'}`, paddingBottom: 2 }}>
                      <span style={{ fontSize: 9, color: isDarkCard ? '#ffc600' : '#b25900', fontWeight: 'bold', fontFamily: 'monospace' }}>{node.codeLanguage}</span>
                      <span style={{ fontSize: 9, color: textColor, opacity: 0.7 }}>{node.label}</span>
                    </div>
                    <pre style={{
                      margin: 0,
                      flex: 1,
                      background: isDarkCard ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.06)',
                      padding: 6,
                      borderRadius: 4,
                      fontFamily: 'monospace',
                      fontSize: 10,
                      color: isDarkCard ? '#e2e4e9' : '#1f2328',
                      overflow: 'auto',
                      textAlign: 'left'
                    }}>
                      <code>{node.codeContent}</code>
                    </pre>
                  </div>
                ) : (
                  // General Text Card
                  <span style={{ textAlign: 'left', wordBreak: 'break-word', color: 'inherit', fontSize: 12, lineHeight: '1.4', overflowY: 'auto' }}>
                    {node.label}
                  </span>
                )}

                {/* Draw Node Controls Menu when Selected */}
                {isSelected && (
                  <div style={{ position: 'absolute', top: '-28px', left: 4, display: 'flex', gap: 4, background: 'var(--bg-secondary)', padding: '2px 4px', borderRadius: 4, border: '1px solid var(--border-color)', pointerEvents: 'auto' }}>
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
        {selectedNode && (
          <div style={{ width: 240, borderLeft: '1px solid var(--border-color)', background: 'var(--bg-secondary)', padding: 12, display: 'flex', flexDirection: 'column', gap: 12, zIndex: 5, overflowY: 'auto' }}>
            <h5 style={{ margin: 0, fontSize: 12, color: 'var(--text-primary)' }}>Edit {selectedNode.image ? 'Image' : selectedNode.video ? 'Video' : selectedNode.type === 'stat' ? 'Statistik' : selectedNode.type === 'tasklist' ? 'Checkliste' : selectedNode.type === 'link' ? 'Link' : selectedNode.type === 'code' ? 'Code' : 'Text'} Card</h5>
            
            <div>
              <label style={{ display: 'block', fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>
                {selectedNode.type === 'stat' || selectedNode.type === 'tasklist' || selectedNode.type === 'code' || selectedNode.image || selectedNode.video ? 'Card Title' : 'Content / Label'}
              </label>
              <textarea
                value={editLabel}
                onChange={(e) => { setEditLabel(e.target.value); }}
                onBlur={handleSaveNodeEdits}
                style={{ width: '100%', height: 60, padding: 4, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: 12, borderRadius: 4, outline: 'none', resize: 'none' }}
              />
            </div>

            {(selectedNode.image || selectedNode.video) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedNode.showLabel ?? false}
                    onChange={(e) => {
                      const updated = data.nodes.map(n => n.id === selectedNodeId ? { ...n, showLabel: e.target.checked } : n);
                      updateWorkspaceData({ ...data, nodes: updated });
                    }}
                  />
                  <span style={{ color: 'var(--text-primary)' }}>Show title at bottom</span>
                </label>

                <div>
                  <label style={{ display: 'block', fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Zoom ({selectedNode.zoom ?? 1}x)
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="0.05"
                    value={selectedNode.zoom ?? 1}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      const updated = data.nodes.map(n => n.id === selectedNodeId ? { ...n, zoom: val } : n);
                      setData({ ...data, nodes: updated });
                    }}
                    onMouseUp={() => saveWorkspace(data)}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Pan X (Cut Offset X: {selectedNode.panX ?? 0}px)
                  </label>
                  <input
                    type="range"
                    min="-200"
                    max="200"
                    step="1"
                    value={selectedNode.panX ?? 0}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      const updated = data.nodes.map(n => n.id === selectedNodeId ? { ...n, panX: val } : n);
                      setData({ ...data, nodes: updated });
                    }}
                    onMouseUp={() => saveWorkspace(data)}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Pan Y (Cut Offset Y: {selectedNode.panY ?? 0}px)
                  </label>
                  <input
                    type="range"
                    min="-200"
                    max="200"
                    step="1"
                    value={selectedNode.panY ?? 0}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      const updated = data.nodes.map(n => n.id === selectedNodeId ? { ...n, panY: val } : n);
                      setData({ ...data, nodes: updated });
                    }}
                    onMouseUp={() => saveWorkspace(data)}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            )}

            {selectedNode.type === 'link' && (
              <div>
                <label style={{ display: 'block', fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>Link URL</label>
                <input
                  type="text"
                  value={editLinkUrl}
                  onChange={(e) => setEditLinkUrl(e.target.value)}
                  onBlur={handleSaveNodeEdits}
                  style={{ width: '100%', padding: 4, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: 12, borderRadius: 4, outline: 'none' }}
                />
              </div>
            )}

            {selectedNode.type === 'code' && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>Language</label>
                  <input
                    type="text"
                    value={editCodeLanguage}
                    onChange={(e) => setEditCodeLanguage(e.target.value)}
                    onBlur={handleSaveNodeEdits}
                    style={{ width: '100%', padding: 4, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: 12, borderRadius: 4, outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>Code Content</label>
                  <textarea
                    value={editCodeContent}
                    onChange={(e) => setEditCodeContent(e.target.value)}
                    onBlur={handleSaveNodeEdits}
                    style={{ width: '100%', height: 100, padding: 4, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: 11, fontFamily: 'monospace', borderRadius: 4, outline: 'none' }}
                  />
                </div>
              </>
            )}

            {selectedNode.type === 'stat' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>Chart Representation</label>
                  <select
                    value={editChartType}
                    onChange={(e) => {
                      setEditChartType(e.target.value as any);
                      const updated = data.nodes.map(n => n.id === selectedNodeId ? { ...n, chartType: e.target.value as any } : n);
                      updateWorkspaceData({ ...data, nodes: updated });
                    }}
                    style={{ width: '100%', padding: 4, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 4 }}
                  >
                    <option value="bar">Bar Chart (Horizontal)</option>
                    <option value="column">Column Chart (Vertical)</option>
                    <option value="pie">Pie Chart (Circle)</option>
                  </select>
                </div>

                <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>Values Editor</span>
                <button
                  onClick={() => {
                    const newMetrics = [...(selectedNode.metrics || []), { label: 'New Metric', value: 100 }];
                    const updated = data.nodes.map(n => n.id === selectedNodeId ? { ...n, metrics: newMetrics } : n);
                    updateWorkspaceData({ ...data, nodes: updated });
                  }}
                  style={{ background: 'none', border: 'none', color: '#58a6ff', fontSize: 10, cursor: 'pointer', textAlign: 'left' }}
                >
                  + Add Value
                </button>
                {(selectedNode.metrics || []).map((m, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 6, background: 'var(--bg-primary)', borderRadius: 4, border: '1px solid var(--border-color)' }}>
                    <input
                      placeholder="Label (e.g. Sales)"
                      value={m.label}
                      onChange={(e) => {
                        const updatedMetrics = [...selectedNode.metrics!];
                        updatedMetrics[idx].label = e.target.value;
                        const updated = data.nodes.map(n => n.id === selectedNodeId ? { ...n, metrics: updatedMetrics } : n);
                        updateWorkspaceData({ ...data, nodes: updated });
                      }}
                      style={{ fontSize: 11, padding: 3, background: 'var(--bg-secondary)', border: 'none', color: '#fff', borderRadius: 2 }}
                    />
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input
                        type="number"
                        placeholder="Numeric Value"
                        value={m.value}
                        onChange={(e) => {
                          const updatedMetrics = [...selectedNode.metrics!];
                          updatedMetrics[idx].value = Number(e.target.value) || 0;
                          const updated = data.nodes.map(n => n.id === selectedNodeId ? { ...n, metrics: updatedMetrics } : n);
                          updateWorkspaceData({ ...data, nodes: updated });
                        }}
                        style={{ flex: 1, fontSize: 11, padding: 3, background: 'var(--bg-secondary)', border: 'none', color: '#fff', borderRadius: 2 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedNode.type === 'tasklist' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Checklist Items</span>
                <button
                  onClick={() => {
                    const newTasks = [...(selectedNode.tasks || []), { id: `t_${Date.now()}`, text: 'New Task', done: false }];
                    const updated = data.nodes.map(n => n.id === selectedNodeId ? { ...n, tasks: newTasks } : n);
                    updateWorkspaceData({ ...data, nodes: updated });
                  }}
                  style={{ background: 'none', border: 'none', color: '#58a6ff', fontSize: 10, cursor: 'pointer', textAlign: 'left' }}
                >
                  + Add Item
                </button>
                {(selectedNode.tasks || []).map((t, idx) => (
                  <div key={t.id} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input
                      type="text"
                      value={t.text}
                      onChange={(e) => {
                        const updatedTasks = [...selectedNode.tasks!];
                        updatedTasks[idx].text = e.target.value;
                        const updated = data.nodes.map(n => n.id === selectedNodeId ? { ...n, tasks: updatedTasks } : n);
                        updateWorkspaceData({ ...data, nodes: updated });
                      }}
                      style={{ flex: 1, fontSize: 11, padding: 3, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: 4 }}
                    />
                    <button
                      onClick={() => {
                        const updatedTasks = selectedNode.tasks!.filter(x => x.id !== t.id);
                        const updated = data.nodes.map(n => n.id === selectedNodeId ? { ...n, tasks: updatedTasks } : n);
                        updateWorkspaceData({ ...data, nodes: updated });
                      }}
                      style={{ border: 'none', background: 'none', color: '#f85149', cursor: 'pointer' }}
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>Card Color</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['#1e1d28', '#0e639c', '#3fb950', '#d29922', '#f85149', '#6e56af', '#39c5cf'].map(col => (
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

      {/* Non-blocking overlay modal to Add Card */}
      {isModalOpen && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100
        }}>
          <div style={{
            width: 340,
            background: 'var(--bg-secondary)',
            borderRadius: 8,
            border: '1px solid var(--border-color)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
          }}>
            <h4 style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)' }}>Add New Canvas Card</h4>

            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Card Type</label>
              <select
                value={newCardType}
                onChange={(e) => setNewCardType(e.target.value as any)}
                style={{ width: '100%', padding: 6, fontSize: 12, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 4 }}
              >
                <option value="text">Text Card</option>
                <option value="stat">Statistik Card</option>
                <option value="tasklist">Checkliste Card</option>
                <option value="link">Link Card</option>
                <option value="code">Code Card</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                {newCardType === 'text' ? 'Content Details' : 'Card Title'}
              </label>
              <input
                type="text"
                value={newCardLabel}
                onChange={(e) => setNewCardLabel(e.target.value)}
                placeholder={newCardType === 'text' ? 'Write text content...' : 'e.g. Server Performance'}
                style={{ width: '100%', padding: 6, fontSize: 12, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 4 }}
              />
            </div>

            {newCardType === 'stat' && (
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Chart Type</label>
                <select
                  value={newCardChartType}
                  onChange={(e) => setNewCardChartType(e.target.value as any)}
                  style={{ width: '100%', padding: 6, fontSize: 12, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 4 }}
                >
                  <option value="bar">Bar Chart (Horizontal)</option>
                  <option value="column">Column Chart (Vertical)</option>
                  <option value="pie">Pie Chart (Circle)</option>
                </select>
              </div>
            )}

            {newCardType === 'link' && (
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Bookmark URL</label>
                <input
                  type="text"
                  value={newCardLinkUrl}
                  onChange={(e) => setNewCardLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  style={{ width: '100%', padding: 6, fontSize: 12, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 4 }}
                />
              </div>
            )}

            {newCardType === 'code' && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Code Language</label>
                  <input
                    type="text"
                    value={newCardCodeLanguage}
                    onChange={(e) => setNewCardCodeLanguage(e.target.value)}
                    placeholder="javascript / sql / rust"
                    style={{ width: '100%', padding: 6, fontSize: 12, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 4 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Code Snippet</label>
                  <textarea
                    value={newCardCodeContent}
                    onChange={(e) => setNewCardCodeContent(e.target.value)}
                    style={{ width: '100%', height: 60, padding: 6, fontSize: 11, fontFamily: 'monospace', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 4, resize: 'none' }}
                  />
                </div>
              </>
            )}

            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Card Color</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['#1e1d28', '#0e639c', '#3fb950', '#d29922', '#f85149', '#6e56af', '#39c5cf'].map(col => (
                  <div
                    key={col}
                    onClick={() => setNewCardColor(col)}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 4,
                      background: col,
                      cursor: 'pointer',
                      border: newCardColor === col ? '2px solid #fff' : '1px solid var(--border-color)'
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ padding: '6px 12px', fontSize: 11, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 4, color: 'var(--text-primary)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCard}
                style={{ padding: '6px 12px', fontSize: 11, background: 'var(--accent-color)', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontWeight: 600 }}
              >
                Add Card
              </button>
            </div>
          </div>
        </div>
      )}

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
              <div onClick={() => startConnectEdge(contextMenu.nodeId!)} className="ctx-menu-item">
                🔗 Connect / Link Card
              </div>
              <div onClick={() => {
                setSelectedNodeId(contextMenu.nodeId);
                const node = data.nodes.find(n => n.id === contextMenu.nodeId);
                if (node) {
                  setEditLabel(node.label);
                  setEditColor(node.color || '#0e639c');
                  setEditLinkUrl(node.linkUrl || '');
                  setEditCodeLanguage(node.codeLanguage || 'javascript');
                  setEditCodeContent(node.codeContent || '');
                  setEditChartType(node.chartType || 'bar');
                }
              }} className="ctx-menu-item">
                📝 Edit Properties
              </div>
              {(() => {
                const node = data.nodes.find(n => n.id === contextMenu.nodeId);
                if (node && (node.image || node.video)) {
                  return (
                    <div onClick={() => {
                      setSelectedNodeId(contextMenu.nodeId);
                      if (node.image) {
                        fileInputRef.current?.click();
                      } else {
                        videoInputRef.current?.click();
                      }
                    }} className="ctx-menu-item">
                      🖼️ Change Picture/Video
                    </div>
                  );
                }
                return null;
              })()}
              <div onClick={() => handleDeleteNode(contextMenu.nodeId!)} className="ctx-menu-item" style={{ color: 'var(--error-color)' }}>
                🗑️ Delete Card
              </div>
            </>
          ) : (
            <>
              <div style={{ padding: '4px 10px', fontSize: 10, color: 'var(--text-secondary)', fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', marginBottom: 4 }}>
                Add New Card
              </div>
              <div onClick={() => addNewCardAt('text', contextMenu.x, contextMenu.y)} className="ctx-menu-item">📝 Text Card</div>
              <div onClick={() => addNewCardAt('stat', contextMenu.x, contextMenu.y)} className="ctx-menu-item">📊 Statistik Card</div>
              <div onClick={() => addNewCardAt('tasklist', contextMenu.x, contextMenu.y)} className="ctx-menu-item">✅ Checkliste Card</div>
              <div onClick={() => addNewCardAt('link', contextMenu.x, contextMenu.y)} className="ctx-menu-item">🔗 Bookmark Card</div>
              <div onClick={() => addNewCardAt('code', contextMenu.x, contextMenu.y)} className="ctx-menu-item">💻 Code Card</div>
              <div style={{ height: 1, background: 'var(--border-color)', margin: '4px 0' }} />
              <div onClick={() => {
                setUploadPos({ x: contextMenu.x, y: contextMenu.y });
                fileInputRef.current?.click();
              }} className="ctx-menu-item">🖼️ Upload Photo</div>
              <div onClick={() => {
                setUploadPos({ x: contextMenu.x, y: contextMenu.y });
                videoInputRef.current?.click();
              }} className="ctx-menu-item">🎥 Upload Video</div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default WorkspaceCanvasViewer;
