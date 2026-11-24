const root = document.querySelector('#pool');
const demo = root.dataset.mode === 'demo';
const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
let selected;
let requestId;
let sampleNumber = 0;
let closed = false;
let giftEnabled = false;
const banner = '';
const hero = '<section class="hero"><div class="hero-copy"><p class="hero-eyebrow">A little star is on his way</p><h1>Mahuvagara Baby Arrival Pool</h1><p class="hero-subtitle">Guess when our newest family member will arrive.</p><p class="hero-instructions">Pick a January date and choose AM or PM.</p><span class="badge"><span aria-hidden="true">✦</span> Expected January 21, 2027</span></div><div class="hero-art" aria-hidden="true"><svg viewBox="0 0 360 360" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="moon-glow" x1="100" y1="30" x2="260" y2="220" gradientUnits="userSpaceOnUse"><stop stop-color="#fff0bd"/><stop offset="1" stop-color="#e5bd75"/></linearGradient><linearGradient id="blanket" x1="120" y1="230" x2="240" y2="310" gradientUnits="userSpaceOnUse"><stop stop-color="#80baff"/><stop offset="1" stop-color="#376caf"/></linearGradient></defs><circle cx="180" cy="167" r="142" stroke="#294a70" stroke-dasharray="3 9"/><circle cx="180" cy="167" r="116" fill="#132b49" fill-opacity=".55"/><path d="M210 48a83 83 0 1 0 62 131A74 74 0 0 1 210 48Z" fill="url(#moon-glow)"/><path d="M180 194v31M128 192v45M232 192v45" stroke="#7e9bbc" stroke-width="2"/><path d="M116 192q64-27 128 0" stroke="#a8c7eb" stroke-width="3" stroke-linecap="round"/><path d="m128 230 4 9 10 1-8 7 2 10-8-5-9 5 2-10-8-7 10-1Z" fill="#efd193"/><path d="m232 230 4 9 10 1-8 7 2 10-8-5-9 5 2-10-8-7 10-1Z" fill="#efd193"/><circle cx="180" cy="246" r="21" fill="#f1d3b9"/><path d="M158 246a22 22 0 0 1 44 0q-23-12-44 0" fill="#a8d1ff"/><path d="M168 249q4 4 8 0m8 0q4 4 8 0" stroke="#725846" stroke-width="2" stroke-linecap="round"/><path d="M147 267q33-19 66 0l-8 28h-50Z" fill="url(#blanket)"/><path d="m164 266 33 27m-42-13 23 16" stroke="#b7d9ff" stroke-width="2" opacity=".6"/><path d="M129 283h102q-6 31-51 31t-51-31Z" fill="#213f63" stroke="#7b9fc8" stroke-width="2"/><path d="M147 311l-8 12m74-12 8 12m-87 3q46 15 92 0" stroke="#7b9fc8" stroke-width="3" stroke-linecap="round"/><path d="M59 269c-13-22-43-10-40 10-19 2-19 28 3 28h66c25 0 27-30 5-33-6-19-29-19-34-5Zm236-65c-12-19-36-8-34 9-17 2-17 23 2 23h55c22 0 23-25 4-28-5-16-24-16-27-4Z" fill="#244468"/><g fill="#b9d8ff"><path d="m78 83 3 10 10 3-10 3-3 10-3-10-10-3 10-3Zm208 38 3 10 10 3-10 3-3 10-3-10-10-3 10-3Zm-34-96 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"/><circle cx="103" cy="38" r="2"/><circle cx="310" cy="174" r="3"/><circle cx="57" cy="184" r="2"/><circle cx="280" cy="284" r="2"/></g></svg><span class="art-caption">One tiny arrival. So much love.</span></div></section>';

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
