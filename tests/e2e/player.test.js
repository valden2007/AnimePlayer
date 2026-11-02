const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

const appPath = path.resolve(__dirname, '../..');
const resultsDir = path.join(appPath, 'test-results');
if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

(async () => {
  const app = await electron.launch({ args: [appPath] });
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  await window.waitForTimeout(5000);

  // switch to anilibria
  await window.selectOption('#providerSelect', 'anilibria');
  await window.waitForTimeout(6000);

  // open first title
  const card = window.locator('.card').first();
  await card.waitFor({ state: 'visible', timeout: 15000 });
  const box = await card.boundingBox();
  await window.mouse.click(box.x + box.width/2, box.y + box.height/2);
  await window.waitForTimeout(5000);

  // click first episode
  const ep = window.locator('.ep').first();
  if (await ep.count() > 0) {
    await ep.click();
    await window.waitForTimeout(5000);
    const playerVisible = await window.evaluate(() => !document.getElementById('viewPlayer').classList.contains('hidden'));
    console.log('PLAYER_VISIBLE:', playerVisible);

    // test play/pause
    await window.click('#playPause');
    await window.waitForTimeout(500);
    const paused = await window.evaluate(() => document.getElementById('video').paused);
    console.log('VIDEO_PAUSED_AFTER_CLICK:', paused);

    // test fullscreen button
    await window.click('#fsBtn');
    await window.waitForTimeout(500);
    console.log('FULLSCREEN_BTN_CLICKED');

    // screenshot
    const b64 = await window.evaluate(async () => await API.capturePage());
    fs.writeFileSync(path.join(resultsDir, 'e2e-player.png'), Buffer.from(b64, 'base64'));
  }

  await app.close();
  console.log('DONE');
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
