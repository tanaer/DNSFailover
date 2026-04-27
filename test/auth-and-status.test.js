import assert from 'node:assert/strict';
import test from 'node:test';

import worker, { __testables } from '../src/index.js';

class MockKV {
  constructor(initialEntries = {}) {
    this.store = new Map(Object.entries(initialEntries));
    this.putCalls = [];
    this.deleteCalls = [];
  }

  async get(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  async put(key, value, options = {}) {
    this.putCalls.push({ key, value, options });
    this.store.set(key, value);
  }

  async delete(key) {
    this.deleteCalls.push(key);
    this.store.delete(key);
  }

  async list({ prefix = '', cursor } = {}) {
    const keys = [...this.store.keys()]
      .filter(key => key.startsWith(prefix))
      .sort();

    const start = cursor ? Number(cursor) : 0;
    const pageSize = 2;
    const pageKeys = keys.slice(start, start + pageSize).map(name => ({ name }));
    const nextCursor = start + pageSize;

    return {
      keys: pageKeys,
      list_complete: nextCursor >= keys.length,
      cursor: String(nextCursor)
    };
  }
}

test('login stores each session under its own KV key with TTL', async () => {
  const kv = new MockKV();
  const env = {
    AUTH_PASSWORD: 'secret',
    KV: kv
  };

  const request = new Request('https://example.com/auth/login', {
    method: 'POST',
    body: new URLSearchParams({
      password: 'secret'
    })
  });

  const response = await worker.fetch(request, env, { waitUntil() {} });

  assert.equal(response.status, 302);
  const cookie = response.headers.get('Set-Cookie');
  const sessionId = __testables.parseSessionIdFromCookie(cookie);
  assert.ok(sessionId);

  assert.equal(kv.putCalls.length, 1);
  assert.equal(kv.putCalls[0].key, __testables.buildAuthSessionKey(sessionId));
  assert.equal(kv.putCalls[0].options.expirationTtl, __testables.SESSION_TTL_SECONDS);
  assert.equal(kv.store.has('auth_sessions'), false);
});

test('isAuthenticated returns true for a valid stored session', async () => {
  const sessionId = 'session-valid';
  const kv = new MockKV({
    [__testables.buildAuthSessionKey(sessionId)]: JSON.stringify({
      created: Date.now(),
      ip: '127.0.0.1'
    })
  });

  const request = new Request('https://example.com/', {
    headers: {
      Cookie: `session=${sessionId}`
    }
  });

  const authenticated = await __testables.isAuthenticated(request, { KV: kv });
  assert.equal(authenticated, true);
  assert.deepEqual(kv.deleteCalls, []);
});

test('isAuthenticated deletes expired sessions', async () => {
  const sessionId = 'session-expired';
  const kv = new MockKV({
    [__testables.buildAuthSessionKey(sessionId)]: JSON.stringify({
      created: Date.now() - ((__testables.SESSION_TTL_SECONDS + 10) * 1000),
      ip: '127.0.0.1'
    })
  });

  const request = new Request('https://example.com/', {
    headers: {
      Cookie: `session=${sessionId}`
    }
  });

  const authenticated = await __testables.isAuthenticated(request, { KV: kv });
  assert.equal(authenticated, false);
  assert.deepEqual(kv.deleteCalls, [__testables.buildAuthSessionKey(sessionId)]);
});

test('logout removes only the current session key', async () => {
  const sessionId = 'session-logout';
  const kv = new MockKV({
    [__testables.buildAuthSessionKey(sessionId)]: JSON.stringify({
      created: Date.now(),
      ip: '127.0.0.1'
    })
  });
  const env = {
    AUTH_PASSWORD: 'secret',
    KV: kv
  };

  const request = new Request('https://example.com/auth/logout', {
    method: 'POST',
    headers: {
      Cookie: `session=${sessionId}`
    }
  });

  const response = await worker.fetch(request, env, { waitUntil() {} });

  assert.equal(response.status, 302);
  assert.deepEqual(kv.deleteCalls, [__testables.buildAuthSessionKey(sessionId)]);
});

test('clearAuthSessions deletes paginated session keys and legacy storage key', async () => {
  const kv = new MockKV({
    'auth_sessions:1': '{}',
    'auth_sessions:2': '{}',
    'auth_sessions:3': '{}',
    auth_sessions: '{}'
  });

  await __testables.clearAuthSessions({ KV: kv });

  assert.deepEqual(
    kv.deleteCalls,
    ['auth_sessions:1', 'auth_sessions:2', 'auth_sessions:3', 'auth_sessions']
  );
});

test('shouldRunMonitorCheck fires once per 60 second interval across 15 second ticks', () => {
  const monitor = { interval: 60 };
  const results = [
    __testables.shouldRunMonitorCheck(monitor, 60_000),
    __testables.shouldRunMonitorCheck(monitor, 75_000),
    __testables.shouldRunMonitorCheck(monitor, 90_000),
    __testables.shouldRunMonitorCheck(monitor, 105_000),
    __testables.shouldRunMonitorCheck(monitor, 120_000)
  ];

  assert.deepEqual(results, [true, false, false, false, true]);
});

test('shouldPersistMonitorStatus skips stable healthy writes until the throttle window', () => {
  const lastStatus = {
    healthy: true,
    failureCount: 0,
    failoverTriggered: false,
    lastError: null,
    lastCheck: 1_000
  };

  const unchangedStatus = {
    healthy: true,
    failureCount: 0,
    failoverTriggered: false,
    lastError: null,
    lastCheck: 1_000 + (5 * 60 * 1000)
  };

  const throttledStatus = {
    ...unchangedStatus,
    lastCheck: 1_000 + __testables.STATUS_PERSIST_INTERVAL_MS
  };

  const failureStatus = {
    healthy: false,
    failureCount: 1,
    failoverTriggered: false,
    lastError: 'timeout',
    lastCheck: unchangedStatus.lastCheck
  };

  assert.equal(__testables.shouldPersistMonitorStatus(lastStatus, unchangedStatus), false);
  assert.equal(__testables.shouldPersistMonitorStatus(lastStatus, throttledStatus), true);
  assert.equal(__testables.shouldPersistMonitorStatus(lastStatus, failureStatus), true);
});
