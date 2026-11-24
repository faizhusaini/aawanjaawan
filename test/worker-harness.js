// Minimal Web API doubles for JavaScriptCore. Native APIs are used by worker.test.mjs.
class Headers {
  constructor(initial = {}) {
    this.data = {};
    for (const [key, value] of Object.entries(initial))
      this.data[key.toLowerCase()] = String(value);
  }
  get(key) {
    return this.data[key.toLowerCase()] ?? null;
  }
}
class URL {
  constructor(value) {
    const m = value.match(/^(https?:)\/\/([^/]+)(.*)$/);
    if (!m) throw Error('bad URL');
    this.protocol = m[1];
    this.hostname = m[2];
    this.rest = m[3] || '/';
    this.pathname = this.rest.split('?')[0];
  }
  get origin() {
    return this.protocol + '//' + this.hostname;
  }
  toString() {
    return this.origin + this.rest;
  }
}
class Response {
  constructor(body = '', options = {}) {
    this.body = body;
    this.status = options.status || 200;
    this.headers = new Headers(options.headers);
  }
  async json() {
    return JSON.parse(this.body);
  }
  static redirect(url, status) {
    return new Response('', { status, headers: { Location: url } });
  }
}
class Request {
  constructor(url, options = {}) {
    this.url = url;
    this.method = options.method || 'GET';
    this.headers = new Headers(options.headers);
    const data = options.body;
    this.body =
      data === undefined
        ? null
        : {
            getReader: () => {
              let done = false;
              return {
                read: async () => {
                  if (done) return { done: true };
                  done = true;
                  return {
                    done: false,
                    value: Uint8Array.from(data, (c) => c.charCodeAt(0)),
                  };
                },
                cancel: async () => {},
              };
            },
          };
  }
}
class TextDecoder {
  decode(bytes) {
    return String.fromCharCode(...bytes);
  }
}
var crypto = { randomUUID: () => String(++uuid) };
var uuid = 0;
