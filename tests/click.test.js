const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

const appPath = path.resolve(__dirname, '..');
const resultsDir = path.join(appPath, 'test-results');
if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

(async () => {
  const app = await electron.launch({ args: [appPath] });
  const window = await app.firstWindow();
  window.on('console', msg => console.log('CONSOLE:', msg.text()));
  window.on('pageerror', err => console.log('PAGEERROR:', err.message));
  await window.waitForLoadState('domcontentloaded');
  await window.waitForTimeout(3000);

  async function clickFirstCard(section, provider) {
    await window.selectOption('#providerSelect', provider);
    await window.waitForTimeout(8000);
    const card = window.locator('.card').first();
    await card.waitFor({ state: 'visible', timeout: 15000 });
    const box = await card.boundingBox();
    console.log('BOX:', JSON.stringify(box));
    const elInfo = await window.evaluate(({x,y}) => {
      const el = document.elementFromPoint(x,y);
      return el ? (el.tagName + ' ' + el.className) : 'null';
    }, { x: box.x + box.width/2, y: box.y + box.height/2 });
    console.log('ELEMENT_AT_POINT:', elInfo);
    await window.mouse.click(box.x + box.width/2, box.y + box.height/2);
    await window.waitForTimeout(4000);
    const b64 = await window.evaluate(async () => await API.capturePage());
    fs.writeFileSync(path.join(resultsDir, section + '.png'), Buffer.from(b64, 'base64'));
    const title = await window.locator('#titleName').textContent();
    const epText = await window.locator('#episodesList').textContent();
    console.log(section + ':', title, '|', epText);
    await window.evaluate(() => { App.goBack(); });
    await window.waitForTimeout(1000);
    await window.evaluate(() => { App.loadHome(); });
    await window.waitForTimeout(8000);
    return title;
  }

  const t1 = await clickFirstCard('shikimori-catalog', 'shikimori');
  const t2 = await clickFirstCard('anilibria-catalog', 'anilibria');

  await app.close();
  console.log('DONE', t1, t2);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
