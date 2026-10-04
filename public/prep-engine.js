// The vendored damage engine: its same-origin path and pins (test/calc-engine.test.mjs checks them against
// public/vendor/smogon-calc.SOURCE.json). The engine is loaded only when a calc screen opens; the set editor, Speed
// ladder and briefs use lib/calc/stats.mjs and never load it.
export const ENGINE_PATH = './vendor/smogon-calc-0.12.0.mjs';
export const ENGINE_INFO = Object.freeze({
  name: '@smogon/calc', version: '0.12.0',
  sha256: '8e94c611e12b0b37169d8b9f5a33b346d755561973551573e182c2a777fe4857',
});

/** The only dynamic import in Prep: the same-origin vendored engine module. */
export const importEngine = () => import('./vendor/smogon-calc-0.12.0.mjs');
