import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const serverDirectory = fileURLToPath(new URL('../server/', import.meta.url));
const index = fileURLToPath(new URL('../client/dist/index.html', import.meta.url));
if (!existsSync(index)) throw new Error('Build the frontend first with npm run build.');
process.chdir(serverDirectory);
process.env.NODE_ENV = 'production';
await import('../server/src/index.js');
