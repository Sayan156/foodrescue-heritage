import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { once } from 'node:events';

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
const profile = resolve(`.browser-check-${Date.now()}`);
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
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
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
    throw new Error(`Timed out: ${expression}\n${await evaluate('JSON.stringify({url:location.href,ready:document.readyState,text:document.body?.innerText,html:document.documentElement?.outerHTML})')}`);
  }
  const click = text => evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(text)}); if (!b) throw new Error('Button missing: ' + ${JSON.stringify(text)}); b.click(); })()`);
  async function navigate(path, role) {
    await evaluate(`localStorage.setItem('test-role', ${JSON.stringify(role)}); localStorage.setItem('fr_token', 'synthetic-token')`);
    await command('Page.navigate', { url: origin + path });
    await waitFor(`!!document.querySelector('.dash-content')`);
  }
  await command('Page.enable');
  await command('Network.enable');
  await command('Network.setBlockedURLs', { urls: ['https://fonts.googleapis.com/*', 'https://fonts.gstatic.com/*', 'https://images.unsplash.com/*'] });
  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  console.log('Browser connected; installing synthetic API.');
  await command('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__calls = [];
    window.__receiptAttempts = 0;
    window.__assignmentStatus = 'en_route';
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (url, options = {}) => {
      const path = new URL(url, location.origin).pathname;
      if (!path.startsWith('/api/')) return nativeFetch(url, options);
      const method = options.method || 'GET';
      const body = options.body ? JSON.parse(options.body) : null;
      window.__calls.push({ path, method, body });
      const role = localStorage.getItem('test-role') || 'ngo';
      const donation = { _id: 'food-1', title: 'Rice meals', category: 'prepared', quantityTotal: 10, quantityAvailable: 10, unit: 'meals', status: 'available', pickupDeadline: '2030-11-05T12:00:00Z', description: 'Fresh meals', address: 'Test address' };
      const request = { _id: 'request-1', status: 'approved', requestedQuantity: 6, approvedQuantity: 6, ngo: { name: 'Community NGO' }, donation, collectionPlan: 'Pickup today' };
      let data = {}, status = 200;
      if (path === '/api/auth/me') data = { user: { id: 'user-1', name: 'Test User', role, status: 'verified' } };
      else if (path === '/api/auth/forgot-password') data = { message: 'If an account uses that email address, a password reset link will arrive shortly.' };
      else if (path === '/api/auth/reset-password') data = { message: 'Your password has been reset. Sign in with your new password.' };
      else if (path.includes('/summary')) data = { completed: 1 };
      else if (path === '/api/assignments/receiving') data = { items: window.__receiptAttempts > 1 ? [] : [{ _id: 'assignment-1', status: 'collected', collectedQuantity: 6, request }] };
      else if (path.endsWith('/confirmation')) { window.__receiptAttempts++; if (window.__receiptAttempts === 1) { status = 400; data = { error: 'Invalid delivered/distributed quantity' }; } else data = { record: {} }; }
      else if (path === '/api/assignments/mine') data = { items: [{ _id: 'assignment-1', status: window.__assignmentStatus, request }] };
      else if (path.startsWith('/api/assignments/') && path.endsWith('/status')) { window.__assignmentStatus = body.status; data = { assignment: {} }; }
      else if (path === '/api/donations') data = { items: [donation], pages: 1 };
      else if (path.endsWith('/requests') && method === 'GET') data = { items: [request] };
      else if (path === '/api/requests/mine') data = { items: [{ ...request, status: 'pending' }] };
      else if (path === '/api/volunteers') data = { items: [{ _id: 'volunteer-1', name: 'Alex Volunteer' }] };
      else if (path === '/api/admin/users') data = { items: [{ id: 'user-2', name: 'Pending Donor', email: 'donor@example.com', role: 'donor', status: 'pending' }] };
      else if (path === '/api/admin/audit') data = { items: [{ _id: 'audit-1', entityType: 'Donation', entityLabel: 'Rice meals', actor: { name: 'Test Donor' }, action: 'created', createdAt: '2026-11-04T12:00:00Z' }] };
      return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    };
    window.prompt = () => { throw new Error('Browser prompt must not be used'); };
  ` });
  await command('Page.navigate', { url: origin + '/login' });
  await waitFor(`document.body.innerText.includes('Forgot password?')`);
  const deepLink = await fetch(origin + '/dashboard?tab=receiving');
  assert.equal(deepLink.status, 200);
  assert.match(deepLink.headers.get('content-type'), /text\/html/);
  assert.equal((await fetch(origin + '/api/no-such-route')).status, 404);

  await navigate('/dashboard?tab=receiving', 'ngo');
  await waitFor(`document.body.innerText.includes('Confirm food received')`);
  await click('Confirm food received');
  await waitFor(`document.body.innerText.includes('Invalid delivered/distributed quantity')`);
  await click('Confirm food received');
  await waitFor(`document.body.innerText.includes('Receipt confirmed for Rice meals.')`);
  assert.equal(await evaluate(`document.body.innerText.includes('Invalid delivered/distributed quantity')`), false);
  console.log('PASS: receipt failure followed by success clears stale error');

  await navigate('/dashboard?tab=assignments', 'volunteer');
  await waitFor(`document.body.innerText.includes('Confirm collected')`);
  await click('Confirm collected');
  await waitFor(`!!document.querySelector('[role="dialog"] input')`);
  await click('Cancel');
  await waitFor(`document.body.innerText.includes('Action cancelled')`);
  assert.equal(await evaluate(`window.__calls.filter(c => c.method === 'PATCH').length`), 0);
  await click('Confirm collected'); await click('Confirm');
  await waitFor(`document.body.innerText.includes('collection confirmed')`);
  assert.equal(await evaluate(`window.__calls.find(c => c.method === 'PATCH').body.collectedQuantity`), 6);
  await navigate('/dashboard?tab=assignments', 'volunteer');
  await waitFor(`document.body.innerText.includes('Mark pickup failed')`);
  await click('Mark pickup failed');
  await evaluate(`(() => { const input = document.querySelector('textarea'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, 'Vehicle unavailable'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await click('Confirm');
  await waitFor(`document.body.innerText.includes('pickup marked as failed')`);
  console.log('PASS: collection dialog, dismissal feedback, quantity submission and failed pickup');

  await navigate('/dashboard?tab=requests', 'donor');
  await waitFor(`document.body.innerText.includes('Assign pickup')`);
  await click('Assign pickup');
  await waitFor(`document.body.innerText.includes('Choose a volunteer for Rice meals')`);
  assert.equal(await evaluate(`window.__calls.filter(c => c.method === 'POST').length`), 0);
  await evaluate(`(() => { const select = document.querySelector('.action-row select'); select.value = 'volunteer-1'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await click('Assign pickup');
  await waitFor(`document.body.innerText.includes('Pickup for Rice meals assigned to Alex Volunteer.')`);
  await click('My listings');
  await waitFor(`location.search === '?tab=listings' && document.body.innerText.includes('Edit listing')`);
  await click('Edit listing'); await waitFor(`!!document.querySelector('[role="dialog"] textarea')`);
  await click('Save changes');
  await waitFor(`document.body.innerText.includes('Rice meals updated.')`);
  await click('Cancel listing');
  await waitFor(`document.querySelector('[role="dialog"]')?.innerText.includes('Cancel Rice meals?')`);
  await click('Go back');
  await command('Page.reload');
  await waitFor(`document.body.innerText.includes('Edit listing')`);
  assert.equal(await evaluate(`location.search`), '?tab=listings');
  assert.equal(await evaluate(`localStorage.getItem('fr_token')`), 'synthetic-token');
  console.log('PASS: missing volunteer feedback, named assignment success, listing actions and reloadable tabs');

  await navigate('/dashboard?tab=verification', 'admin');
  await waitFor(`document.body.innerText.includes('Pending Donor')`);
  await click('Verify');
  await waitFor(`document.querySelector('[role="dialog"]')?.innerText.includes('Verify Pending Donor?')`);
  assert.equal(await evaluate(`window.__calls.filter(c => c.method === 'PATCH').length`), 0);
  await click('Go back'); await click('Suspend');
  await waitFor(`document.querySelector('[role="dialog"]')?.innerText.includes('Suspend Pending Donor?')`);
  assert.equal(await evaluate(`window.__calls.filter(c => c.method === 'PATCH').length`), 0);
  await evaluate(`document.querySelector('[role="dialog"] .button').click()`);
  await waitFor(`document.body.innerText.includes('Pending Donor has been suspended.')`);
  await click('Audit history');
  await waitFor(`document.body.innerText.includes('Rice meals') && document.body.innerText.includes('Test Donor')`);
  console.log('PASS: admin confirmation before mutation and readable audit labels');

  await navigate('/dashboard?tab=myrequests', 'ngo');
  await waitFor(`document.body.innerText.includes('Cancel request')`);
  await click('Cancel request');
  assert.equal(await evaluate(`window.__calls.filter(c => c.method === 'PATCH').length`), 0);
  await evaluate(`document.querySelector('[role="dialog"] .button').click()`);
  await waitFor(`document.body.innerText.includes('Request for Rice meals cancelled.')`);

  await command('Page.navigate', { url: origin + '/explore' });
  await waitFor(`document.body.innerText.includes('Request food')`);
  await click('Request food');
  await evaluate(`(() => { const input = document.querySelector('textarea'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, 'Volunteer pickup this afternoon'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await click('Submit request');
  await waitFor(`document.body.innerText.includes('Request for Rice meals submitted to donor.')`);
  assert.equal(await evaluate(`(() => { const notice = document.querySelector('.notice.success'); const listing = document.querySelector('.listings'); return !!(notice.compareDocumentPosition(listing) & Node.DOCUMENT_POSITION_FOLLOWING) && notice.getBoundingClientRect().top >= 0 && notice.getBoundingClientRect().bottom <= innerHeight; })()`), true);
  console.log('PASS: NGO cancellation and visible request-submission confirmation');

  await command('Page.navigate', { url: origin + '/forgot-password' });
  await waitFor(`!!document.querySelector('input[type="email"]')`);
  await evaluate(`(() => { const input = document.querySelector('input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'ngo@example.com'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await click('Send reset link');
  await waitFor(`document.body.innerText.includes('a password reset link will arrive shortly')`);
  await command('Page.navigate', { url: origin + '/reset-password#token=' + 'a'.repeat(64) });
  await waitFor(`document.querySelectorAll('input[type="password"]').length === 2`);
  await evaluate(`document.querySelectorAll('input').forEach(input => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'New-Password-12345'); input.dispatchEvent(new Event('input', { bubbles: true })); })`);
  await click('Reset password');
  await waitFor(`document.body.innerText.includes('Your password has been reset.')`);
  assert.equal(await evaluate('location.hash'), '');
  console.log('PASS: forgot/reset password screens and reset token removed from URL');

  await navigate('/dashboard?tab=assignments', 'volunteer');
  await waitFor(`!!document.querySelector('.button.small')`);
  const colors = await evaluate(`(() => { document.documentElement.dataset.theme = 'dark'; const style = getComputedStyle(document.querySelector('.button.small')); return [style.color, style.backgroundColor]; })()`);
  const luminance = color => color.match(/\d+/g).slice(0, 3).map(Number).map(value => {
    const channel = value / 255; return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
  const levels = colors.map(luminance).sort((a, b) => b - a);
  const contrast = (levels[0] + 0.05) / (levels[1] + 0.05);
  assert.ok(contrast >= 4.5, `Dark button text contrast: ${contrast}`);
  console.log(`PASS: dark-mode primary button contrast ${contrast.toFixed(2)}:1`);
} finally {
  socket?.close();
  browser.kill();
  await new Promise(resolve => server.close(resolve));
}
