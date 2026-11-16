import test from 'node:test';
import assert from 'node:assert/strict';
import { TabSocketManager } from './index.js';

test('TabSocketManager - initializes with candidate role in Node test environment', () => {
  const manager = new TabSocketManager({
    wsUrl: 'ws://localhost:4001',
  });

  assert.equal(manager.getRole(), 'candidate');
  assert.ok(manager.getTabId().length > 0);
  manager.destroy();
});

test('TabSocketManager - accepts game subscriptions and generates valid tab ID', () => {
  const manager = new TabSocketManager({
    wsUrl: 'ws://localhost:4001',
  });

  const testGameId = 'd86e9e43-85e7-497d-b6a2-a9b893d56123';
  // Calling subscribeGame in candidate mode safely buffers or broadcasts
  manager.subscribeGame(testGameId);

  assert.ok(manager.getTabId().length > 5);
  manager.destroy();
});
