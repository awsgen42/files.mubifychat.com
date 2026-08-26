import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 160)); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 160)));
page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url().slice(-60)} ${r.failure()?.errorText}`));
const responses = [];
page.on('response', (r) => { if (/worker|\.ts$/.test(r.url())) responses.push(`${r.status()} ${r.url().slice(-70)}`); });

await page.goto('http://127.0.0.1:8791/tools/instagram-data-download-viewer/', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
const status = await page.textContent('[data-probe]');
console.log('probe says :', JSON.stringify(status));
console.log('worker-ish responses:', responses.length ? responses.join('\n                     ') : '(none)');
console.log('errors     :', errors.length ? errors.join('\n             ') : '(none)');
await browser.close();
process.exit(/worker alive in worker-scope/.test(status ?? '') ? 0 : 1);
