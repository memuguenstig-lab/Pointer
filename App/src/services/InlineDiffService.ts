import * as monaco from 'monaco-editor';

export interface InlineDiff {
  filePath: string;
  oldContent: string;
  newContent: string;
  decorations?: monaco.editor.IEditorDecorationsCollection;
}

type DiffListener = (diffs: Map<string, InlineDiff>) => void;

class InlineDiffServiceClass {
  private diffs = new Map<string, InlineDiff>();
  private listeners: DiffListener[] = [];
  private editorRegistry = new Map<string, monaco.editor.IStandaloneCodeEditor>();

  /** Register an editor instance for a file path */
  registerEditor(filePath: string, editor: monaco.editor.IStandaloneCodeEditor) {
    this.editorRegistry.set(filePath, editor);
    // Apply any pending diff for this file
    const diff = this.diffs.get(filePath);
    if (diff) this.applyDecorations(diff, editor);
  }

  unregisterEditor(filePath: string) {
    this.editorRegistry.delete(filePath);
  }

  subscribe(listener: DiffListener) {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  /** Add or update a diff for a file */
  setDiff(filePath: string, oldContent: string, newContent: string) {
    const existing = this.diffs.get(filePath);
    existing?.decorations?.clear();

    const diff: InlineDiff = { filePath, oldContent, newContent };
    this.diffs.set(filePath, diff);

    const editor = this.editorRegistry.get(filePath);
    if (editor) this.applyDecorations(diff, editor);

    this.notify();
  }

  /** Accept a diff — write new content to editor model */
  accept(filePath: string) {
    const diff = this.diffs.get(filePath);
    if (!diff) return;
    const editor = this.editorRegistry.get(filePath);
    if (editor) {
      const model = editor.getModel();
      if (model) model.setValue(diff.newContent);
      diff.decorations?.clear();
    }
    this.diffs.delete(filePath);
    this.notify();
  }

  /** Reject a diff — restore old content */
  reject(filePath: string) {
    const diff = this.diffs.get(filePath);
    if (!diff) return;
    const editor = this.editorRegistry.get(filePath);
    if (editor) {
      const model = editor.getModel();
      if (model) model.setValue(diff.oldContent);
      diff.decorations?.clear();
    }
    this.diffs.delete(filePath);
    this.notify();
  }

  acceptAll() {
    for (const filePath of this.diffs.keys()) this.accept(filePath);
  }

  rejectAll() {
    for (const filePath of this.diffs.keys()) this.reject(filePath);
  }

  getDiffs() { return this.diffs; }

  hasDiff(filePath: string) { return this.diffs.has(filePath); }

  private notify() { this.listeners.forEach(l => l(this.diffs)); }

  private applyDecorations(diff: InlineDiff, editor: monaco.editor.IStandaloneCodeEditor) {
    const model = editor.getModel();
    if (!model) return;

    // Compute line-level diff
    const oldLines = diff.oldContent.split('\n');
    const newLines = diff.newContent.split('\n');
    const decorations: monaco.editor.IModelDeltaDecoration[] = [];

    // Simple LCS-based line diff
    const changes = computeLineDiff(oldLines, newLines);

    // Apply new content to model first
    model.setValue(diff.newContent);

    // Add decorations for added/modified lines
    for (const change of changes) {
      if (change.type === 'add' || change.type === 'modify') {
        for (let ln = change.newStart; ln <= change.newEnd; ln++) {
          decorations.push({
            range: new monaco.Range(ln, 1, ln, 1),
            options: {
              isWholeLine: true,
              className: change.type === 'add' ? 'inline-diff-added' : 'inline-diff-modified',
              linesDecorationsClassName: change.type === 'add' ? 'inline-diff-added-gutter' : 'inline-diff-modified-gutter',
              overviewRuler: {
                color: change.type === 'add' ? '#3fb950' : '#e3b341',
                position: monaco.editor.OverviewRulerLane.Left,
              },
            },
          });
        }
      }
      if (change.type === 'delete' || change.type === 'modify') {
        // Show deleted lines as a marker at the insertion point
        const insertLine = Math.min(change.newStart, model.getLineCount());
        decorations.push({
          range: new monaco.Range(insertLine, 1, insertLine, 1),
          options: {
            before: {
              content: change.deletedLines?.join('\n') ?? '',
              inlineClassName: 'inline-diff-deleted-text',
            },
            linesDecorationsClassName: 'inline-diff-deleted-gutter',
          },
        });
      }
    }

    diff.decorations = editor.createDecorationsCollection(decorations);
  }
}

interface LineChange {
  type: 'add' | 'delete' | 'modify';
  oldStart: number;
  oldEnd: number;
  newStart: number;
  newEnd: number;
  deletedLines?: string[];
}

function computeLineDiff(oldLines: string[], newLines: string[]): LineChange[] {
  // Simple Myers-like diff — good enough for line-level decorations
  const changes: LineChange[] = [];
  let oi = 0, ni = 0;

  while (oi < oldLines.length || ni < newLines.length) {
    if (oi >= oldLines.length) {
      // Rest are additions
      changes.push({ type: 'add', oldStart: oi + 1, oldEnd: oi + 1, newStart: ni + 1, newEnd: newLines.length });
      break;
    }
    if (ni >= newLines.length) {
      // Rest are deletions
      changes.push({ type: 'delete', oldStart: oi + 1, oldEnd: oldLines.length, newStart: ni + 1, newEnd: ni + 1, deletedLines: oldLines.slice(oi) });
      break;
    }
    if (oldLines[oi] === newLines[ni]) {
      oi++; ni++;
    } else {
      // Find next matching line (lookahead 8)
      let addCount = 0, delCount = 0;
      for (let k = 1; k <= 8; k++) {
        if (ni + k < newLines.length && newLines[ni + k] === oldLines[oi]) { addCount = k; break; }
      }
      for (let k = 1; k <= 8; k++) {
        if (oi + k < oldLines.length && oldLines[oi + k] === newLines[ni]) { delCount = k; break; }
      }
      if (addCount > 0 && (delCount === 0 || addCount <= delCount)) {
        changes.push({ type: 'add', oldStart: oi + 1, oldEnd: oi + 1, newStart: ni + 1, newEnd: ni + addCount });
        ni += addCount;
      } else if (delCount > 0) {
        changes.push({ type: 'delete', oldStart: oi + 1, oldEnd: oi + delCount, newStart: ni + 1, newEnd: ni + 1, deletedLines: oldLines.slice(oi, oi + delCount) });
        oi += delCount;
      } else {
        changes.push({ type: 'modify', oldStart: oi + 1, oldEnd: oi + 1, newStart: ni + 1, newEnd: ni + 1, deletedLines: [oldLines[oi]] });
        oi++; ni++;
      }
    }
  }
  return changes;
}

export const InlineDiffService = new InlineDiffServiceClass();
