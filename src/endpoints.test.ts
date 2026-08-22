import assert from 'node:assert/strict';
import test from 'node:test';
import { parseLoopbackEndpoint, parseLoopbackEndpointList } from './endpoints';

test('loopback endpoints normalize without credentials or query material', () => {
  assert.deepEqual(parseLoopbackEndpoint('http://localhost:11434/'), {
    url: 'http://localhost:11434',
    display: 'http://localhost:11434',
    id: parseLoopbackEndpoint('http://localhost:11434')?.id,
  });
  assert.equal(parseLoopbackEndpoint('https://user:secret@localhost:8000'), null);
  assert.equal(parseLoopbackEndpoint('https://api.example.com/v1'), null);
  assert.equal(parseLoopbackEndpoint('file:///tmp/model'), null);
});

test('endpoint lists reject remote hosts and deduplicate loopback URLs', () => {
  const endpoints = parseLoopbackEndpointList([
    'http://localhost:8000',
    'http://localhost:8000/',
    'http://127.0.0.1:9000',
    'https://remote.example.com',
  ].join(','));
  assert.deepEqual(endpoints.map((entry) => entry.display), [
    'http://localhost:8000',
    'http://127.0.0.1:9000',
  ]);
});
