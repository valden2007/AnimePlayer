const { _electron: electron } = require('playwright');
const path = require('path');
(async () => {
  const app = await electron.launch({ args: [path.resolve(__dirname, '..')] });
  const window = await app.firstWindow();
  const errors = [];
  window.on('console', msg => {
    console.log('CONSOLE[' + msg.type() + ']:', msg.text());
  });
  window.on('pageerror', err => {
    errors.push(err.message);
    console.log('PAGEERROR:', err.message);
  });
  await window.waitForLoadState('domcontentloaded');
  await window.waitForTimeout(8000);
  console.log('ERRORS_COUNT:', errors.length);
  errors.forEach((e, i) => console.log('ERR' + i + ':', e));
  await app.close();
  console.log('DONE');
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
