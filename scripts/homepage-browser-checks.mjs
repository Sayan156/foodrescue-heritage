import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { once } from 'node:events';
import { writeFile } from 'node:fs/promises';

// Real browser interactions against the production bundle, with synthetic API responses.
process.env.NODE_ENV = 'production';
const { app } = await import('../server/src/app.js');
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
const browserPath = process.env.BROWSER_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
if (!browserPath) throw new Error('Set BROWSER_PATH to a Chromium browser executable.');
const output = resolve('.browser-check-homepage');
mkdirSync(output, { recursive: true });
const profile = resolve(output, `profile-${Date.now()}`);
mkdirSync(profile, { recursive: true });
const browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', ...(process.env.BROWSER_NO_SANDBOX === '1' ? ['--no-sandbox'] : []), `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true });
let socket;
try {
  const debuggerUrl = await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error('Browser did not start within 20 seconds')), 20000);
    browser.once('error', reject);
    browser.stderr.on('data', chunk => {
      output += chunk;
      const match = output.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
  });
  const endpoint = new URL(debuggerUrl);
  console.log('Browser started; connecting to test page.');
  const targets = await (await fetch(`http://${endpoint.host}/json/list`)).json();
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  const pending = new Map(); let sequence = 0;
  const exceptions = [], requests = []; 
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails);
    if (message.method === 'Network.requestWillBeSent' && message.params.request.url.includes('/food-rescue-sequence/')) requests.push(message.params.request.url);
    if (!message.id) return;
    const callbacks = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) callbacks.reject(new Error(message.error.message)); else callbacks.resolve(message.result);
  });
  function command(method, params = {}) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Browser command timed out: ${method}`)), 10000);
      const id = ++sequence; pending.set(id, { resolve: value => { clearTimeout(timeout); resolve(value); }, reject: error => { clearTimeout(timeout); reject(error); } });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }
  async function waitFor(expression) {
    const start = Date.now();
    while (Date.now() - start < 7000) {
      if (await evaluate(`!!document.body && (${expression})`)) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(`Timed out: ${expression}\n${await evaluate('JSON.stringify({url:location.href,ready:document.readyState,scroll:scrollY,story:document.querySelector(".scroll-story")?.dataset,canvas:document.querySelector("canvas")?.dataset,visual:document.querySelector(".story-visual")?.dataset,listeners:window.__scrollListeners})')}`);
  }
  const click = text => evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(text)}); if (!b) throw new Error('Button missing: ' + ${JSON.stringify(text)}); b.click(); })()`);
  async function navigate(path, role) {
    await evaluate(`localStorage.setItem('test-role', ${JSON.stringify(role)}); localStorage.setItem('fr_token', 'synthetic-token')`);
    await command('Page.navigate', { url: origin + path });
    await waitFor(`!!document.querySelector('.dash-content')`);
  }
  await command('Page.enable');
  await command('Runtime.enable');
  await command('Network.enable');
  await command('Network.setBlockedURLs', { urls: ['https://fonts.googleapis.com/*', 'https://fonts.gstatic.com/*', 'https://images.unsplash.com/*'] });
  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await command('Page.addScriptToEvaluateOnNewDocument', { source: `
    const active = new Set();
    const add = window.addEventListener.bind(window), remove = window.removeEventListener.bind(window);
    window.addEventListener = (type, listener, options) => { if(type === 'scroll') active.add(listener); return add(type, listener, options); };
    window.removeEventListener = (type, listener, options) => { if(type === 'scroll') active.delete(listener); return remove(type, listener, options); };
    Object.defineProperty(window, '__scrollListeners', {get: () => active.size});
  ` });
  const sleep = time => new Promise(resolve => setTimeout(resolve, time));
  const viewport = (width, height) => command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
  async function openHome() {
    await command('Page.navigate', { url: origin + '/' });
    await waitFor(`!!document.querySelector('.home-page')`);
  }
  async function screenshot(name) {
    const data = await command('Page.captureScreenshot', { format: 'png' });
    await writeFile(resolve(output, name + '.png'), Buffer.from(data.data, 'base64'));
  }
  async function scrollToProgress(progress) {
    await evaluate(`(() => {
      const section = document.querySelector('.scroll-story'), stage = document.querySelector('.story-stage');
      const top = scrollY + section.getBoundingClientRect().top;
      scrollTo({ top: top + (section.offsetHeight - stage.offsetHeight) * ${progress}, behavior: 'instant' });
    })()`);
  }
  async function checkFrame(progress) {
    const frame = Math.round(progress * 239) + 1;
    await scrollToProgress(progress);
    // Device-scale rounding may land less than one CSS pixel either side of a frame boundary.
    await waitFor(`Math.abs(Number(document.querySelector('.scroll-story').dataset.targetFrame) - ${frame}) <= 1 && document.querySelector('canvas').dataset.frame === document.querySelector('.scroll-story').dataset.targetFrame`);
  }

  await viewport(1440, 1000);
  await openHome();
  await waitFor(`document.querySelector('canvas')?.dataset.frame === '1'`);
  assert.equal(await evaluate('document.querySelectorAll("canvas").length'), 1);
  await sleep(700);
  assert.equal(await evaluate('document.querySelector("canvas").dataset.frame'), '1');
  assert.ok(new Set(requests).size <= 8, 'Initial loading must be a small window, not 240 frames');
  await screenshot('desktop-first');
  assert.equal(await evaluate('document.querySelectorAll("[data-chapter], .story-chapters, .story-footer, .story-masthead, .story-progress").length'), 0);
  assert.ok(await evaluate('document.querySelector(".story-visual").getBoundingClientRect().top === 0'));
  assert.ok(await evaluate('Math.abs(document.querySelector(".story-visual").getBoundingClientRect().height - innerHeight) < 2'));
  await checkFrame(0.5);
  assert.equal(await evaluate('getComputedStyle(document.querySelector("[data-story-opening]")).opacity'), '0');
  assert.equal(await evaluate('getComputedStyle(document.querySelector("[data-story-ending]")).opacity'), '0');
  await screenshot('desktop-middle');
  for (const p of [0.25, 0.5, 0.75, 1, 0.75, 0.5, 0.25, 0]) await checkFrame(p);
  console.log('PASS: initial poster, bounded startup, exact frame mapping and reverse scrolling');

  for (const p of [0.95, 0.05, 0.8, 0.15, 1, 0.4]) { await scrollToProgress(p); await sleep(20); }
  await checkFrame(0.4);
  await checkFrame(1);
  assert.equal(await evaluate('document.querySelector("[data-story-ending]").inert'), false);
  assert.ok(await evaluate('document.querySelector(".topbar").getBoundingClientRect().top >= -1'));
  await screenshot('desktop-final');
  await evaluate(`document.querySelector('.topbar a[href="/"]:not(.brand)').click()`);
  await waitFor('document.querySelector("canvas").dataset.frame === "1" && scrollY === 0');
  await checkFrame(1);
  await evaluate(`document.querySelector('#our-purpose').scrollIntoView({behavior:'instant'})`);
  await sleep(200);
  assert.ok(await evaluate('document.querySelector(".story-stage").getBoundingClientRect().bottom <= 100'));
  await screenshot('desktop-purpose');
  console.log('PASS: rapid scrubbing, final CTA, sticky navbar and normal scrolling after the sequence');

  await checkFrame(0.5);
  const listeners = await evaluate('window.__scrollListeners');
  assert.equal(listeners, 1);
  await evaluate(`document.querySelector('.topbar a[href="/about"]').click()`);
  await waitFor('location.pathname === "/about" && !document.querySelector(".home-page")');
  assert.equal(await evaluate('window.__scrollListeners'), 0);
  await evaluate('history.back()');
  await waitFor('!!document.querySelector(".home-page") && window.__scrollListeners === 1');
  await checkFrame(0.5);
  await command('Page.reload');
  await waitFor('!!document.querySelector(".home-page") && window.__scrollListeners === 1');
  await checkFrame(0.5);
  console.log('PASS: navigation cleanup, browser Back and refresh at a scrolled position');

  for (const [width, height] of [[360, 740], [390, 844], [430, 932], [768, 1024], [1024, 800], [1440, 1000]]) {
    await viewport(width, height);
    await openHome();
    await checkFrame(0);
    const layout = await evaluate(`(() => {
      const visual = document.querySelector('.story-visual').getBoundingClientRect();
      const header = document.querySelector('.topbar').getBoundingClientRect();
      return { overflow: document.documentElement.scrollWidth > innerWidth, visual: {width:visual.width,height:visual.height}, viewport:{width:innerWidth,height:innerHeight}, header:{left:header.left,right:header.right}, src: document.querySelector('.story-poster img').currentSrc };
    })()`);
    assert.equal(layout.overflow, false, `Horizontal overflow at ${width}px`);
    if (width < 768) {
      assert.ok(layout.src.includes('/mobile/'), 'Phones use the smaller variant');
    }
    assert.ok(Math.abs(layout.visual.height - layout.viewport.height) < 2, 'Animation fills the viewport height');
    assert.ok(layout.header.left >= 0 && layout.header.right <= layout.viewport.width, 'Floating navigation fits the screen');
    await screenshot(`viewport-${width}-first`);
    await checkFrame(1);
    const bounds = await evaluate(`(() => { const r=document.querySelector('[data-story-actions]').getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:innerHeight}; })()`);
    assert.ok(bounds.top >= 0 && bounds.bottom <= bounds.height, `CTA accessible at ${width}px`);
    await screenshot(`viewport-${width}-final`);
    console.log(`PASS: ${width}px responsive framing, no overflow and accessible final actions`);
  }

  const paths = await evaluate(`Array.from(document.querySelectorAll('.home-page a')).map(a=>a.getAttribute('href'))`);
  assert.ok(paths.every(path => ['/explore', '/register', '/about', '/support', '#our-purpose'].includes(path)));
  for (const path of ['/explore', '/register', '/about', '/support']) assert.ok(paths.includes(path));
  await viewport(390, 844);
  await openHome();
  await checkFrame(0);
  await evaluate(`document.querySelector('.mobile-menu').click()`);
  assert.equal(await evaluate('document.querySelector(".mobile-menu").getAttribute("aria-expanded")'), 'true');
  await evaluate(`document.querySelector('.mobile-menu').click()`);
  await evaluate(`document.documentElement.dataset.theme = 'dark'`);
  await screenshot('mobile-dark');
  console.log('PASS: existing homepage destinations, mobile navigation and dark theme');

  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await waitFor('document.querySelector(".scroll-story").dataset.animated === "false"');
  await sleep(200);
  requests.length = 0;
  await openHome();
  await waitFor('document.querySelector(".scroll-story").dataset.animated === "false"');
  await sleep(700);
  assert.ok(requests.every(url => /frame_(0001|0180)\./.test(url)), `Reduced motion downloads only editorial/poster stills: ${requests.join(', ')}`);
  assert.equal(await evaluate('document.querySelector(".scroll-story").offsetHeight === document.querySelector(".story-stage").offsetHeight'), true);
  assert.ok(await evaluate('!!document.querySelector(".story-static-actions a")'));
  console.log('PASS: reduced motion removes the scroll runway and avoids sequence downloads');

  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await command('Network.setBlockedURLs', { urls: ['https://fonts.googleapis.com/*', 'https://fonts.gstatic.com/*', '*food-rescue-sequence*'] });
  await openHome();
  await waitFor('document.querySelector(".scroll-story").dataset.animated === "false"');
  assert.ok(await evaluate(`!!document.querySelector('.home-page a[href="/explore"]')`));
  assert.equal(await evaluate('document.querySelector(".scroll-story").offsetHeight === document.querySelector(".story-stage").offsetHeight'), true);
  await screenshot('mobile-missing-assets');
  assert.deepEqual(exceptions, [], 'No uncaught browser exceptions');
  console.log('PASS: missing assets retain content/actions and release the pinned section; no uncaught errors');
  console.log('Screenshots: .browser-check-homepage/');
} finally {
  socket?.close(); browser.kill();
  await new Promise(resolve => server.close(resolve));
}
