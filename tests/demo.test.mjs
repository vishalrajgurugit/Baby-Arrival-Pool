import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

function node() {
  return {
    dataset:{}, elements:{}, hidden:false, handlers:{}, children:[],
    setAttribute() {}, removeAttribute() {}, focus() {},
    addEventListener(event,handler) { this.handlers[event] = handler; },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    insertBefore(child) { this.children.unshift(child); },
  };
}

test('standalone demo renders 62 slots and saves repeat predictions without contacting a server', async () => {
  const preview = readFileSync(new URL('../Baby-Arrival-Pool-2027-Preview.html',import.meta.url),'utf8');
  const source = readFileSync(new URL('../public/pool.mjs',import.meta.url),'utf8');
  assert.ok(preview.includes(source));
  const root = node();
  root.dataset.mode = 'demo';
  const form = node();
  const name = {value:'',focus(){}};
  form.elements = {name,email:{value:''},wishes:{value:''},secondDay:{value:''},secondPeriod:{value:''}};
  form.querySelectorAll = () => Object.values(form.elements);
  const receipt = node();
  const calendar = node();
  const submit = node();
  const selection = node();
  const nodes = {'form':form,'#receipt':receipt,'.calendar':calendar,'#submit':submit,
    '#selection':selection,'#form-error':node(),'#gift-status':node()};
  root.querySelector = selector => nodes[selector];
  const document = {querySelector: () => root, createElement: tag => ({...node(),tag})};
  const FormData = function (form) {
    return Object.entries(form.elements).map(([key,value]) => [key,value.value]);
  };
  runInNewContext(source,{document,FormData,fetch(){ throw new Error('Demo must be offline'); }});
  assert.equal((root.innerHTML.match(/class="slot /g) ?? []).length,62);
  assert.match(root.innerHTML,/class="day due"><div class="day-number">21/);
  const slot = node();
  slot.dataset = {day:'21',period:'PM'};
  slot.closest = () => slot;
  calendar.handlers.click({target:slot});
  form.children[0].handlers.click();
  assert.equal(name.value,'Alex Taylor');
  const event = {preventDefault(){}};
  await form.handlers.submit(event);
  assert.equal(receipt.hidden,false);
  assert.match(receipt.children[1].textContent,/January 21 · PM and January 22 · AM/);
  assert.match(receipt.children[2].textContent,/DEMO-0001/);
  assert.equal(receipt.children.some(child => child.tag === 'a'),false);
  receipt.children.at(-1).handlers.click();
  await form.handlers.submit(event);
  assert.match(receipt.children[2].textContent,/DEMO-0002/);
});


test('invitation fragments preserve Base64 plus signs and decode escaped characters', () => {
  const source = readFileSync(new URL('../public/pool.mjs',import.meta.url),'utf8');
  const parser = source.slice(source.indexOf('function invitationToken('),source.indexOf('async function api('));
  const parse = runInNewContext(parser + '; invitationToken');
  assert.equal(parse('#invite=abc+def/ghi=='),'abc+def/ghi==');
  assert.equal(parse('#invite=abc%2Bdef%2Fghi%3D%3D'),'abc+def/ghi==');
  assert.equal(parse('#invite=a%26b%23c%25d'),'a&b#c%d');
  assert.equal(parse('#other=value'),null);
  assert.throws(() => parse('#invite=%broken'),/not encoded correctly/);
});
