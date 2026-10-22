// Capture the running app without submitting research or exposing contact rows.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const output = path.resolve(__dirname, '../docs/images');
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('requestfailed', request => console.error('Request failed:', request.url(), request.failure()?.errorText));
    page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
    await page.goto(process.env.MAPPING_SCREENSHOT_URL || 'http://127.0.0.1:4173/#hotspots');
    try {
      await page.locator('#research-desk').waitFor({ timeout: 10000 });
    } catch {
      await page.reload();
      await page.locator('#research-desk').waitFor({ timeout: 10000 });
    }
    // Existing UI extensions initialize on timers up to 1600 ms after load.
    await page.waitForTimeout(1800);
    for (const route of ['overview', 'primary-mappings', 'secondary-mappings', 'hotspots']) {
      await page.locator(`.side-nav a[href="#${route}"]`).click();
      const panel = page.locator(`[data-view="${route}"].view-panel`);
      await panel.waitFor({ state: 'visible' });
      if (route === 'overview') await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      else await panel.evaluate(element => window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - 110, behavior: 'instant' }));
      await page.mouse.move(1400, 980);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(output, `${route}.png`), fullPage: false });
      console.log(`Captured ${route}`);
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
