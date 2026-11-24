// Run with: node tests/browser.mjs "path/to/chrome-or-edge"
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

const browser = process.argv[2];
if (!browser) throw new Error('Pass the installed Chrome or Edge executable path.');
const folder = mkdtempSync(join(tmpdir(),'baby-pool-test-'));
try {
  const preview = readFileSync(new URL('../Baby-Arrival-Pool-2027-Preview.html',import.meta.url),'utf8');
  const harness = `<script type="module">
    function check(value, message) { if (!value) throw new Error(message); }
    try {
      check(document.querySelectorAll('.slot').length === 62, 'Missing slots');
      check(document.querySelector('.due .slot').dataset.day === '21', 'Incorrect due date');
      check(document.querySelectorAll('.calendar > :nth-child(-n+12)').length === 12, 'Incorrect row alignment');
      document.querySelector('[data-day="21"][data-period="PM"]').click();
      const form = document.querySelector('#prediction');
      form.querySelector('button[type="button"]').click();
      check(form.reportValidity(), 'Demo sample is invalid');
      form.requestSubmit();
      const receipt = document.querySelector('#receipt');
      check(!receipt.hidden && receipt.textContent.includes('January 21 · PM'), 'Slot confirmation missing');
      check(!receipt.querySelector('a'), 'Gift instructions visible in demo');
      const first = receipt.textContent;
      receipt.querySelector('button').click();
      form.requestSubmit();
      check(receipt.textContent !== first && receipt.textContent.includes('DEMO-0002'), 'Duplicate slot did not generate a new reference');
      document.body.dataset.testResult = 'passed';
    } catch (error) { document.body.dataset.testResult = error.message; }
    </script>`;
  const file = join(folder,'test.html');
  writeFileSync(file,preview.replace('</body>',harness + '</body>'));
  const result = spawnSync(browser,['--headless','--disable-gpu','--no-first-run',
    '--user-data-dir=' + join(folder,'profile'),'--dump-dom',pathToFileURL(file).href],
    {encoding:'utf8',timeout:20000,windowsHide:true});
  if (result.error) throw result.error;
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout, /<body data-test-result="passed"/,
    result.stdout.match(/<body[^>]*>/)?.[0] || result.stderr);
  console.log('Browser flow passed: calendar, due date, demo details, receipt, duplicate slot and gift collection off.');
} finally {
  rmSync(folder,{recursive:true,force:true,maxRetries:3});
}
