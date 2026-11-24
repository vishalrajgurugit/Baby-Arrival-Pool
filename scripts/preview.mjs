import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const html = '<!doctype html><html lang="en-CA"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1">' +
  '<meta name="robots" content="noindex,nofollow"><title>Mahuvagara Baby Arrival Pool 2027 · Demo</title>' +
  '<style>' + read('public/pool.css') + '</style></head><body>' +
  '<main id="pool" data-mode="demo" aria-busy="true"></main><script type="module">' +
  read('public/pool.mjs') + '</script></body></html>';
writeFileSync(new URL('../Baby-Arrival-Pool-2027-Preview.html',import.meta.url), html);
mkdirSync(new URL('../docs/',import.meta.url), {recursive:true});
writeFileSync(new URL('../docs/index.html',import.meta.url), html);
console.log('Open Baby-Arrival-Pool-2027-Preview.html in your browser.');
