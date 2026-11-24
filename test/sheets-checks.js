setup();
assert(rows.length === 1, 'headers initialized');
assert(listPosts().length === 0, 'empty board');
assert(doGet().name === 'Index', 'website served by default');
assert(
  JSON.parse(doGet({ parameter: { api: 'posts' } }).text).data.length === 0,
  'HTTP reads JSON',
);
var p = {
  name: 'Test Member',
  phone: '9876543210',
  route: 'lko',
  date: '2099-12-20',
  mode: 'Flight',
  help: 'Just sharing my trip',
  note: '',
  type: 'trip',
};
var created = createPost(p);
assert(created.id === 'post-1', 'server ID');
assert(listPosts().length === 1, 'read created trip');
assert(listPosts()[0].phone === '+919876543210', 'normalized India contact');
assert(listPosts()[0].note === '', 'optional trip note');
assert(lastWritten[0][2][0] === "'", 'phone protected as literal sheet text');
p.type = 'request';
p.route = 'hyd';
p.mode = 'Any mode';
p.help = 'Find a traveller';
var response = JSON.parse(
  doPost({ postData: { contents: JSON.stringify(p) } }).text,
);
assert(
  response.ok && response.data.type === 'request',
  'HTTP request writes successfully',
);
assert(listPosts().length === 2, 'request persisted');
rows[1][7] = 'Updated by owner';
assert(
  listPosts().find((x) => x.id === 'post-1').note === 'Updated by owner',
  'sheet edits visible',
);
rows[1][10] = 'completed';
assert(listPosts().length === 1, 'completed hidden');
rows[2][10] = 'cancelled';
assert(listPosts().length === 0, 'cancelled hidden');
rows[2][10] = 'active';
rows[2][4] = new Date('2099-12-21T00:00:00Z');
assert(
  listPosts()[0].date === '2099-12-21',
  'sheet date converted to serializable string',
);
rows[2][4] = '2020-01-01';
assert(listPosts().length === 0, 'past requests hidden');
for (var prefix of ['=', '+', '-', '@']) {
  createPost({ ...p, note: prefix + 'test' });
  assert(
    lastWritten[0][7] === "'" + prefix + 'test',
    'formula-like notes escaped: ' + prefix,
  );
}
function rejects(field, value) {
  var invalid = Object.assign({}, p);
  invalid[field] = value;
  var rejected = false;
  try {
    createPost(invalid);
  } catch (e) {
    rejected = true;
  }
  assert(rejected, 'reject ' + field + ': ' + value);
}
rejects('date', '2099-02-31');
rejects('date', '2020-01-01');
rejects('phone', '123');
rejects('phone', 'abc9876543210');
rejects('route', 'bad');
rejects('name', '');
rejects('name', 'a'.repeat(61));
rejects('note', 'a'.repeat(351));
rejects('help', 'Just sharing my trip');
rejects('help', 'Anything I can');
assert(
  JSON.parse(doPost({ postData: { contents: 'invalid' } }).text).ok === false,
  'invalid JSON fails visibly',
);
assert(
  JSON.parse(doPost({ postData: { contents: 'x'.repeat(8193) } }).text).ok ===
    false,
  'oversize payload rejected',
);
assert(JSON.parse(doPost({}).text).ok === false, 'missing body rejected');
assert(
  typeof JSON.parse(doGet({ parameter: { api: 'posts' } }).text).data[0]
    .created === 'number',
  'timestamps serializable',
);
var old = rows[0][0];
rows[0][0] = 'wrong';
assert(
  JSON.parse(doGet({ parameter: { api: 'posts' } }).text).ok === false,
  'changed headers fail clearly',
);
rows[0][0] = old;
var beforeLocks = released;
var oldFlush = SpreadsheetApp.flush;
SpreadsheetApp.flush = () => {
  throw Error('Google write failed');
};
assert(
  JSON.parse(doPost({ postData: { contents: JSON.stringify(p) } }).text).ok ===
    false,
  'write failure not success',
);
assert(released === beforeLocks + 1, 'lock released after write failure');
SpreadsheetApp.flush = oldFlush;
for (var route of ['lko', 'hyd']) {
  for (var type of ['request', 'trip']) {
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
    for (var mode of modes)
      for (var help of helps) {
        const entry = createPost({ ...p, route, type, mode, help });
        assert(
          entry.route === route &&
            entry.type === type &&
            entry.mode === mode &&
            entry.help === help,
          'all valid route/type/mode/help combinations stored',
        );
      }
  }
}
