import {chromium} from '@playwright/test';
const [url, out, w = '1920', h = '1080', clickSel] = process.argv.slice(2);
const browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
const page = await browser.newPage({viewport: {width: Number(w), height: Number(h)}, deviceScaleFactor: 0.5});
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto(url);
await page.waitForTimeout(2500);
if (clickSel) { await page.click(clickSel); await page.waitForTimeout(2500); }
await page.mouse.move(10, 10);
await page.waitForTimeout(300);
await page.screenshot({path: out});
console.log(out, errs.length ? 'ERRORS: ' + errs.join(' | ') : 'ok');
await browser.close();
