async function runWorkerChecks(worker, validatePost, indiaToday) {
  let checks = 0;
  const assert = (value, message) => {
    checks++;
    if (!value) throw new Error(message);
  };
  const rows = [];
  let fail = false;
  const db = {
    prepare(sql) {
      const statement = {
        values: [],
        bind(...values) {
          this.values = values;
          return this;
        },
        async all() {
          if (fail) throw new Error('D1 unavailable');
          if (sql.includes('LIMIT 1'))
            return { results: rows.slice(0, 1).map((row) => ({ id: row.id })) };
          assert(
            sql.includes("status='active' AND date>=?"),
            'listing must filter active, unexpired posts',
          );
          return {
            results: rows
              .filter(
                (row) => row.status === 'active' && row.date >= this.values[0],
              )
              .map(({ status, ...post }) => post),
          };
        },
        async run() {
          if (fail) throw new Error('D1 unavailable');
          assert(
            sql.startsWith('INSERT INTO posts'),
            'uses parameterized insert',
          );
          const keys = [
            'id',
            'name',
            'phone',
            'route',
            'date',
            'mode',
            'help',
            'note',
            'type',
            'created',
            'status',
          ];
          rows.push(
            Object.fromEntries(
              keys.map((key, index) => [key, this.values[index]]),
            ),
          );
          return { success: true };
        },
      };
      return statement;
    },
  };
  const env = {
    DB: db,
    ASSETS: { fetch: async () => new Response('website') },
  };
  const url = 'https://aawanjaawan.fun';
  const base = {
    name: 'Community Member',
    phone: '9876543210',
    route: 'lko',
    date: '2099-12-20',
    mode: 'Any mode',
    help: 'Find a traveller',
    note: '',
    type: 'request',
  };
  const send = (path = '/api/posts', options = {}, bindings = env) =>
    worker.fetch(new Request(url + path, options), bindings);
  const post = (value = base, headers = {}) =>
    send('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: url, ...headers },
      body: JSON.stringify(value),
    });
  assert(
    indiaToday(new Date('2026-11-23T19:00:00Z')) === '2026-11-24',
    'India midnight boundary',
  );
  assert((await send('/')).status === 200, 'serves website');
  assert(
    (await send('/api/missing')).status === 404,
    'unknown API is not HTML',
  );
  assert(
    (await send('/api/posts', { method: 'DELETE' })).status === 405,
    'unsupported methods rejected',
  );
  assert(
    (await send('/api/posts', {}, {})).status === 503,
    'missing D1 binding',
  );
  assert((await send('/api/health')).status === 200, 'database readiness');
  assert(
    (await send('/api/health', {}, {})).status === 503,
    'unbound database unhealthy',
  );
  assert(
    (await (await send()).json()).length === 0,
    'fresh shared board empty',
  );
  let response = await post();
  assert(response.status === 201, 'request created');
  const saved = await response.json();
  assert(saved.phone === '+919876543210', 'normalized phone');
  assert(
    saved.id.startsWith('post-') && typeof saved.created === 'number',
    'server owns ID and timestamp',
  );
  assert(
    saved.type === 'request' &&
      saved.help === 'Find a traveller' &&
      saved.note === '',
    'minimal original request supported',
  );
  response = await post({
    ...base,
    type: 'trip',
    route: 'hyd',
    mode: 'Flight',
    help: 'Just sharing my trip',
    note: 'Flight at 18:00',
  });
  assert(response.status === 201, 'voluntary trip supported');
  assert(
    (await (await send()).json()).length === 2,
    'shared reads include both posts',
  );
  rows[0].status = 'completed';
  assert((await (await send()).json()).length === 1, 'completed hidden');
  rows[0].status = 'cancelled';
  assert((await (await send()).json()).length === 1, 'cancelled hidden');
  rows[0].status = 'active';
  rows[0].date = '2020-01-01';
  assert((await (await send()).json()).length === 1, 'past post hidden');
  const before = rows.length;
  for (const override of [
    { name: '' },
    { name: 'x'.repeat(61) },
    { phone: 'abc9876543210' },
    { phone: '123' },
    { phone: '1'.repeat(16) },
    { route: 'bad' },
    { type: 'other' },
    { date: '2099-02-31' },
    { date: '2020-01-01' },
    { help: 'Just sharing my trip' },
    { mode: 'Boat' },
    { note: 'x'.repeat(351) },
  ]) {
    assert(
      (await post({ ...base, ...override })).status === 400,
      'reject invalid ' + JSON.stringify(override),
    );
  }
  assert(rows.length === before, 'invalid requests never reach database');
  assert(
    (await post(base, { Origin: 'https://unrelated.example' })).status === 403,
    'cross-origin rejected',
  );
  assert(
    (await post(base, { 'Sec-Fetch-Site': 'cross-site' })).status === 403,
    'cross-site rejected',
  );
  assert(
    (await post(base, { 'Content-Type': 'text/plain' })).status === 415,
    'non-JSON rejected',
  );
  assert(
    (
      await send('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      })
    ).status === 400,
    'malformed JSON rejected',
  );
  assert(
    (
      await send('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'x'.repeat(8193),
      })
    ).status === 400,
    'actual oversized body rejected',
  );
  assert(
    (await post(base, { 'Content-Length': '99999' })).status === 400,
    'declared oversized body rejected',
  );
  fail = true;
  response = await send();
  assert(response.status === 503, 'failed D1 read not success');
  assert(
    (await response.json()).error.includes('Unable to load'),
    'read failure actionable',
  );
  assert((await post()).status === 503, 'failed D1 write not success');
  assert(
    (await send('/api/health')).status === 503,
    'failed database unhealthy',
  );
  fail = false;
  response = await worker.fetch(
    new Request('https://www.aawanjaawan.fun/path?x=1'),
    env,
  );
  assert(
    response.status === 308 &&
      response.headers.get('Location') === 'https://aawanjaawan.fun/path?x=1',
    'www canonical redirect preserves path',
  );
  for (const route of ['lko', 'hyd'])
    for (const type of ['request', 'trip']) {
      const modes =
        type === 'request'
          ? ['Any mode', 'Flight', 'Train', 'Car']
          : ['Flight', 'Train', 'Car', 'Not decided'];
      const helps =
        type === 'request'
          ? ['Find a traveller', 'A small parcel', 'Travel company', 'Other']
          : [
              'Just sharing my trip',
              'A small parcel',
              'Travel company',
              'Anything I can',
            ];
      for (const mode of modes)
        for (const help of helps) {
          const clean = validatePost({ ...base, route, type, mode, help });
          assert(
            clean.route === route &&
              clean.type === type &&
              clean.mode === mode &&
              clean.help === help,
            'valid flow matrix',
          );
        }
    }
  return checks;
}
