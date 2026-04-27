/**
 * 🤖 LLM Test Console — Browser Runtime Checker
 *
 * 🎯 Purpose: Load the app in a real headless browser and report ALL runtime
 *    errors, JS crashes, and blank-screen symptoms. Run this whenever the
 *    app shows a blank screen or unexpected behaviour.
 *
 * 🚀 Usage (via wrapper):
 *    ./tools/check_app                        → http://localhost:5051
 *    ./tools/check_app http://localhost:5173  → custom URL
 *    ./tools/check_app https://your.vercel.app → production
 *
 * 📦 Requires: @playwright/test installed globally + chromium browser
 *    npm install -g @playwright/test && playwright install chromium
 */

// CJS-style dynamic import so NODE_PATH resolution works at runtime
const globalNodeModules = require('child_process').execSync('npm root -g').toString().trim();
const { chromium } = require(globalNodeModules + '/@playwright/test');

const url = process.argv[2] || 'http://localhost:5051';

(async () => {
  console.log('');
  console.log('🤖 ════════════════════════════════════════════════');
  console.log('🤖  BAR ECO MANIFOLD — Browser Runtime Checker');
  console.log('🤖 ════════════════════════════════════════════════');
  console.log(`🌐  Target: ${url}`);
  console.log('');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const jsErrors = [];
  const consoleErrors = [];
  const consoleWarns = [];
  const networkFails = [];

  page.on('pageerror', e => jsErrors.push(e.message));
  page.on('console', m => {
    if (m.type() === 'error') consoleErrors.push(m.text());
    if (m.type() === 'warning') consoleWarns.push(m.text());
  });
  page.on('requestfailed', req => networkFails.push(`${req.failure()?.errorText} — ${req.url()}`));

  let loadOk = true;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
  } catch (e) {
    console.log(`❌  Page load failed: ${e.message}`);
    loadOk = false;
  }

  const rootHTML  = await page.evaluate(() => document.getElementById('root')?.innerHTML ?? '');
  const bodyText  = await page.evaluate(() => document.body.innerText.trim().slice(0, 400));
  const title     = await page.title();
  const rootEmpty = rootHTML.trim().length < 10;

  await browser.close();

  // ── Results ──────────────────────────────────────────────────────────────
  console.log(`📄  Page title: "${title}"`);
  console.log('');

  if (jsErrors.length === 0) {
    console.log('✅  JS Errors (pageerror): none');
  } else {
    console.log(`💥  JS Errors (pageerror): ${jsErrors.length} found!`);
    jsErrors.forEach((e, i) => console.log(`    [${i + 1}] ${e}`));
  }
  console.log('');

  if (consoleErrors.length === 0) {
    console.log('✅  Console errors: none');
  } else {
    console.log(`⚠️   Console errors: ${consoleErrors.length} found`);
    consoleErrors.forEach((e, i) => console.log(`    [${i + 1}] ${e}`));
  }
  console.log('');

  if (networkFails.length === 0) {
    console.log('✅  Network failures: none');
  } else {
    console.log(`🔌  Network failures: ${networkFails.length}`);
    networkFails.forEach((e, i) => console.log(`    [${i + 1}] ${e}`));
  }
  console.log('');

  if (rootEmpty) {
    console.log('🖤  #root is EMPTY — blank screen confirmed!');
  } else {
    console.log(`🟢  #root has content (${rootHTML.length} chars)`);
  }
  console.log('');

  console.log('👁️   Visible body text (first 400 chars):');
  console.log(bodyText ? `    "${bodyText}"` : '    (nothing visible)');
  console.log('');

  // ── Verdict ──────────────────────────────────────────────────────────────
  console.log('🤖 ════════════════════════════════════════════════');
  if (!loadOk || jsErrors.length > 0 || rootEmpty) {
    console.log('🔴  VERDICT: APP IS BROKEN — see errors above');
  } else if (consoleErrors.length > 0) {
    console.log('🟡  VERDICT: App loads but has console errors — investigate');
  } else {
    console.log('🟢  VERDICT: App appears healthy');
  }
  console.log('🤖 ════════════════════════════════════════════════');
  console.log('');
})();
