const { _electron: electron } = require('playwright');
const path = require('path');
(async () => {
  const app = await electron.launch({ args: [path.resolve('C:/Users/PC/Desktop/Учёба и работа/Progect/anime-player')] });
  const window = await app.firstWindow();
  window.on('console', msg => console.log('CONSOLE:', msg.text()));
  window.on('pageerror', err => console.log('PAGEERROR:', err.message));
  await window.waitForLoadState('domcontentloaded');
  await window.waitForTimeout(8000);
  const errors = await window.evaluate(() => {
    return window.__errors || [];
  });
  console.log('ERRORS:', errors);
  await app.close();
  console.log('DONE');
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
