/**
 * TerminalBus — global event bus so the agent (ToolService) can push
 * commands into the active terminal and track their output.
 * Also emits command-error events when a command fails (non-zero exit).
 */

type BusListener = (event: TerminalBusEvent) => void;
type ErrorListener = (event: TerminalErrorEvent) => void;

export interface TerminalBusEvent {
  type: 'run-command';
  command: string;
  resolve: (output: string) => void;
}

export interface TerminalErrorEvent {
  command: string;
  output: string;
  exitCode: number;
}

class TerminalBusClass {
  private listeners: BusListener[] = [];
  private errorListeners: ErrorListener[] = [];

  subscribe(fn: BusListener) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter(l => l !== fn); };
  }

  subscribeErrors(fn: ErrorListener) {
    this.errorListeners.push(fn);
    return () => { this.errorListeners = this.errorListeners.filter(l => l !== fn); };
  }

  emit(event: TerminalBusEvent) {
    this.listeners.forEach(l => l(event));
  }

  emitError(event: TerminalErrorEvent) {
    this.errorListeners.forEach(l => l(event));
  }

  runCommand(command: string): Promise<string> {
    return new Promise(resolve => {
      this.emit({ type: 'run-command', command, resolve });
    });
  }
}

export const TerminalBus = new TerminalBusClass();
