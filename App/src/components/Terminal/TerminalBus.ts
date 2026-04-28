/**
 * TerminalBus — global event bus so the agent (ToolService) can push
 * commands into the active terminal and track their output.
 */

type BusListener = (event: TerminalBusEvent) => void;

export interface TerminalBusEvent {
  type: 'run-command';
  command: string;
  resolve: (output: string) => void;
}

class TerminalBusClass {
  private listeners: BusListener[] = [];

  subscribe(fn: BusListener) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter(l => l !== fn); };
  }

  emit(event: TerminalBusEvent) {
    this.listeners.forEach(l => l(event));
  }

  runCommand(command: string): Promise<string> {
    return new Promise(resolve => {
      this.emit({ type: 'run-command', command, resolve });
    });
  }
}

export const TerminalBus = new TerminalBusClass();
