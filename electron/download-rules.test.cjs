const { test } = require('node:test');
const assert = require('node:assert/strict');
const { matchDownload, downloadFilename } = require('./download-rules.cjs');
test('simultaneous movies retain their own controls when requests arrive out of order', () => {
  const downloads = new Map([[1, { id: 1, url: 'https://site/first' }], [2, { id: 2, url: 'https://site/second' }]]);
  const pending = [1, 2];
  assert.equal(matchDownload(pending, downloads, ['https://site/second']).id, 2);
  assert.deepEqual(pending, [1]);
  assert.equal(matchDownload(pending, downloads, ['https://site/first']).id, 1);
});
test('multiple downloads of the same filename never overwrite each other', () => {
  assert.equal(downloadFilename('Movie.mp4', 1), 'Movie-1.mp4');
  assert.equal(downloadFilename('Movie.mp4', 2), 'Movie-2.mp4');
});