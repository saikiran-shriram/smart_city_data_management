'use strict';

/* ---------------------------------------------------------------- helpers */
const $ = (s, r = document) => r.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const money = (n) => inr.format(Number(n) || 0);
const fmtDate = (s) => {
  if (!s) return '-';
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => toISO(new Date());
const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return toISO(d); };

const TYPE_LABEL = { property_tax: 'Property tax', water: 'Water', electricity: 'Electricity' };
const PROP_LABEL = { residential: 'Residential', commercial: 'Commercial', industrial: 'Industrial', agricultural: 'Agricultural' };
const GENDER = { M: 'Male', F: 'Female', O: 'Other' };

const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  userplus: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>',
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  key: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
  receipt: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  printer: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  menu: '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
};
const icon = (name) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

async function api(url, method = 'GET', body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch('/api' + url, opts);
  } catch {
    throw new Error('Cannot reach the server. Check that "npm start" is running.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function toast(message, isError = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' err' : '');
  el.textContent = message;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

function modal(title, bodyHtml, { wide = false } = {}) {
  const el = document.createElement('div');
  el.className = 'overlay';
  el.innerHTML = `
    <div class="dialog ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header><h2>${esc(title)}</h2>
        <button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></header>
      <div class="dialog-body">${bodyHtml}</div>
    </div>`;
  $('#modal-root').appendChild(el);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  function close() { el.remove(); document.removeEventListener('keydown', onKey); }
  el.addEventListener('mousedown', (e) => { if (e.target === el) close(); });
  el.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', onKey);
  const first = el.querySelector('input:not([type=hidden]), select, button.btn');
  if (first) first.focus();
  return { el, close, body: $('.dialog-body', el) };
}

function confirmBox({ title, body, confirmText, danger = false }) {
  return new Promise((resolve) => {
    const m = modal(title, `
      ${body}
      <div class="form-actions">
        <button class="btn secondary" data-no>Cancel</button>
        <button class="btn ${danger ? 'danger solid' : ''}" data-yes>${esc(confirmText)}</button>
      </div>`);
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } m.close(); };
    m.el.querySelector('[data-no]').addEventListener('click', () => finish(false));
    m.el.querySelector('[data-yes]').addEventListener('click', () => finish(true));
    m.el.querySelector('[data-close]').addEventListener('click', () => finish(false));
    m.el.addEventListener('mousedown', (e) => { if (e.target === m.el) finish(false); });
  });
}

// Wires a form: validates, disables the button while saving, shows server errors inline.
function bindForm(form, handler) {
  const err = form.querySelector('.form-error');
  const btn = form.querySelector('button[type=submit]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    if (!form.reportValidity()) return;
    const label = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = 'Saving...';
    try {
      await handler(Object.fromEntries(new FormData(form)));
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
      err.scrollIntoView({ block: 'nearest' });
    } finally {
      btn.disabled = false;
      btn.innerHTML = label;
    }
  });
}

const options = (list, value, label, blank) =>
  (blank ? `<option value="">${esc(blank)}</option>` : '') +
  list.map((x) => `<option value="${esc(value(x))}">${esc(label(x))}</option>`).join('');

const badge = (state) => `<span class="badge ${esc(state)}">${esc(state[0].toUpperCase() + state.slice(1))}</span>`;
const empty = (title, text) => `<div class="empty"><strong>${esc(title)}</strong>${esc(text)}</div>`;
const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/* --------------------------------------------------------------- register */
const recentList = (rows) => rows.length
  ? `<ul class="rows">${rows.map((c) => `
      <li>
        <div class="grow"><b>${esc(c.name)}</b><span>Registered ${fmtDate(c.registration_date)}</span></div>
        <span class="tag num">ID ${c.citizen_id}</span>
      </li>`).join('')}</ul>`
  : empty('Nobody registered yet', 'The first citizen you register will appear here.');

async function registerView() {
  const [meta, recent] = await Promise.all([api('/meta'), api('/citizens?limit=4')]);
  const html = `
    <div class="reg-layout">
      <form id="reg" class="panel" novalidate>
        <div class="panel-body" style="padding-top:22px">
          <div class="success" id="reg-ok" role="status" hidden></div>
          <div class="form-error" role="alert" hidden></div>

          <h2 class="form-h">Personal details</h2>
          <div class="grid2">
            <div class="field"><label for="f-name">Full name</label>
              <input id="f-name" name="name" class="input" required minlength="2" maxlength="50" autocomplete="off"></div>
            <div class="field"><label for="f-phone">Mobile number</label>
              <input id="f-phone" name="phone" class="input" required inputmode="numeric" pattern="[0-9]{10}" maxlength="10" placeholder="10 digits">
              <small>Each number can be registered once.</small></div>
            <div class="field"><label for="f-email">Email</label>
              <input id="f-email" name="email" type="email" class="input" maxlength="100" placeholder="Optional"></div>
            <div class="grid2">
              <div class="field"><label for="f-gender">Gender</label>
                <select id="f-gender" name="gender" class="input" required>
                  <option value="">Choose</option><option value="M">Male</option><option value="F">Female</option><option value="O">Other</option></select></div>
              <div class="field"><label for="f-dob">Date of birth</label>
                <input id="f-dob" name="dob" type="date" class="input" required max="${today()}"></div>
            </div>
          </div>

          <h2 class="form-h">Address</h2>
          <div class="grid2">
            ${meta.address_has_street ? `<div class="field" style="grid-column:1/-1"><label for="f-street">Street</label>
              <input id="f-street" name="street" class="input" maxlength="100"></div>` : ''}
            <div class="field"><label for="f-area">Area</label>
              <input id="f-area" name="area" class="input" required maxlength="50" placeholder="For example, Navi Peth"></div>
            <div class="field"><label for="f-city">City</label>
              <input id="f-city" name="city" class="input" required maxlength="50" value="Solapur"></div>
            <div class="field"><label for="f-state">State</label>
              <input id="f-state" name="state" class="input" required maxlength="50" value="Maharashtra"></div>
            <div class="field"><label for="f-pin">Pincode</label>
              <input id="f-pin" name="pincode" class="input" required inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="6 digits"></div>
          </div>

          <h2 class="form-h">Identity document <span class="muted" style="font-weight:400;font-size:14px">(optional)</span></h2>
          <div class="grid2">
            <div class="field"><label for="f-doctype">Document type</label>
              <select id="f-doctype" name="doc_type" class="input">
                <option value="">None for now</option><option>Aadhaar</option><option>PAN</option><option>VoterID</option></select></div>
            <div class="field"><label for="f-docno">Document number</label>
              <input id="f-docno" name="doc_number" class="input" autocomplete="off" disabled>
              <small id="doc-hint"></small></div>
          </div>

          <div class="form-actions">
            <button class="btn" type="submit">${icon('check')} Register citizen</button>
          </div>
        </div>
      </form>

      <aside class="reg-side">
        <section class="panel">
          <div class="panel-head"><h2>What gets saved</h2></div>
          <div class="panel-body">
            <ol class="steps">
              <li><span class="n">1</span><div><b>Citizen</b><span class="d">Name, phone, email, date of birth</span></div><code class="tbl">citizen</code></li>
              <li><span class="n">2</span><div><b>Address</b><span class="d">Linked with the new citizen ID</span></div><code class="tbl">address</code></li>
              <li><span class="n">3</span><div><b>Document</b><span class="d">Only if you add one</span></div><code class="tbl">document</code></li>
            </ol>
            <p class="muted note">All of this is saved as one transaction. If any step fails, nothing is kept.</p>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>Registered just now</h2><a class="btn secondary sm" href="#citizens">View all</a></div>
          <div class="panel-body" id="recent">${recentList(recent)}</div>
        </section>
      </aside>
    </div>`;

  const mount = (root) => {
    const form = $('#reg', root);
    const ok = $('#reg-ok', root);
    const dt = $('#f-doctype', root);
    const dn = $('#f-docno', root);
    const hint = $('#doc-hint', root);
    const HINTS = { '': 'Choose a document type first.', Aadhaar: '12 digits, for example 123456789012', PAN: 'Format ABCDE1234F', VoterID: 'Format ABC1234567' };
    const syncDoc = () => {
      const t = dt.value;
      dn.disabled = !t;
      dn.required = !!t;
      dn.maxLength = t === 'Aadhaar' ? 12 : 10;
      if (!t) dn.value = '';
      hint.textContent = HINTS[t];
    };
    dt.addEventListener('change', syncDoc);
    form.addEventListener('reset', () => setTimeout(syncDoc));
    syncDoc();

    bindForm(form, async (v) => {
      ok.hidden = true;
      const res = await api('/citizens', 'POST', {
        name: v.name, email: v.email, phone: v.phone, gender: v.gender, dob: v.dob,
        address: { street: v.street, area: v.area, city: v.city, state: v.state, pincode: v.pincode },
        document: { doc_type: v.doc_type, doc_number: v.doc_number },
      });
      form.reset();
      ok.innerHTML = `<span><b>${esc(v.name)}</b> is registered. Citizen ID <b class="num">${res.citizen_id}</b>.</span>
        <a class="btn secondary sm" href="#citizens">See all citizens</a>`;
      ok.hidden = false;
      ok.scrollIntoView({ block: 'nearest' });
      $('#recent', root).innerHTML = recentList(await api('/citizens?limit=4'));
      $('#f-name', root).focus();
    });
  };
  return { html, mount };
}

/* --------------------------------------------------------------- citizens */
function citizenTable(rows) {
  if (!rows.length) return empty('No citizens found', 'Try a different name or phone number, or register a new citizen.');
  return `<table>
    <thead><tr><th>ID</th><th>Citizen</th><th>Phone</th><th>Gender</th><th>Date of birth</th><th>City</th><th class="r">Properties</th><th>Registered</th></tr></thead>
    <tbody>${rows.map((c) => `
      <tr class="click" tabindex="0" data-id="${c.citizen_id}">
        <td class="num">${c.citizen_id}</td>
        <td><b>${esc(c.name)}</b><span class="sub">${esc(c.email || 'No email')}</span></td>
        <td class="num">${esc(c.phone)}</td>
        <td>${esc(GENDER[c.gender] || c.gender)}</td>
        <td>${fmtDate(c.dob)}</td>
        <td>${esc(c.city || '-')}</td>
        <td class="r num">${c.properties_owned}</td>
        <td>${fmtDate(c.registration_date)}</td>
      </tr>`).join('')}</tbody></table>`;
}

async function citizensView() {
  const rows = await api('/citizens');
  const html = `
    <div class="toolbar">
      <div class="search">${icon('search')}
        <input id="q" class="input" type="search" placeholder="Search by name, phone, email or ID" aria-label="Search citizens"></div>
      <span class="count muted num" id="count">${rows.length} registered</span>
      <span class="spacer"></span>
      <a class="btn" href="#register">${icon('userplus')} Register citizen</a>
    </div>
    <div class="panel"><div class="table-wrap" id="tbl">${citizenTable(rows)}</div></div>`;
  const mount = (root) => {
    const tbl = $('#tbl', root);
    $('#q', root).addEventListener('input', debounce(async (e) => {
      try {
        const found = await api('/citizens?q=' + encodeURIComponent(e.target.value));
        tbl.innerHTML = citizenTable(found);
        $('#count', root).textContent = `${found.length} found`;
      } catch (ex) { toast(ex.message, true); }
    }));
    const open = (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) openCitizen(Number(tr.dataset.id)); };
    tbl.addEventListener('click', open);
    tbl.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(e); });
  };
  return { html, mount };
}

async function openCitizen(id) {
  let d;
  try { d = await api('/citizens/' + id); } catch (ex) { return toast(ex.message, true); }
  const c = d.citizen;
  const m = modal(c.name, `
    <dl class="detail-grid">
      <div><dt>Citizen ID</dt><dd class="num">${c.citizen_id}</dd></div>
      <div><dt>Phone</dt><dd class="num">${esc(c.phone)}</dd></div>
      <div><dt>Email</dt><dd>${esc(c.email || '-')}</dd></div>
      <div><dt>Gender</dt><dd>${esc(GENDER[c.gender] || c.gender)}</dd></div>
      <div><dt>Date of birth</dt><dd>${fmtDate(c.dob)}</dd></div>
      <div><dt>Registered on</dt><dd>${fmtDate(c.registration_date)}</dd></div>
    </dl>

    <h3 class="section-title">Addresses</h3>
    ${d.addresses.length ? `<ul class="rows">${d.addresses.map((a) => `
      <li><div class="grow"><b>${esc([a.street, a.area].filter(Boolean).join(', '))}</b>
        <span>${esc(a.city)}, ${esc(a.state)} - ${esc(a.pincode)}</span></div></li>`).join('')}</ul>` : '<p class="muted">No address saved.</p>'}

    <h3 class="section-title">Identity documents</h3>
    ${d.documents.length ? `<ul class="rows">${d.documents.map((x) => `
      <li><div class="grow"><b>${esc(x.doc_type)}</b><span class="num">${esc(x.doc_number)}</span></div></li>`).join('')}</ul>`
      : '<p class="muted">No document on file.</p>'}

    <h3 class="section-title">Properties owned</h3>
    ${d.owned.length ? `<ul class="rows">${d.owned.map((p) => `
      <li><div class="grow"><b>${esc(p.prop_address)}</b><span>${esc(PROP_LABEL[p.prop_type] || p.prop_type)}</span></div>
        ${p.unpaid_bills ? `<span class="badge unpaid">${p.unpaid_bills} unpaid</span>` : '<span class="badge paid">All paid</span>'}</li>`).join('')}</ul>`
      : '<p class="muted">Does not own a property.</p>'}

    ${d.renting.length ? `<h3 class="section-title">Rents</h3>
    <ul class="rows">${d.renting.map((r) => `
      <li><div class="grow"><b>${esc(r.prop_address)}</b>
        <span>${money(r.monthly_rent)} a month, from ${fmtDate(r.start_date)}</span></div>
        <span class="badge ${esc(r.status)}">${esc(r.status)}</span></li>`).join('')}</ul>` : ''}

    <div class="form-actions">
      <button class="btn danger" data-del>${icon('trash')} Delete citizen</button>
    </div>`, { wide: true });

  m.el.querySelector('[data-del]').addEventListener('click', async () => {
    let impact;
    try { impact = await api(`/citizens/${id}/impact`); } catch (ex) { return toast(ex.message, true); }
    const lines = [
      [impact.addresses, 'address(es)'], [impact.documents, 'document(s)'], [impact.properties, 'owned property(ies)'],
      [impact.bills, 'bill(s) on those properties'], [impact.rentals, 'rental agreement(s)'],
    ].filter(([n]) => n > 0);
    const ok = await confirmBox({
      title: `Delete ${c.name}?`, confirmText: 'Delete citizen', danger: true,
      body: `<p>This removes the citizen record.</p>
        <div class="impact"><b>ON DELETE CASCADE will also remove:</b>
          ${lines.length ? `<ul>${lines.map(([n, t]) => `<li>${n} ${t}</li>`).join('')}</ul>` : '<p>Nothing else is linked.</p>'}</div>`,
    });
    if (!ok) return;
    try {
      await api('/citizens/' + id, 'DELETE');
      m.close();
      toast('Citizen deleted with all linked records.');
      route();
    } catch (ex) { toast(ex.message, true); }
  });
}

/* ------------------------------------------------------------- properties */
function propertyTable(rows) {
  if (!rows.length) return empty('No properties found', 'Add a property and link it to its owner.');
  return `<table>
    <thead><tr><th>ID</th><th>Property</th><th>Type</th><th>Owner</th><th>Tenant</th><th class="r">Pending dues</th></tr></thead>
    <tbody>${rows.map((p) => `
      <tr class="click" tabindex="0" data-id="${p.property_id}">
        <td class="num">${p.property_id}</td>
        <td><b>${esc(p.prop_address)}</b></td>
        <td><span class="tag">${esc(PROP_LABEL[p.prop_type] || p.prop_type)}</span></td>
        <td>${esc(p.owner_name)}</td>
        <td>${p.tenant_name ? esc(p.tenant_name) : '<span class="muted">None</span>'}</td>
        <td class="r num">${p.pending_amount > 0 ? money(p.pending_amount) : '<span class="muted">Nil</span>'}</td>
      </tr>`).join('')}</tbody></table>`;
}

async function propertiesView() {
  const rows = await api('/properties');
  const html = `
    <div class="toolbar">
      <div class="search">${icon('search')}
        <input id="q" class="input" type="search" placeholder="Search by address, owner or type" aria-label="Search properties"></div>
      <span class="spacer"></span>
      <button class="btn" id="add">${icon('plus')} Add property</button>
    </div>
    <div class="panel"><div class="table-wrap" id="tbl">${propertyTable(rows)}</div></div>`;
  const mount = (root) => {
    const tbl = $('#tbl', root);
    $('#q', root).addEventListener('input', debounce(async (e) => {
      try { tbl.innerHTML = propertyTable(await api('/properties?q=' + encodeURIComponent(e.target.value))); }
      catch (ex) { toast(ex.message, true); }
    }));
    const open = (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) openProperty(Number(tr.dataset.id)); };
    tbl.addEventListener('click', open);
    tbl.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(e); });
    $('#add', root).addEventListener('click', openPropertyForm);
  };
  return { html, mount };
}

async function openPropertyForm() {
  let lk, meta;
  try { [lk, meta] = await Promise.all([api('/lookups'), api('/meta')]); } catch (ex) { return toast(ex.message, true); }
  const m = modal('Add property', `
    <form novalidate>
      <div class="form-error" role="alert" hidden></div>
      <div class="grid2">
        <div class="field"><label for="p-owner">Owner</label>
          <select id="p-owner" name="owner_id" class="input" required>
            ${options(lk.citizens, (c) => c.id, (c) => `${c.name} (ID ${c.id})`, 'Choose a citizen')}</select>
          <small>The owner must be a registered citizen.</small></div>
        <div class="field"><label for="p-type">Property type</label>
          <select id="p-type" name="prop_type" class="input" required>
            ${options(Object.entries(PROP_LABEL), (x) => x[0], (x) => x[1], 'Choose a type')}</select></div>
        <div class="field" style="grid-column:1/-1"><label for="p-addr">Property address</label>
          <input id="p-addr" name="prop_address" class="input" required minlength="5" maxlength="150" placeholder="Plot or shop number, locality, city"></div>
        ${meta.property_has_area ? `<div class="field"><label for="p-area">Area (sq ft)</label>
          <input id="p-area" name="area_sqft" type="number" min="1" step="any" class="input"></div>` : ''}
      </div>
      <div class="form-actions">
        <button type="button" class="btn secondary" data-close>Cancel</button>
        <button class="btn" type="submit">${icon('check')} Save property</button>
      </div>
    </form>`);
  bindForm(m.el.querySelector('form'), async (v) => {
    await api('/properties', 'POST', v);
    m.close();
    toast('Property added.');
    route();
  });
}

async function openProperty(id) {
  const m = modal('Property', '<div class="loading"><div class="spin"></div>Loading</div>', { wide: true });
  const fill = async () => {
    let d;
    try { d = await api('/properties/' + id); } catch (ex) { m.close(); return toast(ex.message, true); }
    const p = d.property;
    m.body.innerHTML = `
      <dl class="detail-grid">
        <div style="grid-column:1/-1"><dt>Address</dt><dd>${esc(p.prop_address)}</dd></div>
        <div><dt>Type</dt><dd>${esc(PROP_LABEL[p.prop_type] || p.prop_type)}</dd></div>
        <div><dt>Owner</dt><dd>${esc(p.owner_name)}</dd></div>
        <div><dt>Owner phone</dt><dd class="num">${esc(p.owner_phone)}</dd></div>
      </dl>

      <div class="sec-head">
        <h3 class="section-title">Bills</h3>
        <button class="btn sm" data-bill>${icon('plus')} Generate bill</button>
      </div>
      ${d.bills.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Type</th><th>Period</th><th class="r">Amount</th><th>Due</th><th>Status</th><th></th></tr></thead>
        <tbody>${d.bills.map((b) => `
          <tr><td>${esc(TYPE_LABEL[b.bill_type] || b.bill_type)}</td>
            <td class="num">${esc(b.billing_period || '-')}</td>
            <td class="r num">${money(b.amount)}</td><td>${fmtDate(b.due_date)}</td><td>${badge(b.state)}</td>
            <td class="r">${b.state === 'paid' ? '' : `<button class="btn sm" data-pay="${b.bill_id}">Pay</button>`}</td></tr>`).join('')}</tbody></table></div>`
        : '<p class="muted">No bills generated yet.</p>'}

      ${d.rentals.length ? `<h3 class="section-title">Tenants</h3>
      <ul class="rows">${d.rentals.map((r) => `
        <li><div class="grow"><b>${esc(r.tenant_name)}</b>
          <span>${money(r.monthly_rent)} a month, ${fmtDate(r.start_date)} to ${r.end_date ? fmtDate(r.end_date) : 'open'}</span></div>
          <span class="badge ${esc(r.status)}">${esc(r.status)}</span></li>`).join('')}</ul>` : ''}`;
    m.body.querySelector('[data-bill]').addEventListener('click', async () => {
      if (await openBillForm(id)) await fill();
    });
    m.body.querySelectorAll('[data-pay]').forEach((btn) => btn.addEventListener('click', async () => {
      const bill = d.bills.find((b) => b.bill_id === Number(btn.dataset.pay));
      if (await payFlow({ ...bill, prop_address: p.prop_address, owner_name: p.owner_name })) await fill();
    }));
  };
  await fill();
}

/* ------------------------------------------------------------------ bills */
function billTable(rows) {
  if (!rows.length) return empty('No bills match', 'Change the filters, or generate a new bill.');
  return `<table>
    <thead><tr><th>ID</th><th>Bill</th><th>Property</th><th class="r">Amount</th><th>Due</th><th>Status</th><th></th></tr></thead>
    <tbody>${rows.map((b) => `
      <tr><td class="num">${b.bill_id}</td>
        <td><b>${esc(TYPE_LABEL[b.bill_type] || b.bill_type)}</b><span class="sub num">${esc(b.billing_period || '')}</span></td>
        <td>${esc(b.prop_address)}<span class="sub">${esc(b.owner_name)}</span></td>
        <td class="r num">${money(b.amount)}</td>
        <td>${fmtDate(b.due_date)}</td>
        <td>${badge(b.state)}${b.state === 'paid' && b.payment_date ? `<span class="sub">on ${fmtDate(b.payment_date)}</span>` : ''}</td>
        <td class="r">${b.state === 'paid'
          ? `<button class="btn secondary sm" data-receipt="${b.bill_id}">Receipt</button>`
          : `<button class="btn sm" data-pay="${b.bill_id}">Pay</button>`}</td></tr>`).join('')}</tbody></table>`;
}

async function billsView() {
  const f = { status: '', type: '', q: '' };
  const qs = () => '?' + new URLSearchParams(Object.fromEntries(Object.entries(f).filter(([, v]) => v))).toString();
  let rows = await api('/bills');
  const chips = [['', 'All'], ['unpaid', 'Unpaid'], ['overdue', 'Overdue'], ['paid', 'Paid']];
  const html = `
    <div class="toolbar">
      <div class="chips" role="group" aria-label="Filter by status">
        ${chips.map(([v, l]) => `<button class="chip" data-status="${v}" aria-pressed="${v === ''}">${l}</button>`).join('')}
      </div>
      <select id="type" class="input" style="width:auto" aria-label="Filter by bill type">
        <option value="">All types</option>
        ${Object.entries(TYPE_LABEL).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
      <div class="search">${icon('search')}
        <input id="q" class="input" type="search" placeholder="Search property, owner or bill ID" aria-label="Search bills"></div>
      <span class="spacer"></span>
      <button class="btn" id="add">${icon('plus')} Generate bill</button>
    </div>
    <div class="panel"><div class="table-wrap" id="tbl">${billTable(rows)}</div></div>`;

  const mount = (root) => {
    const tbl = $('#tbl', root);
    const reload = async () => {
      try { rows = await api('/bills' + qs()); tbl.innerHTML = billTable(rows); }
      catch (ex) { toast(ex.message, true); }
    };
    root.querySelectorAll('.chip').forEach((chip) => chip.addEventListener('click', () => {
      f.status = chip.dataset.status;
      root.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      reload();
    }));
    $('#type', root).addEventListener('change', (e) => { f.type = e.target.value; reload(); });
    $('#q', root).addEventListener('input', debounce((e) => { f.q = e.target.value.trim(); reload(); }));
    $('#add', root).addEventListener('click', async () => { if (await openBillForm()) route(); });
    tbl.addEventListener('click', async (e) => {
      const pay = e.target.closest('[data-pay]');
      const rec = e.target.closest('[data-receipt]');
      if (pay) {
        const bill = rows.find((b) => b.bill_id === Number(pay.dataset.pay));
        if (await payFlow(bill)) route();
      }
      if (rec) showReceipt(rows.find((b) => b.bill_id === Number(rec.dataset.receipt)));
    });
  };
  return { html, mount };
}

// Resolves true when a bill was created.
async function openBillForm(propertyId) {
  let lk;
  try { lk = await api('/lookups'); } catch (ex) { toast(ex.message, true); return false; }
  return new Promise((resolve) => {
    const m = modal('Generate bill', `
      <form novalidate>
        <div class="form-error" role="alert" hidden></div>
        <div class="grid2">
          <div class="field" style="grid-column:1/-1"><label for="b-prop">Property</label>
            <select id="b-prop" name="prop_id" class="input" required>
              ${options(lk.properties, (p) => p.id, (p) => `${p.address} (owner ${p.owner_name})`, 'Choose a property')}</select></div>
          <div class="field"><label for="b-type">Bill type</label>
            <select id="b-type" name="bill_type" class="input" required>
              ${options(Object.entries(TYPE_LABEL), (x) => x[0], (x) => x[1], 'Choose a type')}</select></div>
          <div class="field"><label for="b-amount">Amount (INR)</label>
            <input id="b-amount" name="amount" type="number" min="1" step="0.01" class="input" required></div>
          <div class="field"><label for="b-period">Billing month</label>
            <input id="b-period" name="billing_period" type="month" class="input" required value="${today().slice(0, 7)}">
            <small>One bill per type and month for each property.</small></div>
          <div class="field"><label for="b-due">Due date</label>
            <input id="b-due" name="due_date" type="date" class="input" required value="${inDays(15)}"></div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn secondary" data-close>Cancel</button>
          <button class="btn" type="submit">${icon('check')} Generate bill</button>
        </div>
      </form>`);
    if (propertyId) m.el.querySelector('#b-prop').value = String(propertyId);
    let created = false;
    const observer = new MutationObserver(() => {
      if (!document.body.contains(m.el)) { observer.disconnect(); resolve(created); }
    });
    observer.observe($('#modal-root'), { childList: true });
    bindForm(m.el.querySelector('form'), async (v) => {
      await api('/bills', 'POST', v);
      created = true;
      m.close();
      toast('Bill generated.');
    });
  });
}

// Resolves true when the bill was paid.
async function payFlow(bill) {
  const ok = await confirmBox({
    title: 'Pay this bill?', confirmText: `Pay ${money(bill.amount)}`,
    body: `<dl class="detail-grid" style="grid-template-columns:1fr 1fr">
      <div><dt>Bill</dt><dd>${esc(TYPE_LABEL[bill.bill_type] || bill.bill_type)} ${esc(bill.billing_period || '')}</dd></div>
      <div><dt>Amount</dt><dd class="num">${money(bill.amount)}</dd></div>
      <div style="grid-column:1/-1"><dt>Property</dt><dd>${esc(bill.prop_address)}</dd></div></dl>
      <p class="muted">The payment is saved as one transaction. It either completes fully or not at all.</p>`,
  });
  if (!ok) return false;
  try {
    const { receipt } = await api(`/bills/${bill.bill_id}/pay`, 'POST');
    toast('Payment recorded.');
    showReceipt(receipt);
    return true;
  } catch (ex) {
    toast(ex.message, true);
    return false;
  }
}

function showReceipt(b) {
  const m = modal('Payment receipt', `
    <div class="receipt">
      <h3>Smart Solapur</h3>
      <p class="muted">Property tax and utility bill receipt</p>
      <span class="paid-stamp">PAID</span>
      <dl>
        <dt>Receipt no.</dt><dd class="num">RCPT-${b.bill_id}-${String(b.payment_date || today()).replace(/-/g, '')}</dd>
        <dt>Bill</dt><dd>${esc(TYPE_LABEL[b.bill_type] || b.bill_type)}, ${esc(b.billing_period || '')}</dd>
        <dt>Property</dt><dd>${esc(b.prop_address)}</dd>
        <dt>Owner</dt><dd>${esc(b.owner_name)}</dd>
        <dt>Paid on</dt><dd>${fmtDate(b.payment_date || today())}</dd>
        <dt>Amount paid</dt><dd class="total num">${money(b.amount)}</dd>
      </dl>
    </div>
    <div class="form-actions">
      <button class="btn secondary" data-close>Close</button>
      <button class="btn" data-print>${icon('printer')} Print receipt</button>
    </div>`);
  m.el.querySelector('[data-print]').addEventListener('click', () => window.print());
}

/* ---------------------------------------------------------------- rentals */
async function rentalsView() {
  const rows = await api('/rentals');
  const html = `
    <div class="toolbar">
      <span class="muted">A tenant is a registered citizen. This table links the tenant to the property.</span>
      <span class="spacer"></span>
      <button class="btn" id="add">${icon('plus')} New agreement</button>
    </div>
    <div class="panel"><div class="table-wrap">
      ${rows.length ? `<table>
        <thead><tr><th>ID</th><th>Property</th><th>Tenant</th><th class="r">Rent</th><th>Period</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows.map((r) => `
          <tr><td class="num">${r.rental_id}</td>
            <td><b>${esc(r.prop_address)}</b><span class="sub">Owner: ${esc(r.owner_name)}</span></td>
            <td>${esc(r.tenant_name)}</td>
            <td class="r num">${money(r.monthly_rent)}</td>
            <td>${fmtDate(r.start_date)} to ${r.end_date ? fmtDate(r.end_date) : 'open'}</td>
            <td><span class="badge ${esc(r.status)}">${esc(r.status)}</span></td>
            <td class="r">${r.status === 'active' ? `<button class="btn secondary sm" data-end="${r.rental_id}">End rental</button>` : ''}</td></tr>`).join('')}
        </tbody></table>` : empty('No rental agreements', 'Create one to link a tenant to a property.')}
    </div></div>`;
  const mount = (root) => {
    $('#add', root).addEventListener('click', openRentalForm);
    root.querySelectorAll('[data-end]').forEach((btn) => btn.addEventListener('click', async () => {
      const ok = await confirmBox({
        title: 'End this rental?', confirmText: 'End rental',
        body: '<p>The agreement is marked as ended and its end date becomes today. The record stays for history.</p>',
      });
      if (!ok) return;
      try { await api(`/rentals/${btn.dataset.end}/end`, 'POST'); toast('Rental ended.'); route(); }
      catch (ex) { toast(ex.message, true); }
    }));
  };
  return { html, mount };
}

async function openRentalForm() {
  let lk;
  try { lk = await api('/lookups'); } catch (ex) { return toast(ex.message, true); }
  const m = modal('New rental agreement', `
    <form novalidate>
      <div class="form-error" role="alert" hidden></div>
      <div class="grid2">
        <div class="field" style="grid-column:1/-1"><label for="r-prop">Property</label>
          <select id="r-prop" name="prop_id" class="input" required>
            ${options(lk.properties, (p) => p.id, (p) => `${p.address} (owner ${p.owner_name})`, 'Choose a property')}</select></div>
        <div class="field" style="grid-column:1/-1"><label for="r-tenant">Tenant</label>
          <select id="r-tenant" name="tenant_id" class="input" required>
            ${options(lk.citizens, (c) => c.id, (c) => `${c.name} (ID ${c.id})`, 'Choose a citizen')}</select>
          <small>The tenant must already be a registered citizen.</small></div>
        <div class="field"><label for="r-start">Start date</label>
          <input id="r-start" name="start_date" type="date" class="input" required value="${today()}"></div>
        <div class="field"><label for="r-end">End date</label>
          <input id="r-end" name="end_date" type="date" class="input"><small>Leave empty if open-ended.</small></div>
        <div class="field"><label for="r-rent">Monthly rent (INR)</label>
          <input id="r-rent" name="monthly_rent" type="number" min="1" step="0.01" class="input" required></div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn secondary" data-close>Cancel</button>
        <button class="btn" type="submit">${icon('check')} Save agreement</button>
      </div>
    </form>`);
  bindForm(m.el.querySelector('form'), async (v) => {
    await api('/rentals', 'POST', v);
    m.close();
    toast('Rental agreement saved.');
    route();
  });
}

/* -------------------------------------------------------------- dashboard */
async function dashboardView() {
  const d = await api('/stats');
  const t = d.totals;
  const billed = t.total_collected + t.total_pending;
  const pct = billed ? Math.round((t.total_collected / billed) * 100) : 0;

  const html = `
    <section class="panel stat-row" aria-label="Totals">
      <div><p class="label">Registered citizens</p><p class="big num">${t.citizens}</p></div>
      <div><p class="label">Properties</p><p class="big num">${t.properties}</p></div>
      <div><p class="label">Bills generated</p><p class="big num">${t.total_bills}</p></div>
      <div><p class="label">Amount pending</p><p class="big num">${money(t.total_pending)}</p></div>
    </section>

    <div class="dash-grid">
      <section class="panel">
        <div class="panel-head"><h2>Collections</h2></div>
        <div class="panel-body">
          <div class="type-row"><div class="top2"><b>Property tax collected</b><span class="num">${money(t.tax_collected)}</span></div></div>
          <div class="type-row"><div class="top2"><b>Water and electricity collected</b><span class="num">${money(t.utility_collected)}</span></div></div>
          <div class="type-row"><div class="top2"><b>Total collected</b><span class="num">${money(t.total_collected)}</span></div></div>
          <div class="split-light" role="img" aria-label="${pct}% of the billed amount is collected">
            <span class="a" style="width:${pct}%"></span><span class="b" style="width:${billed ? 100 - pct : 0}%"></span>
          </div>
          <p class="muted" style="font-size:13.5px">${pct}% of the billed amount is collected. The rest is pending.</p>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>Bill status</h2><a class="btn secondary sm" href="#bills">Open bills</a></div>
        <div class="panel-body">
          <div class="type-row"><div class="top2">${badge('paid')}<span class="num"><b>${t.paid_bills}</b> bills</span></div></div>
          <div class="type-row"><div class="top2">${badge('unpaid')}<span class="num"><b>${t.pending_bills}</b> bills, not yet due</span></div></div>
          <div class="type-row"><div class="top2">${badge('overdue')}<span class="num"><b>${t.overdue_bills}</b> bills, past due date</span></div></div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>Recent registrations</h2><a class="btn secondary sm" href="#register">Register citizen</a></div>
        <div class="panel-body">${recentList(d.recent)}</div>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>Recent bills</h2><a class="btn secondary sm" href="#bills">View all bills</a></div>
        <div class="panel-body">
          ${d.recent_bills.length ? `<ul class="rows">${d.recent_bills.map((b) => `
            <li>
              <div class="grow"><b>${esc(TYPE_LABEL[b.bill_type] || b.bill_type)} for ${esc(b.owner_name)}</b>
                <span>${esc(b.prop_address)}</span><span>Due ${fmtDate(b.due_date)}</span></div>
              <div style="text-align:right"><b class="num">${money(b.amount)}</b><div style="margin-top:4px">${badge(b.state)}</div></div>
            </li>`).join('')}</ul>` : empty('No bills yet', 'Generate the first bill from the Bills page.')}
        </div>
      </section>
    </div>`;
  return { html };
}

/* ----------------------------------------------------------------- router */
// The order here is the order of the menu: registration first.
const ROUTES = {
  register: { label: 'Register citizen', icon: 'userplus', title: 'Register a citizen', sub: 'Every property, bill and rental in the city links back to a citizen ID, so registration comes first.', render: registerView },
  citizens: { label: 'Registered citizens', icon: 'users', title: 'Registered citizens', sub: 'Select a row to see addresses, documents and properties.', render: citizensView },
  properties: { label: 'Properties', icon: 'home', title: 'Properties', sub: 'Each property belongs to a registered citizen and carries its own bills.', render: propertiesView },
  bills: { label: 'Bills', icon: 'receipt', title: 'Tax and utility bills', sub: 'Generate bills, collect payments and print receipts.', render: billsView },
  rentals: { label: 'Rentals', icon: 'key', title: 'Rental agreements', sub: 'Tenants are registered citizens too. Each agreement links a tenant to a property.', render: rentalsView },
  dashboard: { label: 'City summary', icon: 'grid', title: 'City summary', sub: 'Citizens, properties and money collected.', render: dashboardView },
};
const DEFAULT_ROUTE = 'register';

let routeToken = 0;
async function route() {
  const key = ROUTES[location.hash.slice(1)] ? location.hash.slice(1) : DEFAULT_ROUTE;
  const r = ROUTES[key];
  document.querySelectorAll('#nav a').forEach((a) => {
    if (a.dataset.route === key) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  $('#page-title').textContent = r.title;
  $('#page-sub').textContent = r.sub;
  document.title = `${r.title} | Smart Solapur`;
  closeSide();

  const main = $('#main');
  const token = ++routeToken;
  main.innerHTML = '<div class="loading"><div class="spin"></div>Loading</div>';
  try {
    const { html, mount } = await r.render();
    if (token !== routeToken) return;
    main.innerHTML = html;
    if (mount) mount(main);
  } catch (ex) {
    if (token !== routeToken) return;
    main.innerHTML = `<div class="panel">${empty('This page could not load', ex.message)}</div>`;
  }
}

function closeSide() {
  $('#side').classList.remove('open');
  $('#burger').setAttribute('aria-expanded', 'false');
}

async function checkDb() {
  const el = $('#db');
  try {
    const h = await api('/health');
    el.className = 'db ok';
    el.lastElementChild.textContent = `Connected to ${h.database}`;
  } catch {
    el.className = 'db down';
    el.lastElementChild.textContent = 'Database offline';
  }
}

// Build the menu from ROUTES so the menu and the pages can never go out of sync.
$('#nav').innerHTML = Object.entries(ROUTES)
  .map(([key, r]) => `<a href="#${key}" data-route="${key}">${icon(r.icon)}<span>${r.label}</span></a>`)
  .join('');
$('#burger').innerHTML = icon('menu');
$('#burger').addEventListener('click', () => {
  const open = $('#side').classList.toggle('open');
  $('#burger').setAttribute('aria-expanded', String(open));
});
window.addEventListener('hashchange', route);
checkDb();
setInterval(checkDb, 15000);
route();
