import React, { useState, useEffect, useRef } from 'react';
import { FileSystemItem } from '../types';
import { FileSystemService } from '../services/FileSystemService';

interface Column {
  id: string;
  name: string;
  type: string;
  isPK: boolean;
  isFK: boolean;
  fkTableId?: string;
  fkColumnId?: string;
  isNullable?: boolean;
  defaultValue?: string;
  isUnique?: boolean;
  isAutoIncrement?: boolean;
}

interface Table {
  id: string;
  name: string;
  x: number;
  y: number;
  columns: Column[];
}

interface SchemaData {
  tables: Table[];
}

export const SchemaDesigner: React.FC<{ file: FileSystemItem }> = ({ file }) => {
  const [data, setData] = useState<SchemaData>({ tables: [] });
  const [loading, setLoading] = useState(true);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [draggedTableId, setDraggedTableId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [activeTab, setActiveTab] = useState<'sql' | 'prisma' | 'knex'>('sql');
  const [history, setHistory] = useState<SchemaData[]>([]);

  const canvasRef = useRef<HTMLDivElement>(null);

  const pushHistory = (currentState: SchemaData) => {
    setHistory(prev => [...prev.slice(-29), JSON.parse(JSON.stringify(currentState))]);
  };

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

  // Load schema file
  useEffect(() => {
    if (!file?.path) return;
    const loadSchema = async () => {
      try {
        setLoading(true);
        const content = await FileSystemService.readText(file.path);
        if (content && content.trim()) {
          try {
            const parsed = JSON.parse(content);
            setData({
              tables: Array.isArray(parsed?.tables) ? parsed.tables : []
            });
            return;
          } catch (jsonErr) {
            console.error('Failed to parse schema JSON:', jsonErr);
          }
        }
        setData({ tables: [] });
      } catch (e) {
        console.error('Failed to read schema file:', e);
        setData({ tables: [] });
      } finally {
        setLoading(false);
      }
    };
    loadSchema();
  }, [file?.path]);

  const saveSchema = async (updatedData: SchemaData) => {
    if (!file?.path) return;
    try {
      await FileSystemService.saveFile(file.path, JSON.stringify(updatedData, null, 2));
    } catch (e) {
      console.error('Failed to save schema', e);
    }
  };

  const updateSchemaData = (updated: SchemaData) => {
    pushHistory(data);
    setData(updated);
    saveSchema(updated);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      setSelectedTableId(null);
    }
  };

  const handleAddTable = () => {
    const formattedName = `new_table_${data.tables.length + 1}`;
    const rect = canvasRef.current?.getBoundingClientRect();
    const x = rect ? rect.width / 2 - 120 : 100;
    const y = rect ? rect.height / 2 - 150 : 100;

    const newTable: Table = {
      id: `table_${Date.now()}`,
      name: formattedName,
      x,
      y,
      columns: [
        { id: `col_${Date.now()}_1`, name: 'id', type: 'INTEGER', isPK: true, isFK: false, isNullable: false, isAutoIncrement: true }
      ]
    };

    const updated = {
      ...data,
      tables: [...data.tables, newTable]
    };
    updateSchemaData(updated);
    setSelectedTableId(newTable.id);
  };

  const handleDeleteTable = (tableId: string) => {
    // Clean up foreign keys pointing to this table
    const cleanedTables = data.tables
      .filter(t => t.id !== tableId)
      .map(t => ({
        ...t,
        columns: t.columns.map(c => {
          if (c.isFK && c.fkTableId === tableId) {
            return { ...c, isFK: false, fkTableId: undefined, fkColumnId: undefined };
          }
          return c;
        })
      }));

    updateSchemaData({ tables: cleanedTables });
    if (selectedTableId === tableId) setSelectedTableId(null);
  };

  const handleAddColumn = (tableId: string) => {
    const updated = {
      ...data,
      tables: data.tables.map(t => {
        if (t.id === tableId) {
          return {
            ...t,
            columns: [
              ...t.columns,
              {
                id: `col_${Date.now()}`,
                name: 'new_column',
                type: 'VARCHAR(255)',
                isPK: false,
                isFK: false,
                isNullable: true
              }
            ]
          };
        }
        return t;
      })
    };
    updateSchemaData(updated);
  };

  const handleUpdateColumn = (tableId: string, colId: string, fields: Partial<Column>) => {
    const updated = {
      ...data,
      tables: data.tables.map(t => {
        if (t.id === tableId) {
          return {
            ...t,
            columns: t.columns.map(c => (c.id === colId ? { ...c, ...fields } : c))
          };
        }
        return t;
      })
    };
    updateSchemaData(updated);
  };

  const handleDeleteColumn = (tableId: string, colId: string) => {
    const updated = {
      ...data,
      tables: data.tables.map(t => {
        if (t.id === tableId) {
          return {
            ...t,
            columns: t.columns.filter(c => c.id !== colId)
          };
        }
        return t;
      })
    };
    updateSchemaData(updated);
  };

  const handleTableDragStart = (e: React.MouseEvent, tableId: string) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT' || (e.target as HTMLElement).tagName === 'BUTTON') {
      return;
    }
    setSelectedTableId(tableId);
    setDraggedTableId(tableId);
    const table = data.tables.find(t => t.id === tableId);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (table && rect) {
      const mouseCanvasX = e.clientX - rect.left;
      const mouseCanvasY = e.clientY - rect.top;
      setDragOffset({
        x: mouseCanvasX - table.x,
        y: mouseCanvasY - table.y
      });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (draggedTableId && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;
      const x = canvasX - dragOffset.x;
      const y = canvasY - dragOffset.y;

      setData(prev => ({
        ...prev,
        tables: prev.tables.map(t => (t.id === draggedTableId ? { ...t, x, y } : t))
      }));
    }
  };

  const handleCanvasMouseUp = () => {
    if (draggedTableId) {
      setDraggedTableId(null);
      saveSchema(data);
    }
  };

  // Code generation
  const generateSQL = () => {
    let sql = '-- Generated SQL Schema\n\n';
    data.tables.forEach(table => {
      sql += `CREATE TABLE ${table.name} (\n`;
      const colLines = table.columns.map(col => {
        let line = `  ${col.name} ${col.type}`;
        if (col.isPK) line += ' PRIMARY KEY';
        if (col.isAutoIncrement) line += ' AUTOINCREMENT';
        if (col.isNullable === false) line += ' NOT NULL';
        if (col.isUnique) line += ' UNIQUE';
        if (col.defaultValue) line += ` DEFAULT ${col.defaultValue}`;

        if (col.isFK && col.fkTableId) {
          const targetTable = data.tables.find(t => t.id === col.fkTableId);
          const targetCol = targetTable?.columns.find(c => c.id === col.fkColumnId);
          if (targetTable && targetCol) {
            line += ` REFERENCES ${targetTable.name}(${targetCol.name})`;
          }
        }
        return line;
      });
      sql += colLines.join(',\n');
      sql += '\n);\n\n';
    });
    return sql;
  };

  const generatePrisma = () => {
    let prisma = '// Generated Prisma Schema\n\n';
    data.tables.forEach(table => {
      const modelName = table.name.charAt(0).toUpperCase() + table.name.slice(1);
      prisma += `model ${modelName} {\n`;
      table.columns.forEach(col => {
        let type = 'String';
        if (col.type.includes('INTEGER')) type = 'Int';
        else if (col.type.includes('BOOLEAN')) type = 'Boolean';
        else if (col.type.includes('TIMESTAMP') || col.type.includes('DATE')) type = 'DateTime';
        else if (col.type.includes('JSON')) type = 'Json';

        const nullableStr = col.isNullable !== false ? '?' : '';
        let line = `  ${col.name} ${type}${nullableStr}`;
        if (col.isPK) line += ' @id';
        if (col.isPK && col.isAutoIncrement) line += ' @default(autoincrement())';
        if (col.isUnique) line += ' @unique';
        if (col.defaultValue) line += ` @default(${col.defaultValue})`;

        if (col.isFK && col.fkTableId) {
          const targetTable = data.tables.find(t => t.id === col.fkTableId);
          const targetCol = targetTable?.columns.find(c => c.id === col.fkColumnId);
          if (targetTable && targetCol) {
            const relModelName = targetTable.name.charAt(0).toUpperCase() + targetTable.name.slice(1);
            line += `\n  ${targetTable.name} ${relModelName} @relation(fields: [${col.name}], references: [${targetCol.name}])`;
          }
        }
        prisma += `${line}\n`;
      });
      prisma += '}\n\n';
    });
    return prisma;
  };

  const generateKnex = () => {
    let knex = '// Generated Knex.js Migration\n\n';
    knex += 'exports.up = function(knex) {\n';
    knex += '  return knex.schema\n';
    data.tables.forEach(table => {
      knex += `    .createTable('${table.name}', table => {\n`;
      table.columns.forEach(col => {
        let line = '      ';
        if (col.isPK) {
          if (col.isAutoIncrement) {
            line += `table.increments('${col.name}').primary();`;
          } else {
            line += `table.specificType('${col.name}', '${col.type}').primary();`;
          }
        } else if (col.isFK && col.fkTableId) {
          const targetTable = data.tables.find(t => t.id === col.fkTableId);
          const targetCol = targetTable?.columns.find(c => c.id === col.fkColumnId);
          if (targetTable && targetCol) {
            line += `table.integer('${col.name}').unsigned().references('${targetCol.name}').inTable('${targetTable.name}');`;
          }
        } else {
          if (col.type.includes('VARCHAR')) {
            line += `table.string('${col.name}')`;
          } else if (col.type.includes('INTEGER')) {
            line += `table.integer('${col.name}')`;
          } else if (col.type.includes('TEXT')) {
            line += `table.text('${col.name}')`;
          } else if (col.type.includes('BOOLEAN')) {
            line += `table.boolean('${col.name}')`;
          } else {
            line += `table.specificType('${col.name}', '${col.type}')`;
          }

          if (col.isNullable === false) line += '.notNullable()';
          else line += '.nullable()';

          if (col.isUnique) line += '.unique()';
          if (col.defaultValue) line += `.defaultTo(${col.defaultValue})`;
          line += ';';
        }
        knex += `${line}\n`;
      });
      knex += '    })\n';
    });
    knex += '};\n\n';
    knex += 'exports.down = function(knex) {\n';
    knex += '  return knex.schema\n';
    [...data.tables].reverse().forEach(table => {
      knex += `    .dropTableIfExists('${table.name}')\n`;
    });
    knex += '};\n';
    return knex;
  };

  const getCodeText = () => {
    switch (activeTab) {
      case 'prisma': return generatePrisma();
      case 'knex': return generateKnex();
      default: return generateSQL();
    }
  };

  if (loading) {
    return <div style={{ padding: 20, color: 'var(--text-secondary)' }}>Loading schema designer...</div>;
  }

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg-primary)', overflow: 'hidden' }}>
      {/* Visual Canvas Area */}
      <div
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        style={{
          flex: 1,
          position: 'relative',
          background: 'radial-gradient(circle, var(--border-primary) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          backgroundColor: 'var(--bg-primary)',
          overflow: 'auto'
        }}
      >
        {/* Connection Link paths for relationships */}
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
          <defs>
            <marker id="schema-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 2 L 8 5 L 0 8 z" fill="var(--text-secondary)" />
            </marker>
          </defs>
          {data.tables.map(table => (
            table.columns.map(col => {
              if (col.isFK && col.fkTableId) {
                const targetTable = data.tables.find(t => t.id === col.fkTableId);
                if (targetTable) {
                  // Connect center of source table to center of target table
                  const startX = table.x + 110;
                  const startY = table.y + 70;
                  const endX = targetTable.x + 110;
                  const endY = targetTable.y + 70;

                  return (
                    <line
                      key={`${table.id}_${col.id}`}
                      x1={startX}
                      y1={startY}
                      x2={endX}
                      y2={endY}
                      stroke="var(--accent-color)"
                      strokeWidth="2"
                      markerEnd="url(#schema-arrow)"
                      opacity="0.65"
                    />
                  );
                }
              }
              return null;
            })
          ))}
        </svg>

        {/* Toolbar */}
        <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10 }}>
          <button
            onClick={handleAddTable}
            style={{ padding: '6px 12px', background: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
          >
            ➕ Add Table
          </button>
        </div>

        {/* Tables Cards */}
        {data.tables.map(table => {
          const isSelected = selectedTableId === table.id;
          return (
            <div
              key={table.id}
              onMouseDown={(e) => handleTableDragStart(e, table.id)}
              style={{
                position: 'absolute',
                left: table.x,
                top: table.y,
                width: 220,
                background: 'var(--bg-secondary)',
                borderRadius: 6,
                border: isSelected ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                boxShadow: '0 6px 16px rgba(0,0,0,0.3)',
                zIndex: 2,
                cursor: draggedTableId === table.id ? 'grabbing' : 'grab',
                color: 'var(--text-primary)',
                padding: '8px 12px',
                fontSize: 12
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, borderBottom: '1px solid var(--border-color)', paddingBottom: 4 }}>
                <span style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{table.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteTable(table.id); }}
                  style={{ border: 'none', background: 'none', color: '#ff4d4f', cursor: 'pointer', fontSize: 11 }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {table.columns.map(col => (
                  <div key={col.id} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: 11, padding: '2px 0' }}>
                    <span style={{ color: col.isPK ? '#e3b341' : col.isFK ? '#58a6ff' : 'inherit' }}>
                      {col.isPK ? '🔑 ' : col.isFK ? '🔗 ' : ''}{col.name}
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>{col.type}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Inspector / Config Sidebar */}
      <div style={{ width: 320, borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-secondary)', zIndex: 10 }}>
        {selectedTableId && (() => {
          const table = data.tables.find(t => t.id === selectedTableId);
          if (!table) return null;
          return (
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflowY: 'auto' }}>
              <h4 style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)' }}>Table Properties</h4>
              
              <div>
                <label style={{ display: 'block', fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>Table Name</label>
                <input
                  type="text"
                  value={table.name}
                  onChange={(e) => {
                    const formatted = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                    const updated = {
                      ...data,
                      tables: data.tables.map(t => t.id === table.id ? { ...t, name: formatted } : t)
                    };
                    updateSchemaData(updated);
                  }}
                  style={{ width: '100%', padding: '6px', fontSize: 12, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 4 }}
                />
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 'bold' }}>Columns</span>
                {table.columns.map(col => (
                  <div key={col.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8, background: 'var(--bg-primary)', borderRadius: 4, border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input
                        value={col.name}
                        placeholder="col_name"
                        onChange={(e) => handleUpdateColumn(table.id, col.id, { name: e.target.value })}
                        style={{ flex: 1, fontSize: 11, padding: 3, background: 'var(--bg-secondary)', border: 'none', color: '#fff', borderRadius: 2 }}
                      />
                      <select
                        value={col.type}
                        onChange={(e) => handleUpdateColumn(table.id, col.id, { type: e.target.value })}
                        style={{ fontSize: 11, padding: 3, background: 'var(--bg-secondary)', border: 'none', color: '#fff', borderRadius: 2 }}
                      >
                        <option>INTEGER</option>
                        <option>VARCHAR(255)</option>
                        <option>TEXT</option>
                        <option>BOOLEAN</option>
                        <option>TIMESTAMP</option>
                        <option>UUID</option>
                      </select>
                      <button
                        onClick={() => handleDeleteColumn(table.id, col.id)}
                        style={{ border: 'none', background: 'none', color: '#ff4d4f', cursor: 'pointer', fontSize: 10 }}
                      >
                        ✕
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', fontSize: 9, color: 'var(--text-secondary)' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <input
                          type="checkbox"
                          checked={col.isPK}
                          onChange={(e) => handleUpdateColumn(table.id, col.id, { isPK: e.target.checked })}
                        />
                        PK
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <input
                          type="checkbox"
                          checked={col.isFK}
                          onChange={(e) => handleUpdateColumn(table.id, col.id, { isFK: e.target.checked })}
                        />
                        FK
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <input
                          type="checkbox"
                          checked={col.isNullable !== false}
                          onChange={(e) => handleUpdateColumn(table.id, col.id, { isNullable: e.target.checked })}
                        />
                        Nullable
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <input
                          type="checkbox"
                          checked={!!col.isUnique}
                          onChange={(e) => handleUpdateColumn(table.id, col.id, { isUnique: e.target.checked })}
                        />
                        Unique
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <input
                          type="checkbox"
                          checked={!!col.isAutoIncrement}
                          onChange={(e) => handleUpdateColumn(table.id, col.id, { isAutoIncrement: e.target.checked })}
                        />
                        AutoInc
                      </label>
                    </div>

                    {col.isFK && (
                      <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
                        <select
                          value={col.fkTableId || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            const targetTab = data.tables.find(t => t.id === val);
                            handleUpdateColumn(table.id, col.id, { 
                              fkTableId: val, 
                              fkColumnId: targetTab?.columns[0]?.id 
                            });
                          }}
                          style={{ fontSize: 9, padding: '1px', backgroundColor: 'var(--bg-secondary)', color: '#fff', border: 'none' }}
                        >
                          <option value="">Ref Table</option>
                          {data.tables.filter(t => t.id !== table.id).map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                        {col.fkTableId && (
                          <select
                            value={col.fkColumnId || ''}
                            onChange={(e) => handleUpdateColumn(table.id, col.id, { fkColumnId: e.target.value })}
                            style={{ fontSize: 9, padding: '1px', backgroundColor: 'var(--bg-secondary)', color: '#fff', border: 'none' }}
                          >
                            <option value="">Ref Col</option>
                            {(data.tables.find(t => t.id === col.fkTableId)?.columns || []).map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}

                    <input
                      type="text"
                      placeholder="Default Value"
                      value={col.defaultValue || ''}
                      onChange={(e) => handleUpdateColumn(table.id, col.id, { defaultValue: e.target.value })}
                      style={{ fontSize: 10, padding: '2px 4px', marginTop: 2, background: 'var(--bg-secondary)', border: 'none', color: '#fff', borderRadius: 2 }}
                    />
                  </div>
                ))}
                <button
                  onClick={() => handleAddColumn(table.id)}
                  style={{ padding: '4px', backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px dashed var(--border-color)', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}
                >
                  + Add Column
                </button>
              </div>
            </div>
          );
        })()}

        {/* Code Generation Tabs at the bottom */}
        <div style={{ height: 260, borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
            {(['sql', 'prisma', 'knex'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  background: activeTab === tab ? 'var(--bg-primary)' : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === tab ? '2px solid var(--accent-color)' : 'none',
                  color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                  padding: '6px 0',
                  fontSize: 11,
                  cursor: 'pointer'
                }}
              >
                {tab === 'sql' ? 'SQL DDL' : tab.toUpperCase()}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, background: '#0f1015', padding: 8, overflow: 'auto' }}>
            <pre style={{ margin: 0, fontSize: 10, color: '#a6accd', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
              {getCodeText()}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchemaDesigner;
