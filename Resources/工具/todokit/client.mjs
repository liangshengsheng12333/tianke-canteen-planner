import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const base = path.dirname(fileURLToPath(import.meta.url));
const entry = await fs.realpath(path.join(base, 'node_modules/@j0hanz/todokit-mcp/dist/index.js'));
const require = createRequire(entry);
const { Client } = await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/index.js')));
const { StdioClientTransport } = await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/stdio.js')));
export async function connect(todoFile) {
  const client = new Client({ name: 'local-todo-verification', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [entry, '--todo-file', todoFile],
    cwd: 'D:/项目/cpp',
    stderr: 'pipe',
    env: { ...process.env, TODOKIT_JSON_PRETTY: 'true' },
  });
  await client.connect(transport);
  return client;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const client = await connect(process.argv[2]);
  try {
    if (process.argv[3]) {
      const request = JSON.parse(await fs.readFile(process.argv[3], 'utf8'));
      console.log(JSON.stringify(await client.callTool(request), null, 2));
    } else {
      console.log(JSON.stringify(await client.listTools(), null, 2));
    }
  } finally { await client.close(); }
}
