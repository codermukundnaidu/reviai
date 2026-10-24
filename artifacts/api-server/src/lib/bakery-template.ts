// Trusted, fixed template for the bakery order tracker. No model-written code is ever included.
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const APP_JS = `(function () {
  'use strict';
  var STATUSES = ['received', 'preparing', 'ready', 'collected'];
  var meta = document.querySelector('meta[name="bakery-project"]');
  var projectId = meta ? meta.getAttribute('content') : '';
  var base = '/api/projects/' + encodeURIComponent(projectId) + '/orders';
  var $ = function (id) { return document.getElementById(id); };
  var form = $('order-form'), list = $('order-list'), banner = $('banner'), listState = $('list-state');
  var submitBtn = $('submit-btn'), cancelBtn = $('cancel-btn'), formTitle = $('form-title');
  var refreshBtn = $('refresh-btn'), filter = $('status-filter');
  var orders = [], editing = null, saving = false, busyIds = {};

  function say(msg, kind) {
    banner.textContent = msg || '';
    banner.hidden = !msg;
    banner.className = 'banner ' + (kind || 'error');
  }
  function api(method, url, body) {
    var opts = { method: method, credentials: 'same-origin', headers: { 'Accept': 'application/json' } };
    if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    return fetch(url, opts).then(function (r) {
      if (r.status === 204) return null;
      return r.text().then(function (t) {
        var data = null;
        try { data = t ? JSON.parse(t) : null; } catch (e) { data = null; }
        if (!r.ok) {
          var err = new Error((data && data.error) || ('Request failed (' + r.status + ')'));
          err.status = r.status;
          throw err;
        }
        return data;
      });
    });
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function render() {
    var f = filter.value;
    var shown = orders.filter(function (o) { return !f || o.status === f; });
    while (list.firstChild) list.removeChild(list.firstChild);
    if (!shown.length) {
      listState.hidden = false;
      listState.textContent = orders.length
        ? 'No orders with this status.'
        : 'No orders yet. Add the first one with the form.';
    } else {
      listState.hidden = true;
    }
    shown.forEach(function (o) {
      var li = el('li', 'order status-' + o.status);
      var head = el('div', 'order-head');
      head.appendChild(el('strong', 'order-name', o.customerName));
      head.appendChild(el('span', 'badge', o.status));
      li.appendChild(head);
      li.appendChild(el('p', 'order-items', o.items));
      li.appendChild(el('p', 'order-meta', 'Quantity ' + o.quantity + ' \\u00b7 Pickup ' + o.pickupDate));
      var actions = el('div', 'order-actions');
      var busy = !!busyIds[o.id];
      var sel = el('select');
      sel.setAttribute('aria-label', 'Status for ' + o.customerName);
      STATUSES.forEach(function (s) {
        var op = el('option', '', s); op.value = s; if (s === o.status) op.selected = true; sel.appendChild(op);
      });
      sel.disabled = busy;
      sel.addEventListener('change', function () { changeStatus(o, sel.value); });
      actions.appendChild(sel);
      var eb = el('button', 'btn', 'Edit'); eb.type = 'button'; eb.disabled = busy;
      eb.setAttribute('aria-label', 'Edit order for ' + o.customerName);
      eb.addEventListener('click', function () { startEdit(o); });
      var db = el('button', 'btn danger', 'Delete'); db.type = 'button'; db.disabled = busy;
      db.setAttribute('aria-label', 'Delete order for ' + o.customerName);
      db.addEventListener('click', function () { remove(o); });
      actions.appendChild(eb); actions.appendChild(db);
      li.appendChild(actions);
      list.appendChild(li);
    });
  }
  function load(keepMessage) {
    refreshBtn.disabled = true;
    if (!orders.length) { listState.hidden = false; listState.textContent = 'Loading orders...'; }
    return api('GET', base).then(function (data) {
      orders = Array.isArray(data) ? data : [];
      if (!keepMessage) say('');
      if (editing && !orders.some(function (o) { return o.id === editing.id; })) { resetForm(); say('The order you were editing no longer exists.', 'error'); }
      render();
    }).catch(function (e) {
      listState.hidden = false;
      listState.textContent = 'Orders could not be loaded. ' + e.message;
      say('Could not load orders: ' + e.message + ' Use Refresh to try again.', 'error');
    }).then(function () { refreshBtn.disabled = false; });
  }
  function setSaving(v) {
    saving = v; submitBtn.disabled = v; cancelBtn.disabled = v;
    submitBtn.textContent = v ? 'Saving...' : (editing ? 'Save changes' : 'Add order');
  }
  function resetForm() {
    editing = null; form.reset(); $('f-status').value = 'received';
    formTitle.textContent = 'New order'; cancelBtn.hidden = true;
    submitBtn.textContent = 'Add order'; clearErrors();
  }
  function startEdit(o) {
    editing = o;
    $('f-name').value = o.customerName; $('f-items').value = o.items;
    $('f-qty').value = String(o.quantity); $('f-date').value = o.pickupDate; $('f-status').value = o.status;
    formTitle.textContent = 'Edit order'; cancelBtn.hidden = false; submitBtn.textContent = 'Save changes';
    clearErrors(); say(''); $('f-name').focus();
  }
  function clearErrors() {
    ['name', 'items', 'qty', 'date'].forEach(function (k) { $('e-' + k).textContent = ''; $('f-' + k).removeAttribute('aria-invalid'); });
  }
  function fieldErr(k, msg) { $('e-' + k).textContent = msg; $('f-' + k).setAttribute('aria-invalid', 'true'); }
  function validate() {
    clearErrors();
    var ok = true;
    var name = $('f-name').value.trim(), items = $('f-items').value.trim();
    var qtyRaw = $('f-qty').value.trim(), qty = Number(qtyRaw), date = $('f-date').value;
    if (!name || name.length > 120) { fieldErr('name', 'Enter a customer name up to 120 characters.'); ok = false; }
    if (!items || items.length > 1000) { fieldErr('items', 'Describe the items, up to 1000 characters.'); ok = false; }
    if (!/^\\d+$/.test(qtyRaw) || qty < 1 || qty > 10000) { fieldErr('qty', 'Quantity must be a whole number from 1 to 10000.'); ok = false; }
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date)) { fieldErr('date', 'Choose a pickup date.'); ok = false; }
    if (!ok) return null;
    return { customerName: name, items: items, quantity: qty, pickupDate: date, status: $('f-status').value };
  }
  function conflict(e) {
    if (e.status === 409) {
      say('Someone else changed this order. The list was refreshed. Review the latest version, then try again.', 'error');
      return load(true);
    }
    say(e.message, 'error');
    return Promise.resolve();
  }
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (saving) return;
    var body = validate();
    if (!body) return;
    setSaving(true);
    var wasEditing = editing;
    var p;
    if (wasEditing) { body.version = wasEditing.version; p = api('PUT', base + '/' + encodeURIComponent(wasEditing.id), body); }
    else p = api('POST', base, body);
    p.then(function () {
      resetForm(); say(wasEditing ? 'Order updated.' : 'Order added.', 'ok');
      return load(true);
    }).catch(function (e) { return conflict(e); }).then(function () { setSaving(false); });
  });
  cancelBtn.addEventListener('click', function () { if (!saving) { resetForm(); say(''); } });
  refreshBtn.addEventListener('click', function () { load(); });
  filter.addEventListener('change', render);
  function changeStatus(o, status) {
    if (status === o.status || busyIds[o.id]) return;
    busyIds[o.id] = true; render();
    api('PUT', base + '/' + encodeURIComponent(o.id), {
      customerName: o.customerName, items: o.items, quantity: o.quantity, pickupDate: o.pickupDate, status: status, version: o.version
    }).then(function () { say('Status updated.', 'ok'); return load(true); })
      .catch(function (e) { return conflict(e); })
      .then(function () { delete busyIds[o.id]; render(); });
  }
  function remove(o) {
    if (busyIds[o.id]) return;
    if (!window.confirm('Delete the order for ' + o.customerName + '? This cannot be undone.')) return;
    busyIds[o.id] = true; render();
    api('DELETE', base + '/' + encodeURIComponent(o.id), { version: o.version })
      .then(function () { if (editing && editing.id === o.id) resetForm(); say('Order deleted.', 'ok'); return load(true); })
      .catch(function (e) { return conflict(e); })
      .then(function () { delete busyIds[o.id]; render(); });
  }
  resetForm();
  load();
})();
`;

const APP_CSS = `:root{--bg:#f6efe4;--card:#fffaf1;--ink:#2b1d14;--muted:#6e5a4a;--line:#e0d2bd;--accent:#a8431f;--accent-ink:#fff7ee;--ok:#2f6b3f;--bad:#9b1c1c}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 Georgia,'Times New Roman',serif}
header{padding:24px 20px 8px;max-width:960px;margin:0 auto}
h1{margin:0;font-size:1.9rem;letter-spacing:-.01em}
.sub{margin:4px 0 0;color:var(--muted);font-family:system-ui,sans-serif;font-size:.9rem}
main{max-width:960px;margin:0 auto;padding:12px 20px 40px;display:grid;gap:20px;grid-template-columns:1fr}
@media(min-width:800px){main{grid-template-columns:minmax(0,340px) minmax(0,1fr);align-items:start}}
section{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px}
h2{margin:0 0 12px;font-size:1.15rem}
label{display:block;font:600 .85rem system-ui,sans-serif;margin:10px 0 4px}
input,select,textarea{width:100%;font:inherit;font-size:.95rem;padding:9px 10px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink)}
input[aria-invalid=true],textarea[aria-invalid=true]{border-color:var(--bad)}
textarea{resize:vertical;min-height:70px}
.err{color:var(--bad);font:.8rem system-ui,sans-serif;min-height:1em;margin:3px 0 0}
.row{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}
.btn{font:600 .85rem system-ui,sans-serif;border:1px solid var(--line);background:#fff;color:var(--ink);padding:8px 14px;border-radius:999px;cursor:pointer}
.btn.primary{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.btn.danger{color:var(--bad)}
.btn:disabled,select:disabled{opacity:.5;cursor:not-allowed}
:focus-visible{outline:3px solid #d99a2b;outline-offset:2px}
.banner{padding:10px 12px;border-radius:8px;font:.9rem system-ui,sans-serif;margin:0 0 12px}
.banner.error{background:#f8dcd8;color:var(--bad)}
.banner.ok{background:#dcebd9;color:var(--ok)}
.bar{display:flex;gap:8px;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap}
.bar h2{margin:0}
.bar-tools{display:flex;gap:8px;align-items:center}
.bar-tools select{width:auto}
ul{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.order{border:1px solid var(--line);border-left:5px solid var(--muted);border-radius:10px;padding:12px;background:#fff}
.order.status-received{border-left-color:#c58b1d}.order.status-preparing{border-left-color:var(--accent)}.order.status-ready{border-left-color:var(--ok)}
.order-head{display:flex;justify-content:space-between;gap:8px;align-items:center}
.badge{font:600 .7rem system-ui,sans-serif;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.order-items{margin:6px 0 2px;overflow-wrap:anywhere;white-space:pre-wrap}
.order-meta{margin:0;color:var(--muted);font:.85rem system-ui,sans-serif}
.order-actions{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;align-items:center}
.order-actions select{width:auto}
#list-state{color:var(--muted);font:.95rem system-ui,sans-serif;padding:18px;border:1px dashed var(--line);border-radius:10px}
`;

export function renderBakeryFiles(input: { projectId: string; buildId: string; title: string }): Record<"index.html" | "app.css" | "app.js", string> {
  const title = esc(input.title || "Bakery orders");
  const pid = esc(input.projectId);
  const bid = esc(input.buildId);
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="bakery-project" content="${pid}">
<meta name="bakery-build" content="${bid}">
<title>${title}</title>
<link rel="stylesheet" href="./app.css">
<script src="./app.js" defer></script>
</head>
<body>
<header>
<h1>${title}</h1>
<p class="sub">Bakery order tracker. Orders are saved to the server database.</p>
</header>
<main>
<section aria-labelledby="form-title">
<h2 id="form-title">New order</h2>
<form id="order-form" novalidate>
<label for="f-name">Customer name</label>
<input id="f-name" name="customerName" type="text" maxlength="120" autocomplete="off" aria-describedby="e-name">
<p class="err" id="e-name" role="alert"></p>
<label for="f-items">Items</label>
<textarea id="f-items" name="items" maxlength="1000" aria-describedby="e-items"></textarea>
<p class="err" id="e-items" role="alert"></p>
<label for="f-qty">Quantity</label>
<input id="f-qty" name="quantity" type="number" inputmode="numeric" min="1" max="10000" step="1" aria-describedby="e-qty">
<p class="err" id="e-qty" role="alert"></p>
<label for="f-date">Pickup date</label>
<input id="f-date" name="pickupDate" type="date" aria-describedby="e-date">
<p class="err" id="e-date" role="alert"></p>
<label for="f-status">Status</label>
<select id="f-status" name="status">
<option value="received">received</option>
<option value="preparing">preparing</option>
<option value="ready">ready</option>
<option value="collected">collected</option>
</select>
<div class="row">
<button class="btn primary" id="submit-btn" type="submit">Add order</button>
<button class="btn" id="cancel-btn" type="button" hidden>Cancel edit</button>
</div>
</form>
</section>
<section aria-labelledby="list-title">
<div class="bar">
<h2 id="list-title">Orders</h2>
<div class="bar-tools">
<label for="status-filter" class="sr" style="margin:0">Show</label>
<select id="status-filter">
<option value="">all</option>
<option value="received">received</option>
<option value="preparing">preparing</option>
<option value="ready">ready</option>
<option value="collected">collected</option>
</select>
<button class="btn" id="refresh-btn" type="button">Refresh</button>
</div>
</div>
<p id="banner" class="banner" role="status" hidden></p>
<p id="list-state" role="status">Loading orders...</p>
<ul id="order-list" aria-label="Orders"></ul>
</section>
</main>
</body>
</html>
`;
  return { "index.html": html, "app.css": APP_CSS, "app.js": APP_JS };
}
