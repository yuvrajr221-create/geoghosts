import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createZip } from '../server/zip.js';

test('createZip starts with a local header and ends with the end-of-central-directory record', () => {
  const zip = createZip([{ name: 'hello.txt', data: 'hello world' }]);

  assert.deepEqual([...zip.subarray(0, 4)], [0x50, 0x4b, 0x03, 0x04]); // "PK\x03\x04"
  // With no archive comment, the 22-byte EOCD record is the last thing in the file.
  assert.deepEqual([...zip.subarray(zip.length - 22, zip.length - 18)], [0x50, 0x4b, 0x05, 0x06]); // "PK\x05\x06"
});
