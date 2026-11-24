/** Aawan Jaawan. Paste into the Apps Script project bound to your Google Sheet. */
const POST_COLUMNS = ['id', 'name', 'phone', 'route', 'date', 'mode', 'help', 'note', 'type', 'created', 'status'];

/** Run once from the editor before deploying. Keeps the sheet private. */
function setup() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('Open this script from your Google Sheet: Extensions → Apps Script.');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', spreadsheet.getId());
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { getPostsSheet_(); } finally { lock.releaseLock(); }
}

function doGet(e) {
  if (e && e.parameter && e.parameter.api === 'posts') {
    return apiResponse_(() => listPosts());
  }
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Aawan Jaawan · A little closer to home')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** HTTP entry point used by the localhost Python server. */
function doPost(e) {
  return apiResponse_(() => {
    if (!e || !e.postData || !e.postData.contents || e.postData.contents.length > 8192) {
      throw new Error('Invalid post.');
    }
    return createPost(JSON.parse(e.postData.contents));
  });
}

function apiResponse_(action) {
  let result;
  try { result = {ok:true, data:action()}; }
  catch(error) { result = {ok:false, error:error.message || 'Unable to access the community sheet.'}; }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function getPostsSheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('The community board has not been set up yet. Ask the owner to run setup.');
  const spreadsheet = SpreadsheetApp.openById(id);
  let sheet = spreadsheet.getSheetByName('Posts');
  if (!sheet) sheet = spreadsheet.insertSheet('Posts');
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, POST_COLUMNS.length).setValues([POST_COLUMNS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, POST_COLUMNS.length).setBackground('#214f40').setFontColor('#ffffff').setFontWeight('bold');
  }
  const headers = sheet.getRange(1, 1, 1, POST_COLUMNS.length).getDisplayValues()[0];
  if (headers.join('|') !== POST_COLUMNS.join('|')) throw new Error('The Posts column headings changed. Please restore the original headings.');
  return sheet;
}

/** Called by the website. Completed/cancelled and past posts stay in the sheet. */
function listPosts() {
  const sheet = getPostsSheet_();
  if (sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, POST_COLUMNS.length).getValues();
  const today = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');
  return values.map(row => {
    const post = {};
    POST_COLUMNS.forEach((key, index) => {
      const value = row[index];
      post[key] = value instanceof Date
        ? Utilities.formatDate(value, 'Asia/Kolkata', 'yyyy-MM-dd')
        : String(value == null ? '' : value);
    });
    post.created = Number(post.created) || 0;
    return post;
  }).filter(post => post.id && post.name && ['lko','hyd'].includes(post.route)
    && ['trip','request'].includes(post.type) && /^\d{4}-\d{2}-\d{2}$/.test(post.date)
    && post.date >= today && post.status.toLowerCase().trim() === 'active')
    .sort((a, b) => b.created - a.created);
}

/** Validates on the server; callers cannot choose IDs or write arbitrary columns. */
function createPost(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid post.');
  const limits = {name:60, phone:24, route:3, date:10, mode:20, help:40, note:350, type:7};
  const post = {};
  Object.keys(limits).forEach(key => {
    if (key === 'note' && input[key] == null) input[key] = '';
    if (typeof input[key] !== 'string' || (key !== 'note' && !input[key].trim()) || input[key].trim().length > limits[key]) {
      throw new Error('Please check your ' + key + '.');
    }
    post[key] = input[key].trim();
  });
  if (!['lko','hyd'].includes(post.route) || !['trip','request'].includes(post.type)) throw new Error('Choose a valid route and post type.');
  const modes = post.type === 'trip' ? ['Flight','Train','Car','Not decided'] : ['Any mode','Flight','Train','Car','Not decided'];
  if (!modes.includes(post.mode)) throw new Error('Choose a valid travel mode.');
  const helps = post.type === 'trip' ? ['A small parcel','Travel company','Anything I can','Just sharing my trip'] : ['Find a traveller','A small parcel','Travel company','Other'];
  if (!helps.includes(post.help)) throw new Error('Choose a valid help option.');
  const today = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');
  const parsed = new Date(post.date + 'T12:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(post.date) || isNaN(parsed.getTime())
      || parsed.toISOString().slice(0,10) !== post.date || post.date < today) throw new Error('Choose today or a future travel date.');
  if (!/^[+0-9 ()-]+$/.test(post.phone) || !/^\d{10,15}$/.test(post.phone.replace(/\D/g,''))) throw new Error('Enter a valid WhatsApp number including country code.');
  const digits = post.phone.replace(/\D/g,'');
  post.phone = '+' + (digits.length === 10 ? '91' : '') + digits;
  post.id = 'post-' + Utilities.getUuid();
  post.created = Date.now();
  post.status = 'active';
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = getPostsSheet_();
    const row = POST_COLUMNS.map(key => {
      const value = post[key];
      // User text must never become a spreadsheet formula.
      return typeof value === 'string' && /^[=+\-@\t\r]/.test(value) ? "'" + value : value;
    });
    const range = sheet.getRange(sheet.getLastRow() + 1, 1, 1, POST_COLUMNS.length);
    range.setNumberFormat('@');
    range.setValues([row]);
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }
  return post;
}
