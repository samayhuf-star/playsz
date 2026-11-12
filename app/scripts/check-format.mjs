// Pure-function checks for src/lib/format.ts. Run: npm test (Node 22.18+/24 strips TS types).
import assert from 'node:assert/strict';
import {
  formatDuration,
  mediaLibraryDurationToSeconds,
  resumeFraction,
  sortItems,
  formatBytes,
} from '../src/lib/format.ts';

import {
  friendlyStoreMessage,
  isStoreUserCancel,
} from '../src/lib/store-errors.ts';

assert.equal(formatDuration(0), '0:00');
assert.equal(formatDuration(5), '0:05');
assert.equal(formatDuration(65), '1:05');
assert.equal(formatDuration(599.9), '9:59');
assert.equal(formatDuration(3599), '59:59');
assert.equal(formatDuration(3600), '1:00:00');
assert.equal(formatDuration(3725), '1:02:05');
assert.equal(formatDuration(-1), '0:00');
assert.equal(formatDuration(NaN), '0:00');
assert.equal(formatDuration(null), '0:00');

// The TestFlight bug: a 110.95 s clip reported as 110950 (ms) and shown as seconds.
assert.equal(formatDuration(110950), '30:49:10');
assert.equal(formatDuration(mediaLibraryDurationToSeconds(110950)), '1:50');
assert.equal(formatDuration(mediaLibraryDurationToSeconds(489000)), '8:09');
assert.equal(mediaLibraryDurationToSeconds(0), null);
assert.equal(mediaLibraryDurationToSeconds(null), null);

assert.equal(resumeFraction(30, 120), 0.25);
assert.equal(resumeFraction(500, 120), 1);
assert.equal(resumeFraction(null, 120), 0);
assert.equal(resumeFraction(10, 0), 0);

assert.equal(formatBytes(2048), '2 KB');
assert.equal(formatBytes(5 * 1024 * 1024), '5.0 MB');
assert.equal(formatBytes(null), null);

const items = [
  { title: 'b.mp4', modificationTime: 2, duration: 30, size: null },
  { title: 'a.mp4', modificationTime: 3, duration: null, size: 10 },
  { title: 'c10.mp4', modificationTime: 1, duration: 10, size: 5 },
  { title: 'c2.mp4', modificationTime: 1, duration: 10, size: 50 },
];
const titles = (list) => list.map((i) => i.title).join(',');
assert.equal(titles(sortItems(items, { field: 'name', ascending: true })), 'a.mp4,b.mp4,c2.mp4,c10.mp4');
assert.equal(titles(sortItems(items, { field: 'name', ascending: false })), 'c10.mp4,c2.mp4,b.mp4,a.mp4');
assert.equal(titles(sortItems(items, { field: 'date', ascending: false })), 'a.mp4,b.mp4,c2.mp4,c10.mp4');
assert.equal(titles(sortItems(items, { field: 'duration', ascending: true })), 'c2.mp4,c10.mp4,b.mp4,a.mp4');
assert.equal(titles(sortItems(items, { field: 'size', ascending: false })), 'c2.mp4,a.mp4,c10.mp4,b.mp4');

console.log('format checks passed');


const envelope = (payload) => `OPENIAP_ERROR_JSON:${JSON.stringify(payload)}`;

assert.equal(isStoreUserCancel({ code: 'user-cancelled' }), true);
assert.equal(isStoreUserCancel({ code: 'E_USER_CANCELLED', message: 'cancelled' }), true);
assert.equal(
  isStoreUserCancel({ message: envelope({ code: 'user-cancelled', message: 'User cancelled.' }) }),
  true
);
assert.equal(isStoreUserCancel(envelope({ code: 'user-cancelled' })), true);
assert.equal(isStoreUserCancel({ code: 'network-error', message: 'offline' }), false);
assert.equal(isStoreUserCancel(null), false);

assert.equal(friendlyStoreMessage({ code: 'user-cancelled' }, 'Purchase failed. Please try again.'), '');
assert.equal(
  friendlyStoreMessage(
    { message: envelope({ code: 'user-cancelled', message: 'User cancelled the purchase.' }) },
    'Restore failed. Please try again.'
  ),
  ''
);
assert.equal(
  friendlyStoreMessage({ message: envelope({ code: 'network-error', message: 'boom' }) }, 'Could not load prices from the store. Please try again.'),
  'Could not load prices from the store. Please try again.'
);
assert.equal(
  friendlyStoreMessage({ message: envelope({ code: 'unknown', message: '{"debug":true}' }) }, 'Purchase failed. Please try again.'),
  'Purchase failed. Please try again.'
);
assert.equal(
  friendlyStoreMessage({ message: 'The store is not available on this device yet.' }, 'fallback'),
  'fallback'
);

console.log('store error checks passed');
