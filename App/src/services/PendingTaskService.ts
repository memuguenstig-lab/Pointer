/**
 * PendingTaskService — persists AI work state so it can be resumed
 * after a force-kill or crash.
 *
 * Writes a small JSON file to the backend's AppData directory.
 * The backend exposes /api/pending-task for read/write/clear.
 */

const BACKEND = 'http://127.0.0.1:23816';

export interface PendingTask {
  chatId: string;
  lastUserMessage: string;
  startedAt: number;
  /** Last assistant message content (partial, for display) */
  partialResponse?: string;
}

export const PendingTaskService = {
  async save(task: PendingTask): Promise<void> {
    try {
      await fetch(`${BACKEND}/api/pending-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task),
      });
    } catch (_) {}
  },

  async load(): Promise<PendingTask | null> {
    try {
      const res = await fetch(`${BACKEND}/api/pending-task`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.task ?? null;
    } catch (_) {
      return null;
    }
  },

  async clear(): Promise<void> {
    try {
      await fetch(`${BACKEND}/api/pending-task`, { method: 'DELETE' });
    } catch (_) {}
  },
};
