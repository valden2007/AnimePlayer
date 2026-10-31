const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

const appPath = path.resolve(__dirname, '..');
(async () => {
  const app = await electron.launch({ args: [appPath] });
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  await window.waitForTimeout(3000);
  await window.selectOption('#providerSelect', 'shikimori');
  await window.waitForTimeout(8000);
  const card = window.locator('.card').first();
  await card.waitFor({ state: 'visible', timeout: 15000 });
  const box = await card.boundingBox();
  await window.mouse.click(box.x + box.width/2, box.y + box.height/2);
  await window.waitForTimeout(5000);
  const b64 = await window.evaluate(async () => await API.capturePage());
  fs.writeFileSync(path.join(appPath, 'test-results', 'title-status.png'), Buffer.from(b64, 'base64'));
  await app.close();
  console.log('DONE');
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
