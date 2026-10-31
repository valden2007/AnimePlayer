const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

const appPath = path.resolve(__dirname, '..');
(async () => {
  const app = await electron.launch({ args: [appPath] });
  const window = await app.firstWindow();
  window.on('console', msg => console.log('CONSOLE:', msg.text()));
  await window.waitForLoadState('domcontentloaded');
  await window.waitForTimeout(3000);

  await window.selectOption('#providerSelect', 'shikimori');
  await window.waitForTimeout(8000);
  const card = window.locator('.card').first();
  await card.waitFor({ state: 'visible', timeout: 15000 });
  const box = await card.boundingBox();
  await window.mouse.click(box.x + box.width/2, box.y + box.height/2);
  await window.waitForTimeout(5000);

  await window.selectOption('#statusSelect', 'planned');
  await window.waitForTimeout(500);
  await window.click('#favStar');
  await window.waitForTimeout(500);

  await window.click('#favBtn');
  await window.waitForTimeout(2000);
  const tabs = await window.evaluate(() => Array.from(document.querySelectorAll('.tab')).map(t => t.textContent));
  console.log('TABS:', tabs);
  const libText = await window.locator('#libGrid').textContent();
  console.log('LIB HAS CARD:', libText && libText.length > 0);

  // screenshot library
  const b64 = await window.evaluate(async () => await API.capturePage());
  fs.writeFileSync(path.join(appPath, 'test-results', 'library.png'), Buffer.from(b64, 'base64'));

  await app.close();

  // reopen
  const app2 = await electron.launch({ args: [appPath] });
  const w2 = await app2.firstWindow();
  await w2.waitForLoadState('domcontentloaded');
  await w2.waitForTimeout(4000);
  await w2.click('#favBtn');
  await w2.waitForTimeout(2000);
  const tabs2 = await w2.evaluate(() => Array.from(document.querySelectorAll('.tab')).map(t => t.textContent));
  console.log('TABS2:', tabs2);
  await app2.close();
  console.log('DONE');
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
