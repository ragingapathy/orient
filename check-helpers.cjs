// Shared steps for the older checks, so each one does not repeat how to reach a screen.
// Explore opens on the daily briefing (on a phone it starts as a low drawer); the list and the map are one tap further.
// Clicks here are DOM clicks: these steps are about getting to a screen, not about whether a control is covered or animating.
const dom = (page, selector) => page.evaluate(sel => { const e = [...document.querySelectorAll(sel)].find(x => x.getBoundingClientRect().width > 0) || document.querySelector(sel); if (!e) throw new Error('nothing matches ' + sel); e.click(); }, selector);
const shown = (page, selector) => page.evaluate(sel => [...document.querySelectorAll(sel)].some(x => x.getBoundingClientRect().width > 0), selector);
// Open the briefing drawer if the start actions are hidden inside it.
const reveal = async (page, action) => {
  if (!(await shown(page, `[data-action="${action}"]`)) && (await shown(page, '.briefing-handle'))) await dom(page, '.briefing-handle');
  return shown(page, `[data-action="${action}"]`);
};
const HOME = { name: 'Toledo', coordinates: [-83.539, 41.655], timeZone: 'America/New_York' };
module.exports = {
  dom, shown, HOME,
  // Start the page with a saved map (once per tab, so a reload keeps what the test changed). Call before page.goto.
  async seed(page, store) {
    await page.addInitScript(([s]) => { if (!sessionStorage.seeded) { sessionStorage.seeded = '1'; localStorage.setItem('orient-field-map-v1', JSON.stringify(s)); } }, [{ version: 1, home: HOME, useCatalog: false, osm: [], custom: [], saved: [], visited: [], ...store }]);
  },
  // Select a place from the Explore list (card at its first stop).
  async select(page, id) {
    await module.exports.list(page);
    await dom(page, `#panel [data-place="${id}"]`);
    await page.locator('#sheet').waitFor();
  },
  // The place the older checks start on: the catalog's default place (the app no longer opens one by itself).
  async openDefault(page) {
    await page.waitForFunction(() => window.ORIENT_DEFAULT_PLACE && document.querySelector('.bottom-nav'), null, { timeout: 20000 });
    await module.exports.select(page, await page.evaluate(() => window.ORIENT_DEFAULT_PLACE));
  },
  // Open a place's card in full from the Explore list.
  async openPlace(page, id) {
    await module.exports.list(page);
    await dom(page, `#panel [data-place="${id}"]`);
    await module.exports.expand(page);
  },
  // A fresh browser opens the "choose your city" dialog first; this dismisses it.
  async skipHome(page) {
    await page.waitForFunction(() => window.OrientHome && document.querySelector('#home-dialog'), null, { timeout: 15000 });
    if (await page.evaluate(() => document.querySelector('#home-dialog')?.open)) await dom(page, '[data-home-close]');
  },
  // The add (+) button: on the briefing it sits in the start actions, on the map in the tool column.
  async add(page) {
    if (!(await shown(page, '[data-action="add"]'))) { if (await reveal(page, 'explore-map')) await dom(page, '[data-action="explore-map"]'); }
    await dom(page, '[data-action="add"]');
  },
  // Open the place card's detail (a phone's drawer needs more than one step), whatever state it is in.
  async expand(page) {
    for (let i = 0; i < 3; i++) {
      if (await shown(page, '#sheet .detail')) return;
      await dom(page, '#sheet [data-action="expand"]'); await page.waitForTimeout(400);
    }
  },
  // Open the daily briefing if it is the low drawer a phone starts with.
  async briefing(page) {
    if (await page.evaluate(() => document.querySelector('.briefing-handle')?.getAttribute('aria-expanded') === 'false')) { await dom(page, '.briefing-handle'); await page.waitForTimeout(400); }
  },
  // The opposite: bring the card back to its closed state.
  async collapse(page) {
    for (let i = 0; i < 3; i++) {
      if (!(await shown(page, '#sheet .detail'))) return;
      await dom(page, '#sheet [data-action="expand"]'); await page.waitForTimeout(400);
    }
  },
  // The add dialog starts with two choices; this takes the first, "Add a place", which shows the form.
  async pick(page) { await dom(page, '[data-action="add-name"]'); },
  // From the briefing: "Explore as a list". Anywhere else the list toggle (Switch to list) is already on screen.
  async list(page) {
    if (await reveal(page, 'explore-list')) await dom(page, '[data-action="explore-list"]');
    else await dom(page, '[data-action="list"]');
  },
  // From the briefing: "Browse the map".
  async map(page) {
    if (await reveal(page, 'explore-map')) await dom(page, '[data-action="explore-map"]');
  },
};
