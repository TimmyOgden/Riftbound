import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', timeout: 90000, expect: { timeout: 15000 }, workers: 1,
  use: { channel: 'chrome', baseURL: 'http://127.0.0.1:5188', viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: [
    { command: 'npm run dev:server', url: 'http://127.0.0.1:3089/health', env: { PORT: '3089', HOST: '127.0.0.1', NODE_ENV: 'test', TEST_FIRST_PLAYER: '1', TEST_DECK_ORDER: 'fixed', CLIENT_ORIGIN: 'http://127.0.0.1:5188', ACCOUNTS_FILE: '.runtime/browser-test/second-player.sqlite', LOG_FILE: '.runtime/browser-test/second-player.jsonl' } },
    { command: 'npm run dev:server', url: 'http://127.0.0.1:3088/health', env: { PORT: '3088', HOST: '127.0.0.1', NODE_ENV: 'test', TEST_FIRST_PLAYER: '0', TEST_DECK_ORDER: 'fixed', CLIENT_ORIGIN: 'http://127.0.0.1:5188', ACCOUNTS_FILE: '.runtime/browser-test/accounts.sqlite', LOG_FILE: '.runtime/browser-test/server.jsonl' } },
    { command: 'npm run dev -- --host 127.0.0.1 --port 5188 --strictPort', url: 'http://127.0.0.1:5188', env: { VITE_SERVER_URL: 'http://127.0.0.1:3088' } }
  ]
});
