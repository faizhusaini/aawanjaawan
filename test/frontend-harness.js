// This harness executes the actual app with a simulated DOM and HTTP transport.
// It verifies event/data behaviour; it does not assert browser layout.
var checks = 0;
function assert(value, message) {
  checks++;
  if (!value) throw new Error(message);
}
class Element {
  constructor() {
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.hidden = false;
    this.disabled = false;
    this.listeners = {};
    this.dataset = {};
    this.classes = new Set();
    this.classList = {
      toggle: (name, on) =>
        on ? this.classes.add(name) : this.classes.delete(name),
      add: (name) => this.classes.add(name),
      remove: (name) => this.classes.delete(name),
    };
  }
  addEventListener(name, handler) {
    this.listeners[name] = handler;
  }
  setAttribute(name, value) {
    this[name] = value;
  }
  showModal() {
    this.open = true;
  }
  close() {
    this.open = false;
  }
  scrollIntoView() {}
  reset() {
    for (const name of [
      'name',
      'phone',
      'route',
      'date',
      'mode',
      'help',
      'note',
    ])
      node('#post-form [name="' + name + '"]').value = '';
  }
}
var nodes = {};
function node(selector) {
  return nodes[selector] || (nodes[selector] = new Element());
}
var tabs = ['all', 'trip', 'request'].map((type) => {
  const e = new Element();
  e.dataset.tab = type;
  return e;
});
var document = {
  hidden: false,
  listeners: {},
  querySelector: node,
  querySelectorAll: (selector) =>
    selector === '[data-tab]'
      ? tabs
      : selector === 'dialog'
        ? [node('#post-dialog'), node('#info-dialog')]
        : [],
  addEventListener(name, fn) {
    this.listeners[name] = fn;
  },
};
var location = { hostname: 'localhost' };
var storage = {};
var localStorage = {
  getItem: (key) => storage[key] || null,
  setItem: (key, value) => (storage[key] = value),
};
var intervals = [];
function setInterval(fn) {
  intervals.push(fn);
}
function setTimeout() {}
function clearTimeout() {}
var opened = [];
var window = { open: (...args) => opened.push(args) };
var pending = [];
function fetch(url, options) {
  return new Promise((resolve, reject) =>
    pending.push({ url, options, resolve, reject }),
  );
}
function respond(index, status, payload) {
  pending[index].resolve({
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(payload),
  });
}
function FormData() {
  return ['name', 'phone', 'route', 'date', 'mode', 'help', 'note'].map(
    (key) => [key, node('#post-form [name="' + key + '"]').value],
  );
}
function click(kind, value) {
  const target = {
    dataset: { [kind]: value },
    closest: (selector) => (selector === '[data-' + kind + ']' ? target : null),
  };
  document.listeners.click({ target });
}
function fire(selector, event = 'change') {
  return node(selector).listeners[event]({
    target: node(selector),
    preventDefault() {},
  });
}
function setField(name, value) {
  node('#post-form [name="' + name + '"]').value = value;
}
function days(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function post(id, route = 'lko', type = 'trip', offset = 2) {
  return {
    id,
    name: 'Ayesha Khan',
    phone: '+919876543210',
    route,
    type,
    date: days(offset),
    mode: 'Flight',
    help: type === 'trip' ? 'Just sharing my trip' : 'Find a traveller',
    note: 'Hello <script>alert(1)</script>',
    created: Date.now() - 10000,
  };
}
node('#route').value = 'all';
node('#dates').value = 'all';
node('#sort').value = 'soon';
async function tick() {
  for (let n = 0; n < 10; n++) await Promise.resolve();
}
