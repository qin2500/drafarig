// Load a Showdown data/*.ts object-literal file without a TS toolchain (they are plain object literals).
import { readFileSync } from 'node:fs';
export function loadTsTable(path) {
  let src = readFileSync(path, 'utf8');
  src = src.replace(/^export const \w+\s*:\s*[^=]+=\s*/m, 'return ');
  return new Function(src)();
}
