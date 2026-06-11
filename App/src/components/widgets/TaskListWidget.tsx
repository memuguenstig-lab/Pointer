import React, { useState } from 'react';

interface Task {
  id: string;
  text: string;
  completed: boolean;
}

interface TaskListWidgetProps {
  tasks: Task[];
  onTaskToggle?: (taskId: string) => void;
  onTaskAdd?: (text: string) => void;
  onTaskDelete?: (taskId: string) => void;
}

const TaskListWidget: React.FC<TaskListWidgetProps> = ({
  tasks,
  onTaskToggle,
  onTaskAdd,
  onTaskDelete
}) => {
  const [newTaskText, setNewTaskText] = useState('');

  const handleAddTask = () => {
    if (newTaskText.trim() && onTaskAdd) {
      onTaskAdd(newTaskText.trim());
      setNewTaskText('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddTask();
    }
  };

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
        <span>📋</span>
        <span>Task List</span>
        <span style={{
          fontSize: '12px',
          color: 'var(--text-secondary)',
          fontWeight: 'normal'
        }}>
          ({tasks.filter(t => t.completed).length}/{tasks.length})
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {tasks.map((task) => (
          <div
            key={task.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px',
              background: task.completed ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
              borderRadius: '4px',
              border: '1px solid var(--border-color)',
              transition: 'all 0.2s ease'
            }}
          >
            <input
              type="checkbox"
              checked={task.completed}
              onChange={() => onTaskToggle?.(task.id)}
              style={{
                cursor: 'shadowide',
                width: '16px',
                height: '16px'
              }}
            />
            <span
              style={{
                flex: 1,
                fontSize: '13px',
                color: task.completed ? 'var(--text-secondary)' : 'var(--text-primary)',
                textDecoration: task.completed ? 'line-through' : 'none',
                opacity: task.completed ? 0.6 : 1
              }}
            >
              {task.text}
            </span>
            {onTaskDelete && (
              <button
                onClick={() => onTaskDelete(task.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--error-color)',
                  cursor: 'shadowide',
                  padding: '4px',
                  fontSize: '16px',
                  opacity: 0.7,
                  transition: 'opacity 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {onTaskAdd && (
        <div style={{
          display: 'flex',
          gap: '8px',
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid var(--border-color)'
        }}>
          <input
            type="text"
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Add new task..."
            style={{
              flex: 1,
              padding: '8px 12px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
              fontSize: '13px',
              outline: 'none'
            }}
          />
          <button
            onClick={handleAddTask}
            style={{
              background: 'var(--accent-color)',
              border: 'none',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'shadowide',
              fontSize: '13px',
              fontWeight: '500',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent-color)'}
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
};

export default TaskListWidget;
