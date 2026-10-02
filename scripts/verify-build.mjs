import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractFile } from '@electron/asar';
import { SCOPE_UNITS } from '../src/model.js';

assert.ok(process.argv.length <= 3, 'Usage: node scripts/verify-build.mjs [package-directory]');
const root = fileURLToPath(new URL('../', import.meta.url));
const directory = path.resolve(root, process.argv[2] || 'release/Monday-win32-x64');
const archive = path.join(directory, 'resources/app.asar');
const files = ['index.html', 'src/app.js', 'src/model.js', 'src/style.css', 'electron/main.cjs', 'electron/preload.cjs'];

for (const file of files) {
  assert.ok(extractFile(archive, file).equals(readFileSync(path.join(root, file))), `${file}: packaged file differs from source`);
}

const expectedPackage = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
// Electron Packager removes development-only metadata from the bundled package.
for (const field of ['scripts', 'devDependencies', 'private']) delete expectedPackage[field];
assert.deepEqual(JSON.parse(extractFile(archive, 'package.json').toString()), expectedPackage, 'Packaged runtime metadata differs from source');

const app = extractFile(archive, 'src/app.js').toString();
const subjectFields = app.match(/function subjectFields\b[\s\S]*?(?=\r?\nfunction )/)?.[0];
assert.ok(subjectFields, 'Subject form is missing');
assert.doesNotMatch(subjectFields, /weekday-picker|name=["']weekday["']|공부할 요일/, 'Subject form still contains weekday selection');
assert.match(subjectFields, /name="rounds"/, 'Subject form is missing target reading rounds');
assert.match(subjectFields, /SCOPE_UNITS\.map/, 'Subject form must use the supported study scopes');
assert.deepEqual(SCOPE_UNITS, ['단원', '챕터', '주차']);

console.log(`Verified ${files.length} packaged files, runtime metadata, and subject form: ${directory}`);
