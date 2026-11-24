const root = document.querySelector('#admin-content');
let after = 0;
const pages = [];

async function api(action, body) {
  const response = await fetch('/api/pool/' + action, body === undefined ? {} : {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error), {status:response.status});
  return data;
}

function item(tag, text, parent) {
  const node = document.createElement(tag);
  node.textContent = text;
  parent.append(node);
  return node;
}

function login() {
  root.innerHTML = '<form><h2>Organizer sign-in</h2><label class="field">Email<input type="email" name="email" autocomplete="username" required></label>' +
    '<label class="field">Password<input type="password" name="password" autocomplete="current-password" required></label>' +
    '<button class="action">Sign in</button><p class="error" role="alert"></p></form>';
  const form = root.querySelector('form');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button');
    const error = form.querySelector('.error');
    button.disabled = true;
    error.textContent = '';
    try {
      await api('login',Object.fromEntries(new FormData(form)));
      after = 0;
      pages.length = 0;
      await load();
    } catch (cause) { error.textContent = cause.message; }
    finally { button.disabled = false; }
  });
}

function action(label, parent, handler) {
  const button = item('button', label, parent);
  button.type = 'button';
  button.className = 'action secondary';
  button.addEventListener('click', async () => {
    const error = root.querySelector('.error');
    error.textContent = '';
    button.disabled = true;
    try { await handler(); }
    catch (cause) {
      if (cause.status === 401) login();
      else error.textContent = cause.message;
    } finally { button.disabled = false; }
  });
  return button;
}

function dashboard(data) {
  root.innerHTML = '<div class="admin-actions" id="actions"><a href="/api/pool/export">Download CSV</a></div>' +
    '<p id="totals"></p><p id="collection" class="muted"></p><h2>Birth result</h2><form id="birth"><label class="field">Actual birth date and time (Toronto)' +
    '<input type="datetime-local" name="birth" required></label><button class="action">Save birth result</button></form>' +
    '<p class="muted">Saving the birth result closes entries. You can correct the date or time after saving.</p>' +
    '<p class="error" role="alert"></p><h2>Predictions</h2><div class="admin-table"><table><thead><tr><th>Reference</th><th>Participant</th><th>Slot</th>' +
    '<th>Wishes</th><th>Gift</th><th>Result</th></tr></thead><tbody></tbody></table></div><div class="admin-actions" id="pages"></div>';
  action('Sign out',root.querySelector('#actions'),async () => { await api('logout',{}); login(); });
  const total = new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(data.totals.collected_cents / 100);
  root.querySelector('#totals').textContent = total + ' CAD collected · ' + data.totals.received + ' confirmed gifts · ' + data.totals.entries + ' predictions';
  root.querySelector('#collection').textContent = data.collection ? 'Gift collection enabled' : 'Gift collection disabled';
  const form = root.querySelector('#birth');
  form.elements.birth.value = data.birth?.slice(0,16) ?? '';
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button');
    const error = root.querySelector('.error');
    button.disabled = true;
    error.textContent = '';
    try { await api('birth',{birth:form.elements.birth.value}); await load(); }
    catch (cause) {
      if (cause.status === 401) login();
      else error.textContent = cause.message;
    } finally { button.disabled = false; }
  });
  const tbody = root.querySelector('tbody');
  if (!data.entries.length) {
    const empty = item('td','No predictions yet.',item('tr','',tbody));
    empty.colSpan = 6;
  }
  for (const entry of data.entries) {
    const row = item('tr','',tbody);
    item('td',entry.reference,row);
    const participant = item('td',entry.name,row);
    item('div',entry.email,participant);
    item('td','Jan ' + entry.day + ' ' + entry.period,row);
    item('td',entry.wishes,row);
    const gift = item('td',entry.received_at ? 'Received · $5 CAD' : entry.gift_requested ? 'Awaiting $5 CAD' : 'No gift requested',row);
    if (entry.gift_requested && !entry.received_at && data.collection) {
      action('Confirm received',gift,async () => {
        await api('confirm',{reference:entry.reference});
        await load();
      });
    }
    item('td',data.birth ? entry.correct ? 'Correct' : '—' : 'Pending',row);
  }
  const pageControls = root.querySelector('#pages');
  if (pages.length) action('Previous page',pageControls,async () => {
    const cursor = pages.at(-1);
    await load(cursor);
    pages.pop();
    after = cursor;
    dashboard(lastData);
  });
  if (data.next) action('Next page',pageControls,async () => {
    const cursor = after;
    await load(data.next);
    pages.push(cursor);
    after = data.next;
    dashboard(lastData);
  });
}

let lastData;
async function load(cursor = after) {
  lastData = await api('dashboard?after=' + cursor);
  dashboard(lastData);
}

try { await load(); }
catch (cause) {
  if (cause.status === 401) login();
  else root.textContent = cause.status === 404 ? 'The organizer dashboard is available in live mode.' : cause.message;
}
