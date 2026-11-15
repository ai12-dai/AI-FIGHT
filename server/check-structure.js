// Runs before `npm run build` (npm "prebuild" hook). If the repository was
// uploaded without its folders (e.g. everything dropped into the root), this
// prints a clear explanation instead of a cryptic bundler error.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'client/index.html',
  'client/vite.config.js',
  'client/src/main.jsx',
  'client/public/assets/fighters/deadline.png',
  'client/public/assets/arenas/sakura_dojo.jpg',
  'server/index.js',
  'server/mockJudge.js',
  'server/rules.js',
];
const missing = required.filter((p) => !fs.existsSync(path.join(root, p)));
if (missing.length) {
  console.error('\n✖ AI FIGHT: project folders are missing. Not found:\n  ' + missing.join('\n  '));
  console.error('\nThe repository must keep the folders client/ and server/ (with their subfolders).');
  console.error('If you uploaded through the GitHub website, drag the FOLDERS client and server');
  console.error('(not the files inside them) in Chrome/Edge/Firefox. See README.md.\n');
  process.exit(1);
}
console.log('✓ AI FIGHT project structure OK');
