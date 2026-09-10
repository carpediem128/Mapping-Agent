const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4173/#hotspots');
    await page.waitForFunction(() => document.querySelector('#hotspot-status')?.textContent.includes('AKShare'));
    const status = await page.locator('#hotspot-status').textContent();
    const summary = await page.locator('#market-summary').textContent();
    const response = await page.request.get('http://127.0.0.1:4173/data/site_data.json');
    const data = await response.json();
    assert.equal(data.hotspots.data_status, 'akshare_ok');
    assert.ok(data.hotspots.collected_at);
    assert.ok(!data.market_refresh_error);
    assert.ok(!status.includes('2026-08-14'));
    assert.ok(summary.includes('采集'));
    const rows = await page.locator('#hotspot-table-body tr').count();
    assert.equal(rows, data.hotspots.top20.length);
    await page.locator('#hotspot-status').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'runs/market_refresh_verified.png' });
    assert.deepEqual(errors, []);
    const report = { status, summary, rows, errors, collectedAt: data.hotspots.collected_at };
    fs.writeFileSync('runs/market_refresh_ui.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
