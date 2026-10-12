import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
export interface LogEvent { level: 'info' | 'warn' | 'error'; event: string; requestId?: string; feature?: string; command?: string; durationMs?: number; errorName?: string; errorCode?: string; frames?: string[] }
export class Diagnostics {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private file: string, private output: (line: string) => void = console.log) {}
  requestId() { return randomUUID(); }
  record(event: LogEvent) {
    const line = JSON.stringify({ time: new Date().toISOString(), ...event }); this.output(line);
    this.queue = this.queue.then(async () => { await mkdir(path.dirname(this.file), { recursive: true }); await appendFile(this.file, line + '\n'); }).catch(() => console.error('{"level":"error","event":"log_write_failed"}'));
  }
  exception(error: unknown, context: Omit<LogEvent, 'level' | 'event'>) {
    const e = error instanceof Error ? error : undefined;
    this.record({ level: 'error', event: 'request_exception', ...context, errorName: e?.name ?? 'UnknownError', errorCode: typeof (e as NodeJS.ErrnoException)?.code === 'string' ? (e as NodeJS.ErrnoException).code : undefined, frames: e?.stack?.split('\n').slice(1, 7).filter(frame => frame.trim().startsWith('at ')) });
  }
  async flush() { await this.queue; }
}
// Never log request bodies, credentials, tokens, account names, hands, or deck order.
export function safeCommand(input: unknown): string {
  const candidate = typeof input === 'object' && input !== null && 'type' in input ? (input as { type: unknown }).type : '';
  return typeof candidate === 'string' && ['create','join','resume','ready','format','start','action','register','login','list','save','delete','logout','profile','collection','view'].includes(candidate) ? candidate : 'invalid';
}
