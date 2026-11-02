const { _electron: electron } = require('playwright');
const path = require('path');

const appPath = path.resolve(__dirname, '../..');

(async () => {
  const app = await electron.launch({ args: [appPath] });
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  await window.waitForTimeout(5000);

  // Home visible
  const homeVisible = await window.evaluate(() => !document.getElementById('viewHome').classList.contains('hidden'));
  console.log('HOME_VISIBLE:', homeVisible);

  // Newest and popular grids have cards
  const newestCards = await window.locator('#newestGrid .card').count();
  const popularCards = await window.locator('#popularGrid .card').count();
  console.log('NEWEST_CARDS:', newestCards);
  console.log('POPULAR_CARDS:', popularCards);

  // Switch provider to shikimori
  await window.selectOption('#providerSelect', 'shikimori');
  await window.waitForTimeout(6000);
  const shikimoriCards = await window.locator('#newestGrid .card').count();
  console.log('SHIKIMORI_NEWEST_CARDS:', shikimoriCards);

  // Switch back
  await window.selectOption('#providerSelect', 'anilibria');
  await window.waitForTimeout(6000);

  await app.close();
  console.log('DONE');
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
