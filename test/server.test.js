import assert from 'node:assert/strict';
import test from 'node:test';
import { isAuthorizedCronRequest } from '../src/server.js';

test('authorizes cron requests only with the configured bearer secret', () => {
  const request = { headers: { authorization: 'Bearer test-secret' } };

  assert.equal(
    isAuthorizedCronRequest(request, { CRON_SECRET: 'test-secret' }),
    true,
  );
  assert.equal(
    isAuthorizedCronRequest(request, { CRON_SECRET: 'different-secret' }),
    false,
  );
  assert.equal(
    isAuthorizedCronRequest({ headers: {} }, { CRON_SECRET: 'test-secret' }),
    false,
  );
  assert.equal(
    isAuthorizedCronRequest(request, {}),
    false,
  );
});
