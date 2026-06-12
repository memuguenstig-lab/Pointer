import React, { useState, useEffect } from 'react';
import { FileSystemItem } from '../types';
import '../styles/App.css';

interface TableInfo {
  name: string;
  columns: string[];
}

interface QueryResult {
  columns: string[];
  rows: any[];
  error?: string;
}

const DatabaseViewer: React.FC<{ file: FileSystemItem }> = ({ file }) => {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<QueryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sqlQuery, setSqlQuery] = useState('');
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRepairing, setIsRepairing] = useState(false);

  // Fetch database schema (list of tables)
  useEffect(() => {
    const fetchSchema = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch('http://localhost:23816/database/schema', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ path: file.path }),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch database schema: ${response.statusText}`);
        }
        
        const data = await response.json();
        if (data.error) {
          throw new Error(data.error);
        }
        
        setTables(data.tables);
        if (data.tables.length > 0) {
          setSelectedTable(data.tables[0].name);
        }
      } catch (err) {
        console.error('Error fetching database schema:', err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSchema();
  }, [file.path]);

  // Fetch table data when a table is selected
  useEffect(() => {
    if (!selectedTable) return;
    
    const fetchTableData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch('http://localhost:23816/database/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            path: file.path,
            query: `SELECT * FROM "${selectedTable}" LIMIT 100`
          }),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch table data: ${response.statusText}`);
        }
        
        const data = await response.json();
        if (data.error) {
          throw new Error(data.error);
        }
        
        setTableData(data);
      } catch (err) {
        console.error('Error fetching table data:', err);
        setError(err instanceof Error ? err.message : String(err));
        setTableData(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchTableData();
  }, [selectedTable, file.path]);

  // Execute custom SQL query
  const executeQuery = async () => {
    if (!sqlQuery.trim()) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('http://localhost:23816/database/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          path: file.path,
          query: sqlQuery
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to execute query: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      
      setQueryResult(data);
    } catch (err) {
      console.error('Error executing query:', err);
      setError(err instanceof Error ? err.message : String(err));
      setQueryResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Repair database or create new one
  const repairDatabase = async () => {
    try {
      setIsRepairing(true);
      setError(null);
      
      const response = await fetch('http://localhost:23816/database/repair', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: file.path }),
      });
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Reload the schema after repair
      const schemaResponse = await fetch('http://localhost:23816/database/schema', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: file.path }),
      });
      
      const schemaData = await schemaResponse.json();
      
      if (schemaData.error) {
        throw new Error(schemaData.error);
      }
      
      setTables(schemaData.tables);
      if (schemaData.tables.length > 0) {
        setSelectedTable(schemaData.tables[0].name);
      }
      
      setQueryResult(null);
      setSqlQuery('');
      setError(null);
    } catch (err) {
      console.error('Error repairing database:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRepairing(false);
    }
  };

  // Check if the error is related to a corrupt database
  const isCorruptError = error && (
    error.includes("file is not a database") || 
    error.includes("corrupted") ||
    error.includes("malformed") ||
    error.includes("unable to open database") ||
    error.includes("unsupported file format")
  );

  return (
    <div className="database-viewer">
      <div className="database-header">
        <h3>SQLite Database: {file.name}</h3>
        <div className="database-path">{file.path}</div>
      </div>
      
      {error && (
        <div className="database-error">
          <div style={{ marginBottom: isCorruptError ? '10px' : '0' }}>{error}</div>
          
          {isCorruptError && (
            <button
              className="repair-button"
              onClick={repairDatabase}
              disabled={isRepairing}
            >
              {isRepairing ? 'Repairing...' : 'Repair/Create Database'}
            </button>
          )}
        </div>
      )}
      
      <div className="database-content">
        {/* Table list sidebar */}
        <div className="database-tables">
          <div className="tables-header">
            Tables
          </div>
          {tables.map(table => (
            <div 
              key={table.name}
              onClick={() => setSelectedTable(table.name)}
              className={`table-item ${selectedTable === table.name ? 'selected' : ''}`}
            >
              {table.name}
            </div>
          ))}
        </div>
        
        {/* Main content area */}
        <div className="database-main">
          {/* SQL query editor */}
          <div className="sql-editor">
            <div className="sql-editor-label">SQL Query</div>
            <div className="sql-editor-input-container">
              <textarea
                className="sql-textarea"
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                placeholder="Enter SQL query..."
              />
              <button
                className="execute-button"
                onClick={executeQuery}
                disabled={isLoading}
              >
                Execute
              </button>
            </div>
          </div>
          
          {/* Data table */}
          <div className="data-table-container">
            {isLoading ? (
              <div className="loading-indicator">Loading...</div>
            ) : queryResult ? (
              <div>
                <h4>Query Results</h4>
                <div style={{ overflowX: 'auto' }}>
                  <table className="database-table">
                    <thead>
                      <tr>
                        {queryResult.columns.map((column, i) => (
                          <th key={i}>{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {queryResult.rows.map((row, i) => (
                        <tr key={i}>
                          {queryResult.columns.map((column, j) => (
                            <td key={j}>
                              {row[column] === null ? 
                                <span className="null-value">NULL</span> : 
                                String(row[column])
                              }
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : selectedTable && tableData ? (
              <div>
                <h4>{selectedTable}</h4>
                <div style={{ overflowX: 'auto' }}>
                  <table className="database-table">
                    <thead>
                      <tr>
                        {tableData.columns.map((column, i) => (
                          <th key={i}>{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.rows.map((row, i) => (
                        <tr key={i}>
                          {tableData.columns.map((column, j) => (
                            <td key={j}>
                              {row[column] === null ? 
                                <span className="null-value">NULL</span> : 
                                String(row[column])
                              }
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                {tables.length === 0 ? 'No tables found in the database' : 'Select a table to view data'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatabaseViewer; 
