const { _electron: electron } = require('playwright');
const path = require('path');
(async () => {
  const app = await electron.launch({ args: [path.resolve(__dirname, '..')] });
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  await window.waitForTimeout(2000);
  await window.screenshot({ path: path.join(__dirname, '..', 'test-results', 'snap.png'), timeout: 10000 });
  console.log('SCREENSHOT_OK');
  await app.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
