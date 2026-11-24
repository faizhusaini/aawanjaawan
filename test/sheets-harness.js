var checks = 0,
  rows = [],
  released = 0,
  seq = 0,
  props = {},
  lastWritten;
function assert(ok, message) {
  checks++;
  if (!ok) throw Error(message);
}
var sheet = {
  getLastRow: () => rows.length,
  setFrozenRows: () => {},
  getRange: (r, c, h, w) => ({
    getDisplayValues: () =>
      rows
        .slice(r - 1, r - 1 + h)
        .map((row) => row.slice(c - 1, c - 1 + w).map(String)),
    getValues: () =>
      rows.slice(r - 1, r - 1 + h).map((row) => row.slice(c - 1, c - 1 + w)),
    setValues: function (values) {
      lastWritten = values;
      values.forEach((row, i) => {
        rows[r - 1 + i] = row.map((value) =>
          typeof value === 'string' && value[0] === "'"
            ? value.slice(1)
            : value,
        );
      });
      return this;
    },
    setBackground: function () {
      return this;
    },
    setFontColor: function () {
      return this;
    },
    setFontWeight: function () {
      return this;
    },
    setNumberFormat: function () {
      return this;
    },
  }),
};
var book = {
  getId: () => 'sheet-id',
  getSheetByName: () => (rows.length ? sheet : null),
  insertSheet: () => sheet,
};
var SpreadsheetApp = {
  getActiveSpreadsheet: () => book,
  openById: (id) => {
    if (id !== 'sheet-id') throw Error('wrong sheet');
    return book;
  },
  flush: () => {},
};
var PropertiesService = {
  getScriptProperties: () => ({
    setProperty: (k, v) => (props[k] = v),
    getProperty: (k) => props[k],
  }),
};
var LockService = {
  getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => released++ }),
};
var Utilities = {
  formatDate: (d) => d.toISOString().slice(0, 10),
  getUuid: () => String(++seq),
};
var ContentService = {
  MimeType: { JSON: 'json' },
  createTextOutput: (text) => ({
    text,
    setMimeType: function () {
      return this;
    },
  }),
};
var HtmlService = {
  createHtmlOutputFromFile: (name) => ({
    name,
    setTitle: function () {
      return this;
    },
    addMetaTag: function () {
      return this;
    },
  }),
};
