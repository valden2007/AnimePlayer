const { _electron: electron } = require('playwright');
const path = require('path');

const appPath = path.resolve(__dirname, '../..');

(async () => {
  const app = await electron.launch({ args: [appPath] });
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  await window.waitForTimeout(5000);

  // Set genre filter
  await window.selectOption('#genreFilter', { index: 1 });
  await window.waitForTimeout(2000);
  const resultsVisible = await window.evaluate(() => !document.getElementById('resultsSection').classList.contains('hidden'));
  console.log('FILTERS_RESULTS_VISIBLE:', resultsVisible);

  // Reset
  await window.click('#resetFilters');
  await window.waitForTimeout(2000);
  const homeVisible = await window.evaluate(() => !document.getElementById('newestSection').classList.contains('hidden'));
  console.log('RESET_HOME_VISIBLE:', homeVisible);

  await app.close();
  console.log('DONE');
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
