/**
 * SplitEditor — VSCode-style split editor with multiple independent panes.
 * Each pane has its own tab bar and editor instance.
 * Supports Ctrl+\ to split, drag-to-move tabs between panes.
 */
import React, { useState, useCallback, useRef } from 'react';
import { FileSystemItem, TabInfo } from '../types';
import Tabs from './Tabs';
import EditorGrid from './EditorGrid';

export interface EditorGroup {
  id: string;
  openFiles: string[];
  currentFileId: string | null;
}

interface SplitEditorProps {
  items: Record<string, FileSystemItem>;
  groups: EditorGroup[];
  activeGroupId: string;
  onGroupsChange: (groups: EditorGroup[]) => void;
  onActiveGroupChange: (id: string) => void;
  onEditorChange?: (editor: any) => void;
  setSaveStatus?: (status: 'saving' | 'saved' | 'error' | null) => void;
  previewTabs?: TabInfo[];
  currentPreviewTabId?: string | null;
  onPreviewToggle?: (fileId: string) => void;
  onPreviewTabSelect?: (tabId: string) => void;
  onPreviewTabClose?: (tabId: string) => void;
  isGridLayout?: boolean;
  onToggleGrid?: () => void;
}

const SplitEditor: React.FC<SplitEditorProps> = ({
  items,
  groups,
  activeGroupId,
  onGroupsChange,
  onActiveGroupChange,
  onEditorChange,
  setSaveStatus,
  previewTabs = [],
  currentPreviewTabId,
  onPreviewToggle,
  onPreviewTabSelect,
  onPreviewTabClose,
  isGridLayout,
  onToggleGrid,
}) => {
  const dragTabRef = useRef<{ fileId: string; fromGroupId: string } | null>(null);

  const updateGroup = useCallback((groupId: string, patch: Partial<EditorGroup>) => {
    onGroupsChange(groups.map(g => g.id === groupId ? { ...g, ...patch } : g));
  }, [groups, onGroupsChange]);

  const handleTabSelect = (groupId: string, fileId: string) => {
    updateGroup(groupId, { currentFileId: fileId });
    onActiveGroupChange(groupId);
  };

  const handleTabClose = (groupId: string, fileId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const newFiles = group.openFiles.filter(f => f !== fileId);
    const newCurrent = group.currentFileId === fileId
      ? (newFiles[newFiles.length - 1] ?? null)
      : group.currentFileId;

    if (newFiles.length === 0 && groups.length > 1) {
      // Remove empty group
      const newGroups = groups.filter(g => g.id !== groupId);
      onGroupsChange(newGroups);
      onActiveGroupChange(newGroups[0].id);
    } else {
      updateGroup(groupId, { openFiles: newFiles, currentFileId: newCurrent });
    }
  };

  const handleSplit = useCallback((fromGroupId: string) => {
    const fromGroup = groups.find(g => g.id === fromGroupId);
    if (!fromGroup || !fromGroup.currentFileId) return;
    const newGroup: EditorGroup = {
      id: `group-${Date.now()}`,
      openFiles: [fromGroup.currentFileId],
      currentFileId: fromGroup.currentFileId,
    };
    onGroupsChange([...groups, newGroup]);
    onActiveGroupChange(newGroup.id);
  }, [groups, onGroupsChange, onActiveGroupChange]);

  const handleDragStart = (fileId: string, fromGroupId: string) => {
    dragTabRef.current = { fileId, fromGroupId };
  };

  const handleDrop = (toGroupId: string) => {
    const drag = dragTabRef.current;
    if (!drag || drag.fromGroupId === toGroupId) return;

    const fromGroup = groups.find(g => g.id === drag.fromGroupId);
    const toGroup = groups.find(g => g.id === toGroupId);
    if (!fromGroup || !toGroup) return;

    const newFromFiles = fromGroup.openFiles.filter(f => f !== drag.fileId);
    const newToFiles = toGroup.openFiles.includes(drag.fileId)
      ? toGroup.openFiles
      : [...toGroup.openFiles, drag.fileId];

    const newGroups = groups.map(g => {
      if (g.id === drag.fromGroupId) {
        return { ...g, openFiles: newFromFiles, currentFileId: newFromFiles[newFromFiles.length - 1] ?? null };
      }
      if (g.id === toGroupId) {
        return { ...g, openFiles: newToFiles, currentFileId: drag.fileId };
      }
      return g;
    }).filter(g => g.openFiles.length > 0 || groups.length === 1);

    onGroupsChange(newGroups.length > 0 ? newGroups : [{ id: 'group-1', openFiles: [], currentFileId: null }]);
    onActiveGroupChange(toGroupId);
    dragTabRef.current = null;
  };

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: '100%' }}>
      {groups.map((group, idx) => (
        <React.Fragment key={group.id}>
          {idx > 0 && (
            <div style={{ width: 1, background: 'var(--border-color)', flexShrink: 0 }} />
          )}
          <div
            style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}
            onClick={() => onActiveGroupChange(group.id)}
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(group.id)}
          >
            {/* Tab bar with split button */}
            <div style={{ display: 'flex', alignItems: 'stretch', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <Tabs
                  openFiles={group.openFiles}
                  currentFileId={group.currentFileId}
                  items={items}
                  onTabSelect={fid => handleTabSelect(group.id, fid)}
                  onTabClose={fid => handleTabClose(group.id, fid)}
                  previewTabs={group.id === activeGroupId ? previewTabs : []}
                  currentPreviewTabId={group.id === activeGroupId ? currentPreviewTabId : null}
                  onPreviewToggle={group.id === activeGroupId ? onPreviewToggle : undefined}
                  onPreviewTabSelect={group.id === activeGroupId ? onPreviewTabSelect : undefined}
                  onPreviewTabClose={group.id === activeGroupId ? onPreviewTabClose : undefined}
                  isGridLayout={isGridLayout}
                  onToggleGrid={group.id === activeGroupId ? onToggleGrid : undefined}
                />
              </div>
              {/* Split button */}
              <button
                onClick={e => { e.stopPropagation(); handleSplit(group.id); }}
                title="Split Editor (Ctrl+\\)"
                style={{ padding: '0 8px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0, fontSize: 14 }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="1" y="1" width="14" height="14" rx="1.5"/>
                  <path d="M8 1v14"/>
                </svg>
              </button>
              {/* Close group button (only if more than 1 group) */}
              {groups.length > 1 && (
                <button
                  onClick={e => { e.stopPropagation(); const ng = groups.filter(g => g.id !== group.id); onGroupsChange(ng); onActiveGroupChange(ng[0].id); }}
                  title="Close Editor Group"
                  style={{ padding: '0 6px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0, fontSize: 12 }}
                >✕</button>
              )}
            </div>

            {/* Editor */}
            <EditorGrid
              openFiles={group.openFiles}
              currentFileId={group.currentFileId}
              items={items}
              onEditorChange={group.id === activeGroupId ? onEditorChange : undefined}
              onTabClose={fid => handleTabClose(group.id, fid)}
              isGridLayout={false}
              onToggleGrid={() => {}}
              setSaveStatus={group.id === activeGroupId ? setSaveStatus : undefined}
              previewTabs={group.id === activeGroupId ? previewTabs : []}
              currentPreviewTabId={group.id === activeGroupId ? currentPreviewTabId : null}
            />
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};

export default SplitEditor;
