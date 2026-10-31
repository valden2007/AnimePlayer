const { _electron: electron } = require('playwright');
const path = require('path');
(async () => {
  const app = await electron.launch({ args: [path.resolve('C:/Users/PC/Desktop/Учёба и работа/Progect/anime-player')] });
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  await window.waitForTimeout(3000);
  await window.selectOption('#providerSelect', 'shikimori');
  await window.waitForTimeout(8000);
  const res = await window.evaluate(async () => {
    try {
      await App.openTitle('shikimori', '65209');
      return { ok: true, view: App.state.view, hasTitleName: !!document.getElementById('titleName'), titleName: document.getElementById('titleName')?.textContent, episodes: document.getElementById('episodesList')?.textContent };
    } catch (e) {
      return { ok: false, error: e.message, hasTitleName: !!document.getElementById('titleName') };
    }
  });
  console.log(JSON.stringify(res));
  await app.close();
})().catch(e => { console.error(e.message); process.exit(1); });
