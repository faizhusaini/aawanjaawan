async function runTests() {
  assert(pending.length === 1, 'initial shared read');
  assert(
    !node('#posts').innerHTML.includes('Example community'),
    'localhost never shows fictional posts',
  );
  respond(0, 200, [
    post('one'),
    post('two', 'hyd', 'request', 6),
    post('three', 'lko', 'trip', 40),
    { ...post('four', 'delhi-hyd', 'trip', 3), name: 'Shazan' },
    { ...post('past', 'lko', 'trip', -5), name: 'Past traveller' },
  ]);
  await tick();
  assert(
    node('#trip-highlight').textContent.includes(
      'Ayesha Khan is going from Lucknow to Hyderabad',
    ),
    'carousel starts with the next upcoming trip',
  );
  intervals[1]();
  assert(
    node('#trip-highlight').textContent.includes(
      'Shazan is going from Delhi to Hyderabad',
    ),
    'carousel advances across cities',
  );
  fire('#trip-carousel-pause', 'click');
  intervals[1]();
  assert(
    node('#trip-highlight').textContent.includes('Shazan'),
    'rotation can be paused',
  );
  fire('#trip-carousel-next', 'click');
  fire('#trip-carousel-next', 'click');
  assert(
    node('#trip-highlight').textContent.includes('Ayesha'),
    'rotation skips requests and expired trips',
  );
  fire('#clear', 'click');
  assert(
    !node('#posts').innerHTML.includes('Shazan'),
    'Lucknow is the default route filter',
  );
  node('#route').value = 'delhi-hyd';
  fire('#route');
  assert(
    node('#posts').innerHTML.includes('Delhi <span>→</span> Hyderabad'),
    'new route renders and filters',
  );
  click('connect', 'four');
  assert(
    decodeURIComponent(opened.pop()[0]).includes('Delhi to Hyderabad'),
    'WhatsApp uses the selected route',
  );
  fire('#clear', 'click');
  assert(
    node('#posts').innerHTML.includes('Ayesha Khan'),
    'read renders shared posts',
  );
  assert(
    node('#posts').innerHTML.includes('&lt;script&gt;'),
    'notes HTML escaped',
  );
  assert(
    !node('#posts').innerHTML.includes('<script>alert'),
    'no executable note HTML',
  );
  assert(
    node('#posts').innerHTML.includes('By '),
    'request date means deadline',
  );
  click('create', 'request');
  assert(
    node('#form-title').textContent === 'Find a traveller',
    'request title',
  );
  assert(
    node('#date-label span').textContent === 'Needed by',
    'request deadline',
  );
  assert(!node('#date-hint').hidden, 'request deadline explained');
  assert(
    node('#help-label span').textContent === 'What do you need?',
    'request help label',
  );
  assert(
    node('#mode-label span').textContent === 'Preferred transport',
    'request mode label',
  );
  assert(
    node('#post-form [name="mode"]').value === 'Any mode',
    'no assumed transport for requests',
  );
  assert(
    node('#post-form [name="help"]').value === 'Find a traveller',
    'plain who-is-travelling request',
  );
  assert(
    !node('#post-form [name="help"]').innerHTML.includes('Just sharing'),
    'no trip choices in requests',
  );
  assert(
    !node('#post-form [name="help"]').innerHTML.includes('Anything I can'),
    'no offering help in requests',
  );
  click('create', 'trip');
  assert(
    node('#date-label span').textContent === 'Travel date',
    'trip date label restored',
  );
  assert(node('#date-hint').hidden, 'request explanation hidden for trip');
  assert(
    node('#post-form [name="help"]').value === 'Just sharing my trip',
    'trip sharing does not require a favour',
  );
  assert(
    !node('#post-form [name="mode"]').innerHTML.includes('Any mode'),
    'request transport does not leak into trip',
  );
  click('create', 'request');
  setField('name', 'Test Member');
  setField('phone', '9876543210');
  setField('route', 'hyd');
  setField('note', '');
  // Start an older refresh, then save a post while the refresh is in flight.
  intervals[0]();
  const stale = pending.length - 1;
  const saving = fire('#post-form', 'submit');
  const write = pending.length - 1;
  const body = JSON.parse(pending[write].options.body);
  assert(
    body.type === 'request' &&
      body.mode === 'Any mode' &&
      body.help === 'Find a traveller',
    'request payload',
  );
  assert(body.note === '', 'notes optional');
  assert(node('.submit').disabled, 'submit disabled while saving');
  fire('#post-form', 'submit');
  assert(pending.length === write + 1, 'double submit makes one write');
  respond(write, 201, { ...body, id: 'new', phone: '+919876543210' });
  await saving;
  await tick();
  assert(
    node('#posts').innerHTML.includes('Test Member'),
    'saved post immediately visible',
  );
  assert(!node('#post-dialog').open, 'success closes dialog');
  assert(!node('.submit').disabled, 'submit reenabled');
  respond(stale, 200, []);
  await tick();
  assert(
    node('#posts').innerHTML.includes('Test Member'),
    'old refresh cannot hide new post',
  );
  click('connect', 'new');
  assert(
    opened[0][0].startsWith('https://wa.me/919876543210?'),
    'WhatsApp recipient correct',
  );
  assert(
    decodeURIComponent(opened[0][0]).includes('Hyderabad to Lucknow needed by'),
    'contact message includes direction and deadline',
  );
  click('save', 'new');
  assert(node('#saved-count').textContent === 1, 'save count');
  fire('#saved-nav', 'click');
  assert(
    node('#posts').innerHTML.includes('Test Member') &&
      !node('#posts').innerHTML.includes('Ayesha Khan'),
    'saved view only shows saved post',
  );
  click('save', 'new');
  assert(
    node('#empty').hidden === false,
    'unsave from saved view yields empty state',
  );
  fire('#clear', 'click');
  node('#route').value = 'hyd';
  fire('#route');
  assert(
    !node('#posts').innerHTML.includes('Lucknow <span>→</span> Hyderabad'),
    'direction filter',
  );
  fire('#clear', 'click');
  node('#dates').value = '7';
  fire('#dates');
  assert(
    (node('#posts').innerHTML.match(/class="card"/g) || []).length === 3,
    'date window excludes distant trips',
  );
  fire('#clear', 'click');
  node('#search').value = 'no-match-person';
  fire('#search', 'input');
  assert(!node('#empty').hidden, 'search empty state');
  fire('#clear', 'click');
  click('tab', 'trip');
  assert(
    !node('#posts').innerHTML.includes('Looking for a traveller'),
    'trip tab',
  );
  click('tab', 'request');
  assert(!node('#posts').innerHTML.includes('Travelling soon'), 'request tab');
  fire('#clear', 'click');
  node('#sort').value = 'new';
  fire('#sort');
  assert(
    node('#posts').innerHTML.indexOf('Test Member') <
      node('#posts').innerHTML.indexOf('Ayesha Khan'),
    'newest sort',
  );
  click('create', 'request');
  setField('name', 'Unsaved Member');
  setField('phone', '9876543210');
  setField('route', 'lko');
  const failing = fire('#post-form', 'submit');
  respond(pending.length - 1, 502, { error: 'Google unavailable' });
  await failing;
  assert(node('#post-dialog').open, 'failed save preserves open form');
  assert(
    node('#post-form [name="name"]').value === 'Unsaved Member',
    'failed save preserves fields',
  );
  assert(node('#toast').textContent === 'Google unavailable', 'failure shown');
  assert(
    !node('#posts').innerHTML.includes('Unsaved Member'),
    'failed save not shown as successful',
  );
  assert(
    JSON.parse(storage['aj-posts'] || '[]').length === 0,
    'failed shared save never falls back to browser',
  );
  const unexpectedResponse = fire('#post-form', 'submit');
  pending.at(-1).resolve({
    ok: false,
    json: () => Promise.reject(new SyntaxError('Unexpected token <')),
  });
  await unexpectedResponse;
  assert(node('#post-dialog').open, 'non-JSON response preserves the form');
  assert(
    node('#toast').textContent.includes(
      location.hostname === 'localhost' ? 'npm run dev' : 'unexpected response',
    ),
    'non-JSON response gives an actionable error',
  );
  intervals[0]();
  pending.at(-1).resolve({
    ok: true,
    json: () => Promise.reject(new SyntaxError('Unexpected token <')),
  });
  await tick();
  assert(
    node('#toast').textContent.includes('unexpected response'),
    'non-JSON board refresh gives a clear error',
  );
  setField('phone', 'abc9876543210');
  const before = pending.length;
  await fire('#post-form', 'submit');
  assert(pending.length === before, 'invalid phone never sent');
  setField('phone', '9876543210');
  setField('name', '   ');
  await fire('#post-form', 'submit');
  assert(pending.length === before, 'blank name never sent');
  return checks;
}
var testResult;
runTests()
  .then((count) => {
    testResult = { ok: true, assertions: count };
  })
  .catch((error) => {
    testResult = {
      ok: false,
      error: String(error) + ' ' + String(error.stack || ''),
    };
  });
