import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';

// Suppress readline's echo for secrets; never retain an input history.
export function createTerminalInput() {
  let hidden = false;
  const controller = new AbortController();
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (!hidden) process.stdout.write(chunk, encoding);
      callback();
    },
  });
  const terminal = createInterface({ input: process.stdin, output, terminal: true, historySize: 0 });
  terminal.on('SIGINT', () => controller.abort());
  terminal.on('close', () => controller.abort());

  return {
    async ask(label, { secret = false } = {}) {
      controller.signal.throwIfAborted();
      hidden = secret;
      if (secret) process.stdout.write(label);
      try {
        return await terminal.question(secret ? '' : label, { signal: controller.signal });
      } finally {
        hidden = false;
        if (secret) process.stdout.write('\n');
      }
    },
    throwIfAborted: () => controller.signal.throwIfAborted(),
    close() { hidden = false; terminal.close(); output.end(); },
  };
}
