const { _electron: electron } = require('playwright');
const path = require('path');

const appPath = path.resolve(__dirname, '../..');

(async () => {
  const app = await electron.launch({ args: [appPath] });
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  await window.waitForTimeout(5000);

  // open settings
  const btnExists = await window.locator('#settingsBtn').count();
  console.log('SETTINGS_BTN_EXISTS:', btnExists);
  const hasHandler = await window.evaluate(() => {
    const btn = document.getElementById('settingsBtn');
    // check if addEventListener was called
    const desc = Object.getOwnPropertyDescriptor(btn, 'onclick');
    return { onclick: !!desc, hasListener: btn.onclick !== null };
  });
  console.log('HANDLER_INFO:', JSON.stringify(hasHandler));
  await window.evaluate(() => { document.getElementById('settingsBtn').click(); });
  await window.waitForTimeout(2000);
  const modalVisible = await window.evaluate(() => !document.getElementById('settingsModal').classList.contains('hidden'));
  console.log('SETTINGS_MODAL:', modalVisible);

  // change theme via JS
  const themeResult = await window.evaluate(() => {
    const sel = document.getElementById('themeSelect');
    if (!sel) return 'no select';
    sel.value = 'light';
    sel.dispatchEvent(new Event('change'));
    return document.documentElement.getAttribute('data-theme');
  });
  console.log('THEME_AFTER_CHANGE:', themeResult);

  await window.evaluate(() => { document.getElementById('closeSettingsBtn').click(); });
  await window.waitForTimeout(500);

  await app.close();
  console.log('DONE');
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
