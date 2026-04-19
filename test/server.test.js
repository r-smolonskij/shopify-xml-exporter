import assert from 'node:assert/strict';
import test from 'node:test';
import { isAuthorizedCronRequest } from '../src/server.js';

test('authorizes manual cron requests only with the configured path secret', () => {
  const request = { url: '/api/cron/refresh/test-secret', headers: {} };

  assert.equal(
    isAuthorizedCronRequest(request, { CRON_SECRET: 'test-secret' }),
    true,
  );
  assert.equal(
    isAuthorizedCronRequest(request, { CRON_SECRET: 'different-secret' }),
    false,
  );
  assert.equal(
    isAuthorizedCronRequest({ url: '/api/cron/refresh', headers: {} }, { CRON_SECRET: 'test-secret' }),
    false,
  );
  assert.equal(
    isAuthorizedCronRequest(request, {}),
    false,
  );
});

test('authorizes Vercel cron requests without bearer secret', () => {
  const request = { headers: { 'user-agent': 'vercel-cron/1.0' } };

  assert.equal(
    isAuthorizedCronRequest(request, {}),
    true,
  );
  assert.equal(
    isAuthorizedCronRequest(request, { CRON_SECRET: 'test-secret' }),
    true,
  );
});
