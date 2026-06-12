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

const SUPPORTED_TYPES = [
  'INTEGER',
  'VARCHAR(255)',
  'TEXT',
  'BOOLEAN',
  'TIMESTAMP',
  'DATE',
  'UUID',
  'DECIMAL(10,2)',
  'JSON'
];

export const SchemaDesigner: React.FC<{ file: FileSystemItem }> = ({ file }) => {
  const [data, setData] = useState<SchemaData>({ tables: [] });
  const [loading, setLoading] = useState(true);
  const [draggedTableId, setDraggedTableId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
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
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;

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
        if (content) {
          const parsed = JSON.parse(content);
          setData({
            tables: parsed.tables || []
          });
        }
      } catch (e) {
        console.error('Failed to parse schema file', e);
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
    const name = prompt('Enter table name:', 'new_table');
    if (!name) return;

    const formattedName = name.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const rect = canvasRef.current?.getBoundingClientRect();
    const x = rect ? rect.width / 2 - 120 : 100;
    const y = rect ? rect.height / 2 - 150 : 100;

    const newTable: Table = {
      id: `table_${Date.now()}`,
      name: formattedName,
      x,
      y,
      columns: [
        { id: `col_${Date.now()}_1`, name: 'id', type: 'INTEGER', isPK: true, isFK: false }
      ]
    };

    updateSchemaData({
      ...data,
      tables: [...data.tables, newTable]
    });
  };

  const handleDeleteTable = (tableId: string) => {
    if (!confirm('Are you sure you want to delete this table?')) return;
    
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
                isFK: false
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
            columns: t.columns.map(c => {
              if (c.id === colId) {
                const updatedCol = { ...c, ...fields };
                if (fields.isFK === false) {
                  updatedCol.fkTableId = undefined;
                  updatedCol.fkColumnId = undefined;
                }
                return updatedCol;
              }
              return c;
            })
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
    if (table) {
      setDragOffset({
        x: e.clientX - table.x,
        y: e.clientY - table.y
      });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (draggedTableId && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = Math.max(10, Math.min(rect.width - 250, e.clientX - dragOffset.x));
      const y = Math.max(10, Math.min(rect.height - 300, e.clientY - dragOffset.y));

      setData(prev => ({
        ...prev,
        tables: prev.tables.map(t => (t.id === draggedTableId ? { ...t, x, y } : t))
      }));
    }
  };

  const handleCanvasMouseUp = () => {
    if (draggedTableId) {
      const draggedTable = data.tables.find(t => t.id === draggedTableId);
      if (draggedTable) {
        // Find in history/save
        pushHistory(history[history.length - 1] || data); // preserve history correctly
        saveSchema(data);
      }
      setDraggedTableId(null);
    }
  };

  // Helper to draw connection lines between FK column and PK column
  const renderRelations = () => {
    const lines: React.ReactNode[] = [];
    data.tables.forEach(sourceTable => {
      sourceTable.columns.forEach(col => {
        if (col.isFK && col.fkTableId) {
          const targetTable = data.tables.find(t => t.id === col.fkTableId);
          if (targetTable) {
            // Estimate connection points
            // Draw path from source Table edge to target Table edge
            const startX = sourceTable.x + 120;
            const startY = sourceTable.y + 80;
            const endX = targetTable.x + 120;
            const endY = targetTable.y + 80;

            const dx = Math.abs(endX - startX) * 0.5;
            const pathData = `M ${startX} ${startY} C ${startX + (endX > startX ? dx : -dx)} ${startY}, ${endX + (endX > startX ? -dx : dx)} ${endY}, ${endX} ${endY}`;

            lines.push(
              <g key={`${sourceTable.id}_${col.id}_to_${targetTable.id}`}>
                <path
                  d={pathData}
                  fill="none"
                  stroke="var(--accent-color)"
                  strokeWidth="3"
                  style={{ opacity: 0.75, transition: 'stroke 0.2s' }}
                />
                <circle cx={endX} cy={endY} r="5" fill="var(--accent-color)" />
              </g>
            );
          }
        }
      });
    });
    return lines;
  };

  // Code generation
  const generateSQL = () => {
    let sql = '-- Generated SQL Schema\n\n';
    data.tables.forEach(table => {
      sql += `CREATE TABLE ${table.name} (\n`;
      const colLines = table.columns.map(col => {
        let line = `  ${col.name} ${col.type}`;
        if (col.isPK) line += ' PRIMARY KEY';
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
      // Capitalize first letter of table name for model name
      const modelName = table.name.charAt(0).toUpperCase() + table.name.slice(1);
      prisma += `model ${modelName} {\n`;
      table.columns.forEach(col => {
        let type = 'String';
        if (col.type.includes('INTEGER')) type = 'Int';
        else if (col.type.includes('BOOLEAN')) type = 'Boolean';
        else if (col.type.includes('TIMESTAMP') || col.type.includes('DATE')) type = 'DateTime';
        else if (col.type.includes('JSON')) type = 'Json';

        let line = `  ${col.name} ${type}`;
        if (col.isPK) line += ' @id';
        if (col.isPK && type === 'Int') line += ' @default(autoincrement())';
        if (col.isPK && col.type === 'UUID') line += ' @default(uuid())';

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
    data.tables.forEach((table, idx) => {
      knex += `    .createTable('${table.name}', table => {\n`;
      table.columns.forEach(col => {
        let line = '      ';
        if (col.isPK) {
          if (col.type.includes('INTEGER')) {
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
            line += `table.string('${col.name}');`;
          } else if (col.type.includes('INTEGER')) {
            line += `table.integer('${col.name}');`;
          } else if (col.type.includes('TEXT')) {
            line += `table.text('${col.name}');`;
          } else if (col.type.includes('BOOLEAN')) {
            line += `table.boolean('${col.name}');`;
          } else if (col.type.includes('TIMESTAMP')) {
            line += `table.timestamp('${col.name}').defaultTo(knex.fn.now());`;
          } else {
            line += `table.specificType('${col.name}', '${col.type}');`;
          }
        }
        knex += `${line}\n`;
      });
      knex += '    })\n';
    });
    knex += '};\n\n';
    knex += 'exports.down = function(knex) {\n';
    knex += '  return knex.schema\n';
    // Drop tables in reverse order to respect foreign key constraints
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

  if (!file) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-secondary)' }}>No schema selected</div>;
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-secondary)' }}>
        Loading Schema Canvas...
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Canvas Area */}
      <div 
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: '#0a0a0a',
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 0)',
          backgroundSize: '24px 24px',
          userSelect: 'none'
        }}
      >
        {/* Relations SVG Overlay */}
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
          {renderRelations()}
        </svg>

        {/* Floating Tool Header */}
        <div style={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 10,
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          backgroundColor: 'rgba(30, 30, 30, 0.85)',
          padding: '8px 12px',
          borderRadius: 8,
          border: '1px solid var(--border-color)',
          backdropFilter: 'blur(8px)'
        }}>
          <span style={{ fontSize: 13, fontWeight: 'bold' }}>DB Schema: {file.name}</span>
          <button 
            onClick={handleAddTable}
            style={{
              padding: '5px 12px',
              backgroundColor: 'var(--accent-color)',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 'bold'
            }}
          >
            + Add Table
          </button>
        </div>

        {/* Drag-and-Drop Tables */}
        {data.tables.map(table => (
          <div
            key={table.id}
            onMouseDown={(e) => handleTableDragStart(e, table.id)}
            style={{
              position: 'absolute',
              left: table.x,
              top: table.y,
              width: 250,
              backgroundColor: 'var(--bg-secondary)',
              border: selectedTableId === table.id ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              zIndex: selectedTableId === table.id ? 5 : 2,
              cursor: 'grab',
              overflow: 'hidden'
            }}
          >
            {/* Table Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderBottom: '1px solid var(--border-color)'
            }}>
              <input
                value={table.name}
                onChange={(e) => {
                  const newName = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                  updateSchemaData({
                    ...data,
                    tables: data.tables.map(t => t.id === table.id ? { ...t, name: newName } : t)
                  });
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 'bold',
                  fontSize: 13,
                  width: '70%',
                  outline: 'none'
                }}
              />
              <button 
                onClick={() => handleDeleteTable(table.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#f85149',
                  cursor: 'pointer',
                  fontSize: 12
                }}
              >
                ✕
              </button>
            </div>

            {/* Column List */}
            <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {table.columns.map(col => (
                <div key={col.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input
                      value={col.name}
                      onChange={(e) => handleUpdateColumn(table.id, col.id, { name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
                      style={{
                        flex: 1,
                        fontSize: 11,
                        padding: '2px 4px',
                        borderRadius: 4,
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        outline: 'none'
                      }}
                    />
                    <select
                      value={col.type}
                      onChange={(e) => handleUpdateColumn(table.id, col.id, { type: e.target.value })}
                      style={{
                        fontSize: 11,
                        padding: '2px',
                        borderRadius: 4,
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        outline: 'none'
                      }}
                    >
                      {SUPPORTED_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleDeleteColumn(table.id, col.id)}
                      style={{
                        border: 'none',
                        background: 'none',
                        color: '#ff4d4f',
                        cursor: 'pointer',
                        fontSize: 10
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 10, color: 'var(--text-secondary)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <input
                        type="checkbox"
                        checked={col.isPK}
                        onChange={(e) => handleUpdateColumn(table.id, col.id, { isPK: e.target.checked })}
                      />
                      PK
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <input
                        type="checkbox"
                        checked={col.isFK}
                        onChange={(e) => handleUpdateColumn(table.id, col.id, { isFK: e.target.checked })}
                      />
                      FK
                    </label>

                    {col.isFK && (
                      <div style={{ display: 'flex', gap: 2 }}>
                        <select
                          value={col.fkTableId || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            const targetTab = data.tables.find(t => t.id === val);
                            const firstCol = targetTab?.columns[0];
                            handleUpdateColumn(table.id, col.id, { 
                              fkTableId: val, 
                              fkColumnId: firstCol?.id 
                            });
                          }}
                          style={{ fontSize: 9, padding: '1px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                        >
                          <option value="">Table</option>
                          {data.tables.filter(t => t.id !== table.id).map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>

                        {col.fkTableId && (
                          <select
                            value={col.fkColumnId || ''}
                            onChange={(e) => handleUpdateColumn(table.id, col.id, { fkColumnId: e.target.value })}
                            style={{ fontSize: 9, padding: '1px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                          >
                            <option value="">Col</option>
                            {(data.tables.find(t => t.id === col.fkTableId)?.columns || []).map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              <button
                onClick={() => handleAddColumn(table.id)}
                style={{
                  padding: '4px',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  color: 'var(--text-primary)',
                  border: '1px dashed var(--border-color)',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 11
                }}
              >
                + Add Column
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Code Generation Panel */}
      <div style={{
        width: 380,
        borderLeft: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-secondary)',
        zIndex: 10
      }}>
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'rgba(255,255,255,0.02)'
        }}>
          {(['sql', 'prisma', 'knex'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: '12px 6px',
                background: activeTab === tab ? 'var(--bg-primary)' : 'none',
                border: 'none',
                color: activeTab === tab ? 'var(--accent-color)' : 'var(--text-secondary)',
                borderBottom: activeTab === tab ? '2px solid var(--accent-color)' : 'none',
                fontWeight: activeTab === tab ? 'bold' : 'normal',
                cursor: 'pointer',
                fontSize: 12,
                textTransform: 'uppercase'
              }}
            >
              {tab === 'sql' ? 'SQL DDL' : tab}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, padding: 12, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <pre style={{
            flex: 1,
            margin: 0,
            padding: 12,
            backgroundColor: '#050505',
            color: '#a9b1d6',
            borderRadius: 6,
            overflow: 'auto',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            whiteSpace: 'pre-wrap',
            border: '1px solid var(--border-color)'
          }}>
            {getCodeText()}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default SchemaDesigner;
