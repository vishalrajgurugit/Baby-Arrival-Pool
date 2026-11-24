const root = document.querySelector('#pool');
const demo = root.dataset.mode === 'demo';
const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
let selected;
let requestId;
let sampleNumber = 0;
let closed = false;
let giftEnabled = false;
const banner = '<header class="top"><div class="brand"><span class="brand-mark" aria-hidden="true">✦</span> Mahuvagara Baby Arrival Pool</div><span class="badge">' + (demo ? 'Demo preview' : 'Private family pool') + '</span></header>';
const hero = '<section class="hero"><div class="hero-copy"><h1>Mahuvagara Baby Arrival Pool <span class="year">2027</span></h1><p>Guess when our newest family member will arrive. Pick a January date and choose AM or PM.</p><span class="badge">Expected January 21, 2027</span></div><span class="cloud" aria-hidden="true">☁</span><span class="spark" aria-hidden="true">✧</span></section>';

async function api(action, body) {
  const response = await fetch('/api/pool/' + action, body === undefined ? {} : {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Please try again.');
  return data;
}

function calendar() {
  const cells = days.map(day => '<div class="weekday">' + day + '</div>');
  for (let i=0; i<5; i++) cells.push('<div class="calendar-spacer" aria-hidden="true"></div>');
  for (let day=1; day<=31; day++) {
    const due = day === 21;
    const buttons = ['AM','PM'].map(period =>
      '<button class="slot ' + period.toLowerCase() + '" type="button" data-day="' + day +
      '" data-period="' + period + '" aria-label="January ' + day + ' ' + period +
      '" aria-pressed="false"' + (closed ? ' disabled' : '') + '>' + period + '</button>').join('');
    cells.push('<div class="day' + (due?' due':'') + '"><div class="day-number">' + day +
      '<span class="day-weekday">' + days[(day + 4) % 7] + '</span>' +
      (due?'<span class="due-symbol" aria-label="Expected due date">✦</span>':'') +
      '</div><div class="slots">' + buttons + '</div></div>');
  }
  return cells.join('');
}

function render() {
  root.innerHTML = '<div class="shell">' + banner + hero +
    '<div class="workspace"><section class="card" aria-labelledby="month"><h2 id="month">January 2027</h2>' +
    '<p class="muted">Toronto time · AM before noon · PM from noon</p><div class="calendar">' +
    calendar() + '</div><p class="legend">✦ Expected due date. Any number of people can pick the same slot.</p></section>' +
    '<section class="card"><h2>Make a prediction</h2><p class="muted">$5 CAD per prediction when gift collection is open. All gifts go to the baby. There are no monetary prizes.</p>' +
    '<p class="muted" id="gift-status"></p><form id="prediction"><span class="selection" id="selection" role="status">Choose a date and time</span>' +
    '<label class="field">Your name<input name="name" maxlength="100" placeholder="Alex Taylor" autocomplete="name" required></label>' +
    '<label class="field">Email address<input name="email" type="email" maxlength="254" placeholder="alex@example.com" autocomplete="email" required></label>' +
    '<label class="field">Wishes for the baby <span class="muted">(optional)</span><textarea name="wishes" rows="3" maxlength="1000" placeholder="A little note for the family"></textarea></label>' +
    '<button class="action wide" id="submit" disabled>Save prediction</button><p class="error" role="alert" id="form-error"></p></form>' +
    '<div id="receipt" class="receipt" tabindex="-1" role="status" hidden></div></section></div></div>';
  const form = root.querySelector('form');
  const submit = root.querySelector('#submit');
  const error = root.querySelector('#form-error');
  const receipt = root.querySelector('#receipt');
  root.querySelector('#gift-status').textContent = closed ? 'Predictions are closed.' :
    giftEnabled ? 'Interac e-Transfer instructions appear after you save your prediction.' :
    demo ? 'Try a sample entry. Gift collection is off in the demo.' : 'Gift collection is currently off. You can still save a prediction.';
  form.hidden = closed;
  if (demo) {
    const sample = document.createElement('button');
    sample.type = 'button';
    sample.className = 'action secondary';
    sample.textContent = 'Use sample details';
    sample.addEventListener('click', () => {
      form.elements.name.value = 'Alex Taylor';
      form.elements.email.value = 'alex@example.com';
      form.elements.wishes.value = 'Wishing you a lifetime of love and laughter!';
    });
    form.insertBefore(sample,form.firstChild);
  }
  root.querySelector('.calendar').addEventListener('click', event => {
    const button = event.target.closest('.slot');
    if (!button || button.disabled || submit.dataset.busy) return;
    root.querySelector('[aria-pressed="true"]')?.setAttribute('aria-pressed','false');
    button.setAttribute('aria-pressed','true');
    selected = {day:Number(button.dataset.day),period:button.dataset.period};
    requestId = undefined;
    root.querySelector('#selection').textContent = 'January ' + selected.day + ' · ' + selected.period;
    receipt.hidden = true;
    error.textContent = '';
    submit.disabled = false;
  });
  form.addEventListener('input', () => { requestId = undefined; });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!selected || submit.dataset.busy) return;
    submit.dataset.busy = 'true';
    submit.disabled = true;
    const fields = [...form.querySelectorAll('input,textarea')];
    const data = Object.fromEntries(new FormData(form));
    fields.forEach(field => { field.readOnly = true; });
    error.textContent = '';
    try {
      if (!data.name.trim()) throw new Error('Enter your name.');
      const result = demo
        ? {reference:'DEMO-' + String(++sampleNumber).padStart(4,'0') + '-' + Math.random().toString(36).slice(2,8).toUpperCase()}
        : await api('submit', {...selected,...data,requestId:requestId ??= crypto.randomUUID()});
      const heading = document.createElement('h2');
      heading.textContent = demo ? 'Sample prediction saved' : 'Prediction saved';
      const slot = document.createElement('p');
      slot.textContent = 'January ' + selected.day + ' · ' + selected.period + ' (Toronto time)';
      const ref = document.createElement('p');
      ref.textContent = 'Confirmation reference: ' + result.reference;
      receipt.replaceChildren(heading,slot,ref);
      if (result.transferEmail) {
        const instructions = document.createElement('p');
        instructions.append('Send $5 CAD by Interac e-Transfer to ');
        const email = document.createElement('a');
        email.href = 'mailto:' + result.transferEmail;
        email.textContent = result.transferEmail;
        instructions.append(email, '. Include your confirmation reference in the transfer message. The organizer will confirm receipt manually.');
        receipt.append(instructions);
      }
      const again = document.createElement('button');
      again.className = 'action secondary';
      again.textContent = 'Make another prediction';
      again.addEventListener('click', () => {
        receipt.hidden = true;
        form.hidden = false;
        form.elements.name.focus();
      });
      receipt.append(again);
      requestId = undefined;
      form.elements.wishes.value = '';
      form.hidden = true;
      receipt.hidden = false;
      receipt.focus();
    } catch (cause) {
      error.textContent = cause.message || 'Please try again.';
    } finally {
      fields.forEach(field => { field.readOnly = false; });
      delete submit.dataset.busy;
      submit.disabled = false;
    }
  });
}

async function start() {
  try {
    if (!demo) {
      const token = new URLSearchParams(location.hash.slice(1)).get('invite');
      if (token) {
        await api('invite',{token});
        history.replaceState(null,'',location.pathname + location.search);
      }
      const status = await api('status');
      closed = status.closed;
      giftEnabled = status.collection;
    }
    render();
  } catch (cause) {
    root.innerHTML = '<div class="shell">' + banner + hero + '<section class="card"><h2>Private invitation required</h2><p id="access-error"></p></section></div>';
    root.querySelector('#access-error').textContent = cause.message;
  } finally {
    root.removeAttribute('aria-busy');
  }
}
start();
