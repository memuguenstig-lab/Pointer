import React, { useState, useEffect, useRef } from 'react';
import { FileSystemItem } from '../types';
import { FileSystemService } from '../services/FileSystemService';

interface WorkflowStateNode {
  id: string;
  name: string;
  x: number;
  y: number;
  entryAction?: string;
  exitAction?: string;
  type: 'normal' | 'initial' | 'final';
}

interface WorkflowTransition {
  id: string;
  from: string;
  to: string;
  event: string;
}

interface WorkflowData {
  states: WorkflowStateNode[];
  transitions: WorkflowTransition[];
}

export const WorkflowDesigner: React.FC<{ file: FileSystemItem }> = ({ file }) => {
  const [data, setData] = useState<WorkflowData>({ states: [], transitions: [] });
  const [loading, setLoading] = useState(true);
  const [selectedStateId, setSelectedStateId] = useState<string | null>(null);
  const [selectedTransitionId, setSelectedTransitionId] = useState<string | null>(null);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [transitionSourceId, setTransitionSourceId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'xstate'>('details');

  const canvasRef = useRef<HTMLDivElement>(null);

  // Load flow data
  useEffect(() => {
    if (!file?.path) return;
    const loadFlow = async () => {
      try {
        setLoading(true);
        const content = await FileSystemService.readText(file.path);
        if (content && content.trim()) {
          try {
            const parsed = JSON.parse(content);
            setData({
              states: Array.isArray(parsed?.states) ? parsed.states : [],
              transitions: Array.isArray(parsed?.transitions) ? parsed.transitions : []
            });
            return;
          } catch (e) {
            console.error('Failed to parse flow file JSON:', e);
          }
        }
        setData({ states: [], transitions: [] });
      } catch (e) {
        console.error('Failed to read flow file:', e);
        setData({ states: [], transitions: [] });
      } finally {
        setLoading(false);
      }
    };
    loadFlow();
  }, [file?.path]);

  const saveFlow = async (updatedData: WorkflowData) => {
    if (!file?.path) return;
    try {
      await FileSystemService.saveFile(file.path, JSON.stringify(updatedData, null, 2));
    } catch (e) {
      console.error('Failed to save Workflow data:', e);
    }
  };

  const updateFlowData = (updated: WorkflowData) => {
    setData(updated);
    saveFlow(updated);
  };

  const handleAddState = () => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const x = rect ? rect.width / 2 - 60 : 100;
    const y = rect ? rect.height / 2 - 35 : 100;

    const newState: WorkflowStateNode = {
      id: `state_${Date.now()}`,
      name: `STATE_${data.states.length + 1}`,
      x,
      y,
      type: data.states.length === 0 ? 'initial' : 'normal'
    };

    const updated = {
      ...data,
      states: [...data.states, newState]
    };
    updateFlowData(updated);
    setSelectedStateId(newState.id);
    setSelectedTransitionId(null);
  };

  const handleDeleteState = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = {
      states: data.states.filter(s => s.id !== id),
      transitions: data.transitions.filter(t => t.from !== id && t.to !== id)
    };
    updateFlowData(updated);
    if (selectedStateId === id) setSelectedStateId(null);
    if (transitionSourceId === id) setTransitionSourceId(null);
  };

  const handleMouseDown = (node: WorkflowStateNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggedNodeId(node.id);
    setSelectedStateId(node.id);
    setSelectedTransitionId(null);
    
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
      states: prev.states.map(s => s.id === draggedNodeId ? { ...s, x, y } : s)
    }));
  };

  const handleMouseUp = () => {
    if (draggedNodeId) {
      setDraggedNodeId(null);
      saveFlow(data);
    }
  };

  const startConnectTransition = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTransitionSourceId(id);
  };

  const endConnectTransition = (toId: string) => {
    if (!transitionSourceId || transitionSourceId === toId) return;

    // Use a default event name that can be configured in the sidebar afterward
    const newTransition: WorkflowTransition = {
      id: `trans_${Date.now()}`,
      from: transitionSourceId,
      to: toId,
      event: 'NEXT'
    };

    const updated = {
      ...data,
      transitions: [...data.transitions, newTransition]
    };
    updateFlowData(updated);
    setTransitionSourceId(null);
    setSelectedTransitionId(newTransition.id);
    setSelectedStateId(null);
  };

  const handleDeleteTransition = (id: string) => {
    const updated = {
      ...data,
      transitions: data.transitions.filter(t => t.id !== id)
    };
    updateFlowData(updated);
    if (selectedTransitionId === id) setSelectedTransitionId(null);
  };

  const generateXStateConfig = () => {
    const initialState = data.states.find(s => s.type === 'initial') || data.states[0];
    const statesConfig = data.states.map(s => {
      const stateTransitions = data.transitions.filter(t => t.from === s.id);
      const onConfig = stateTransitions.map(t => {
        const targetNode = data.states.find(target => target.id === t.to);
        return `      ${t.event}: { target: '${targetNode?.name || ''}' }`;
      }).join(',\n');

      return `    ${s.name}: {
      type: '${s.type === 'final' ? 'final' : 'compound'}',
${s.entryAction ? `      entry: '${s.entryAction}',\n` : ''}${s.exitAction ? `      exit: '${s.exitAction}',\n` : ''}${onConfig ? `      on: {\n${onConfig}\n      }` : ''}
    }`;
    }).join(',\n');

    return `import { createMachine } from 'xstate';

export const workflowMachine = createMachine({
  id: '${file.name.replace('.flow', '')}',
  initial: '${initialState?.name || 'idle'}',
  states: {
${statesConfig}
  }
});`;
  };

  if (loading) {
    return <div style={{ padding: 20, color: 'var(--text-secondary)' }}>Loading Workflow Designer...</div>;
  }

  const selectedState = data.states.find(s => s.id === selectedStateId);
  const selectedTransition = data.transitions.find(t => t.id === selectedTransitionId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)', overflow: 'hidden' }}>
      {/* Top Controls Toolbar */}
      <div style={{ padding: '8px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 12, alignItems: 'center', zIndex: 10 }}>
        <h4 style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)' }}>⚙️ Workflow Designer: {file.name}</h4>
        
        <button
          onClick={handleAddState}
          style={{ padding: '4px 10px', fontSize: 11, background: 'var(--accent-color)', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontWeight: 600 }}
        >
          ➕ Add State Node
        </button>

        {transitionSourceId && (
          <span style={{ fontSize: 11, color: 'var(--accent-color)', animation: 'pulse 1.5s infinite' }}>
            ⚡ Click another state to connect transition
          </span>
        )}
      </div>

      {/* Main designer canvas */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={() => { setTransitionSourceId(null); setSelectedStateId(null); setSelectedTransitionId(null); }}
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
          {/* SVG Connection Lines for State Transitions */}
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 2 L 8 5 L 0 8 z" fill="var(--text-secondary)" />
              </marker>
            </defs>
            {data.transitions.map(trans => {
              const fromState = data.states.find(s => s.id === trans.from);
              const toState = data.states.find(s => s.id === trans.to);
              if (!fromState || !toState) return null;

              const startX = fromState.x + 60;
              const startY = fromState.y + 35;
              const endX = toState.x + 60;
              const endY = toState.y + 35;

              const midX = (startX + endX) / 2;
              const midY = (startY + endY) / 2;
              const isTransSelected = selectedTransitionId === trans.id;

              return (
                <g key={trans.id}>
                  <line
                    x1={startX}
                    y1={startY}
                    x2={endX}
                    y2={endY}
                    stroke={isTransSelected ? 'var(--accent-color)' : 'var(--text-secondary)'}
                    strokeWidth={isTransSelected ? '3' : '2'}
                    markerEnd="url(#arrow)"
                    opacity="0.8"
                  />
                  {/* Event Label on line */}
                  <text
                    x={midX}
                    y={midY - 8}
                    fill={isTransSelected ? 'var(--accent-color)' : '#58a6ff'}
                    fontSize="10"
                    fontWeight="bold"
                    textAnchor="middle"
                    style={{ pointerEvents: 'auto', cursor: 'pointer', fontFamily: 'monospace' }}
                    onClick={(e) => { e.stopPropagation(); setSelectedTransitionId(trans.id); setSelectedStateId(null); }}
                  >
                    {trans.event}
                  </text>
                  {/* Delete circle */}
                  <circle
                    cx={midX}
                    cy={midY + 8}
                    r="6"
                    fill="var(--error-color)"
                    style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                    onClick={(e) => { e.stopPropagation(); handleDeleteTransition(trans.id); }}
                  >
                    <title>Delete transition</title>
                  </circle>
                </g>
              );
            })}
          </svg>

          {/* Render States */}
          {data.states.map(state => {
            const isSelected = selectedStateId === state.id;
            const isSource = transitionSourceId === state.id;

            return (
              <div
                key={state.id}
                onMouseDown={(e) => handleMouseDown(state, e)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (transitionSourceId) {
                    endConnectTransition(state.id);
                  }
                }}
                style={{
                  position: 'absolute',
                  left: state.x,
                  top: state.y,
                  width: 120,
                  height: 70,
                  borderRadius: state.type === 'initial' ? '20px 4px 20px 4px' : state.type === 'final' ? '50%' : '6px',
                  background: state.type === 'initial' ? '#0e639c' : state.type === 'final' ? '#3fb950' : 'var(--bg-secondary)',
                  border: isSelected ? '2px solid var(--accent-color)' : isSource ? '2px dashed var(--accent-color)' : '1px solid var(--border-color)',
                  color: '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: draggedNodeId === state.id ? 'grabbing' : 'grab',
                  zIndex: 2,
                  boxShadow: '0 4px 10px rgba(0,0,0,0.25)',
                  userSelect: 'none',
                  padding: 4
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 'bold', fontFamily: 'monospace', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
                  {state.name}
                </span>

                {state.entryAction && (
                  <span style={{ fontSize: 8, color: '#a6accd', marginTop: 2 }}>
                    ➡️ {state.entryAction}
                  </span>
                )}

                {isSelected && (
                  <div style={{ position: 'absolute', top: '-28px', display: 'flex', gap: 4, background: 'var(--bg-secondary)', padding: '2px 4px', borderRadius: 4, border: '1px solid var(--border-color)', pointerEvents: 'auto' }}>
                    <button
                      onClick={(e) => startConnectTransition(state.id, e)}
                      style={{ fontSize: 9, padding: '2px 6px', background: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: 2, cursor: 'pointer' }}
                      title="Add Transition"
                    >
                      ⚡ Link
                    </button>
                    <button
                      onClick={(e) => handleDeleteState(state.id, e)}
                      style={{ fontSize: 9, padding: '2px 6px', background: 'var(--error-color)', color: '#fff', border: 'none', borderRadius: 2, cursor: 'pointer' }}
                      title="Delete State"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sidebar inspector */}
        <div style={{ width: 280, borderLeft: '1px solid var(--border-color)', background: 'var(--bg-secondary)', padding: 16, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: 8 }}>
            <button
              onClick={() => setActiveTab('details')}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'details' ? '2px solid var(--accent-color)' : 'none',
                color: activeTab === 'details' ? 'var(--text-primary)' : 'var(--text-secondary)',
                padding: '6px 0',
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab('xstate')}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'xstate' ? '2px solid var(--accent-color)' : 'none',
                color: activeTab === 'xstate' ? 'var(--text-primary)' : 'var(--text-secondary)',
                padding: '6px 0',
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              TypeScript config
            </button>
          </div>

          {activeTab === 'details' && (
            selectedState ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h4 style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)' }}>Edit State</h4>
                
                <div>
                  <label style={{ display: 'block', fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>State Name</label>
                  <input
                    type="text"
                    value={selectedState.name}
                    onChange={(e) => {
                      const updated = data.states.map(s => s.id === selectedState.id ? { ...s, name: e.target.value.toUpperCase().replace(/\s+/g, '_') } : s);
                      updateFlowData({ ...data, states: updated });
                    }}
                    style={{ width: '100%', padding: '6px', fontSize: 12, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 4, fontFamily: 'monospace' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>State Type</label>
                  <select
                    value={selectedState.type}
                    onChange={(e) => {
                      const updated = data.states.map(s => s.id === selectedState.id ? { ...s, type: e.target.value as any } : s);
                      updateFlowData({ ...data, states: updated });
                    }}
                    style={{ width: '100%', padding: '6px', fontSize: 12, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 4 }}
                  >
                    <option value="normal">Normal</option>
                    <option value="initial">Initial</option>
                    <option value="final">Final</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>On Entry Action</label>
                  <input
                    type="text"
                    value={selectedState.entryAction || ''}
                    placeholder="e.g. logEntry"
                    onChange={(e) => {
                      const updated = data.states.map(s => s.id === selectedState.id ? { ...s, entryAction: e.target.value } : s);
                      updateFlowData({ ...data, states: updated });
                    }}
                    style={{ width: '100%', padding: '6px', fontSize: 12, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 4 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>On Exit Action</label>
                  <input
                    type="text"
                    value={selectedState.exitAction || ''}
                    placeholder="e.g. cleanUp"
                    onChange={(e) => {
                      const updated = data.states.map(s => s.id === selectedState.id ? { ...s, exitAction: e.target.value } : s);
                      updateFlowData({ ...data, states: updated });
                    }}
                    style={{ width: '100%', padding: '6px', fontSize: 12, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 4 }}
                  />
                </div>
              </div>
            ) : selectedTransition ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h4 style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)' }}>Edit Transition</h4>
                <div>
                  <label style={{ display: 'block', fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>Trigger Event</label>
                  <input
                    type="text"
                    value={selectedTransition.event}
                    onChange={(e) => {
                      const updated = data.transitions.map(t => t.id === selectedTransition.id ? { ...t, event: e.target.value.toUpperCase().replace(/\s+/g, '_') } : t);
                      updateFlowData({ ...data, transitions: updated });
                    }}
                    style={{ width: '100%', padding: '6px', fontSize: 12, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 4, fontFamily: 'monospace' }}
                  />
                </div>
              </div>
            ) : (
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Select a state or transition to edit details.</span>
            )
          )}

          {activeTab === 'xstate' && (
            <div style={{ flex: 1, minHeight: 250, background: '#0f1015', border: '1px solid #2e303f', borderRadius: 4, padding: 8, overflow: 'auto' }}>
              <pre style={{ margin: 0, fontSize: 10, color: '#f78c6c', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                {generateXStateConfig()}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowDesigner;
