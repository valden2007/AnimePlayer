const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

const appPath = path.resolve(__dirname, '../..');
const resultsDir = path.join(appPath, 'test-results');
if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

(async () => {
  const app = await electron.launch({ args: [appPath] });
  const window = await app.firstWindow();
  window.on('console', msg => console.log('CONSOLE:', msg.text()));
  await window.waitForLoadState('domcontentloaded');
  await window.waitForTimeout(5000);

  // 1. Home loaded
  const homeVisible = await window.evaluate(() => !document.getElementById('viewHome').classList.contains('hidden'));
  console.log('HOME_VISIBLE:', homeVisible);

  // 2. Search
  await window.fill('#searchInput', 'Наруто');
  await window.press('#searchInput', 'Enter');
  await window.waitForTimeout(5000);
  const searchCards = await window.locator('#searchGrid .card').count();
  console.log('SEARCH_CARDS:', searchCards);

  // 3. Click first card
  const card = window.locator('#searchGrid .card').first();
  if (await card.count() > 0) {
    const box = await card.boundingBox();
    await window.mouse.click(box.x + box.width/2, box.y + box.height/2);
    await window.waitForTimeout(5000);
    const title = await window.locator('#titleName').textContent();
    console.log('TITLE_OPENED:', title);
    const b64 = await window.evaluate(async () => await API.capturePage());
    fs.writeFileSync(path.join(resultsDir, 'e2e-title.png'), Buffer.from(b64, 'base64'));
  }

  // 4. Open settings
  const box = await window.locator('#settingsBtn').boundingBox();
  const elInfo = await window.evaluate(({x,y}) => {
    const el = document.elementFromPoint(x,y);
    return el ? (el.tagName + ' ' + el.className + ' ' + el.id) : 'null';
  }, { x: box.x + box.width/2, y: box.y + box.height/2 });
  console.log('ELEMENT_AT_POINT:', elInfo);
  await window.evaluate(() => { document.getElementById('settingsBtn').click(); });
  await window.waitForTimeout(1000);
  await window.waitForTimeout(1000);
  const modalVisible = await window.evaluate(() => !document.getElementById('settingsModal').classList.contains('hidden'));
  console.log('SETTINGS_MODAL:', modalVisible);
  await window.evaluate(() => { document.getElementById('closeSettingsBtn').click(); });
  await window.waitForTimeout(500);

  // 5. Open library
  await window.evaluate(() => { document.getElementById('libBtn').click(); });
  await window.waitForTimeout(2000);
  const libVisible = await window.evaluate(() => !document.getElementById('viewLibrary').classList.contains('hidden'));
  console.log('LIBRARY_VISIBLE:', libVisible);

  await app.close();
  console.log('DONE');
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
