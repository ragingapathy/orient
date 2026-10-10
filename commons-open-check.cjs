// Sharing a note without a token: Orient opens GitHub's own "new file" page with the contribution filled in.
//   ORIENT_PLAYWRIGHT=<folder> ORIENT_URL=http://127.0.0.1:4173 node commons-open-check.cjs
// GitHub is mocked. Fictional data only; nothing is published.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { chromium } = require(process.env.ORIENT_PLAYWRIGHT || 'playwright');
const URL_ = process.env.ORIENT_URL || 'http://127.0.0.1:4173';
const seed = { version: 1, home: { name: 'Toledo', coordinates: [-83.539, 41.655], timeZone: 'America/New_York' }, useCatalog: false, custom: [{ id: 'local-coffee', name: 'Coffee fixture', kind: 'Coffee shop', coordinates: [-83.539, 41.655], note: 'A quiet place to browse.' }], saved: ['local-coffee'], visited: [], details: { 'local-coffee': { people: 'SECRET EMPLOYEE', note: 'A quiet place to browse.' } }, neighbors: [{ id: 'neighbor-secret', name: 'SECRET NEIGHBOR', note: 'SECRET CONVERSATION', coordinates: [-83.53, 41.65] }] };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] });
    const p = await ctx.newPage(); p.setDefaultTimeout(8000);
    const errors = [], posts = [], githubApi = [];
    p.on('pageerror', e => errors.push(e.message));
    p.on('request', r => { if (r.method() !== 'GET' && r.url().includes('/api/commons/')) posts.push(r.url()); });
    await p.route('**/api/commons/github', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ connected: false }) }));
    await p.route('**/api/state**', r => r.fulfill({ status: 403, body: '{}' }));
    await p.route('https://api.github.com/repos/**', r => {
      const repo = new URL(r.request().url()).pathname.replace('/repos/', ''); githubApi.push(repo);
      if (repo === 'city/missing') return r.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
      if (repo === 'city/private') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ private: true }) });
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ default_branch: 'trunk', private: false, archived: false }) });
    });
    await p.route('https://github.com/**', r => r.fulfill({ contentType: 'text/html', body: '<title>GitHub (mock)</title>' }));
    await p.addInitScript(s => { if (sessionStorage.fixture) return; sessionStorage.fixture = '1'; localStorage.setItem('orient-field-map-v1', JSON.stringify(s)); }, seed);
    await p.goto(URL_); await p.waitForFunction(() => window.OrientCommons);
    await p.locator('#search').fill('Coffee fixture'); await p.locator('#panel .row').click();
    await p.locator('#sheet .grip').press('End');
    await p.locator('#sheet details').filter({ has: p.locator('[data-commons="share"]') }).locator('summary').first().click();
    await p.locator('[data-commons="share"]').click();

    // 1. the form asks for two things
    assert.equal(await p.locator('#commons-dialog [name=observation]').isVisible(), true);
    assert.equal(await p.locator('#commons-dialog [name=permission]').isVisible(), true);
    for (const n of ['placeName', 'lat', 'lng', 'kind', 'date', 'publisher', 'sourceURL', 'handle']) assert.equal(await p.locator('#commons-dialog [name=' + n + ']').isVisible(), false, n + ' stays out of the way');
    assert.equal(await p.locator('#commons-dialog [name=kind] option').first().textContent(), 'Getting in');
    console.log('ok  the form shows the observation and a consent box; the rest is tucked away');

    // 2. a plain-language preview with the file behind a link
    await p.locator('#commons-dialog [name=permission]').check();
    await p.getByRole('button', { name: 'Preview contribution', exact: true }).click();
    const dialogText = await p.locator('#commons-dialog').innerText();
    assert.match(dialogText, /A quiet place to browse\./); assert.match(dialogText, /Coffee fixture · Getting in/);
    assert.equal(await p.locator('.commons-preview').isVisible(), false);
    const open = p.getByRole('link', { name: 'Open on GitHub to finish' });
    assert.equal(await open.getAttribute('aria-disabled'), 'true'); assert.equal(await open.getAttribute('href'), null);
    console.log('ok  the preview is readable, the file is one click away, and the link waits for a repository');

    // 3. repository checks
    const repo = p.locator('#commons-dialog [name=commons-repository]');
    await repo.fill('city/missing'); await p.getByText(/can’t find a public repository called city\/missing/).waitFor();
    assert.equal(await open.getAttribute('aria-disabled'), 'true');
    await repo.fill('city/private'); await p.getByText('Choose an active public repository.').waitFor();
    await repo.fill('not a repo'); await p.getByText(/Use the form owner\/repository/).waitFor();
    await repo.fill('https://github.com/city/toledo/'); await p.waitForFunction(() => document.querySelector('[data-commons-open]').getAttribute('href'));
    const href = await open.getAttribute('href');
    assert.match(href, /^https:\/\/github\.com\/city\/toledo\/new\/trunk\?filename=contributions%2F[a-f0-9]{24}\.json&value=/);
    console.log('ok  missing, private and malformed repositories are explained; a pasted link works and the default branch is used');

    // 4. the link carries exactly the reviewed public file, with the same name the token route would use
    const u = new URL(href), value = u.searchParams.get('value'), name = u.searchParams.get('filename');
    const bundle = JSON.parse(value);
    assert.equal(bundle.claims.length, 1); assert.ok(!value.includes('SECRET'));
    assert.equal(value, JSON.stringify(bundle, null, 2) + '\n');
    assert.equal(name, 'contributions/' + crypto.createHash('sha256').update(JSON.stringify(bundle)).digest('hex').slice(0, 24) + '.json');
    assert.deepEqual(Object.keys(bundle.places[0]).sort(), ['coordinates', 'id', 'name', 'source_id']);
    console.log('ok  the link holds only the reviewed public bundle, named the same way as the token route');

    // 5. copy
    await p.getByRole('button', { name: 'Copy the file', exact: true }).click();
    await p.getByText(/Copied\. On GitHub choose Add file/).waitFor();
    assert.equal((await p.evaluate(() => navigator.clipboard.readText())).replaceAll('\r\n', '\n'), value); // Windows adds CRLF
    console.log('ok  Copy puts the same file on the clipboard');

    // 6. following the link opens GitHub, remembers the repository and the contribution, and never touches the token endpoints
    const popup = ctx.waitForEvent('page');
    await open.click();
    const opened = await popup; assert.match(opened.url(), /^https:\/\/github\.com\/city\/toledo\/new\/trunk\?filename=/);
    await p.getByText('Opened on GitHub. Press Propose new file, then Create pull request.').waitFor();
    const s = await p.evaluate(() => ({ repo: localStorage.getItem('orient-commons-repository'), map: JSON.parse(localStorage.getItem('orient-field-map-v1')) }));
    assert.equal(s.repo, 'city/toledo'); assert.equal(s.map.commons.records.length, 1);
    assert.ok(!JSON.stringify(s.map.commons).includes('SECRET'));
    assert.deepEqual(posts, [], 'nothing was sent to Orient\'s GitHub token endpoints: ' + posts.join(', '));
    console.log('ok  the link opened GitHub, remembered the repository, and used no token');

    // 7. a short, reviewed contribution fits in a link; the token route is still there, folded away
    assert.equal(await p.locator('.commons-advanced').evaluate(e => e.open), false);
    await p.getByText('Other ways to share', { exact: true }).click();
    assert.equal(await p.getByRole('button', { name: 'Publish from Orient with a token', exact: true }).isVisible(), true);
    assert.deepEqual(errors, [], errors.join(' | '));
    console.log('PASS: sharing a note opens GitHub with the contribution filled in, no token needed');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
