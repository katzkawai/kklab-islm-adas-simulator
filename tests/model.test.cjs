const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map(match => match[1]).find(source => source.includes('function solveFullEquilibrium'));
const elements = new Map();
const plots = new Map();
const context = vm.createContext({
  window: { addEventListener() {} },
  document: {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, { value: '', getClientRects: () => [] });
      return elements.get(id);
    }
  },
  Plotly: { react: (id, data, layout) => plots.set(id, { data, layout }) }
});
vm.runInContext(script, context);
const model = vm.runInContext(`({ ECON, PRESETS, getAlpha, calcIS_i, calcLM_i, calcAS_P,
  solveFullEquilibrium, solveISLM_for_P, formatDelta, writeSliders, renderCharts,
  updateKPIsAndCommentary, setBaseline: params => { baselineParams = { ...params }; } })`, context);

function close(actual, expected, tolerance = 1e-8) {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) < tolerance,
    `${actual} should equal ${expected} within ${tolerance}`);
}

function checkMarkets(params, eq, includeSupply = true) {
  assert.ok(eq.Y > 0 && eq.P > 0 && eq.i > model.ECON.i_min);
  close(eq.r, eq.i - params.pie);
  close(eq.i, model.calcLM_i(eq.Y, eq.P, params));
  const C = model.ECON.C0 + model.ECON.c * (1 - params.t / 100) * eq.Y;
  const I = params.I0 - params.b * eq.r;
  close(eq.Y, C + I + params.G);
  if (includeSupply) close(eq.P, model.calcAS_P(eq.Y, params));
  const q = eq.i - model.ECON.i_min;
  close(params.M * 100 / eq.P,
    model.ECON.k * eq.Y + model.ECON.h / q
      - model.ECON.minSlack ** 2 * q / model.ECON.h - model.ECON.L0, 1e-7);
}

test('preset equilibria agree with the corrected textbook examples', () => {
  const expected = {
    standard: [584.1713248, 103.6337060],
    '1990s': [475.0155458, 90.4012437],
    '2013': [620.3600867, 107.7888069],
    '2022': [662.4070903, 117.2725672]
  };
  for (const [key, params] of Object.entries(model.PRESETS)) {
    const eq = model.solveFullEquilibrium(params);
    checkMarkets(params, eq);
    close(eq.Y, expected[key][0], 1e-6);
    close(eq.P, expected[key][1], 1e-6);
  }
});

test('all slider corners and deterministic interior scenarios clear every market', () => {
  const bounds = { G: [60, 180], t: [10, 38], M: [160, 520], pie: [-2.5, 4],
    b: [4, 32], I0: [55, 160], cost: [-1.5, 3.5] };
  const entries = Object.entries(bounds);
  const scenarios = Array.from({ length: 128 }, (_, mask) =>
    Object.fromEntries(entries.map(([key, values], i) => [key, values[(mask >> i) & 1]])));
  let seed = 20261016;
  for (let i = 0; i < 100; i++) {
    scenarios.push(Object.fromEntries(entries.map(([key, [low, high]]) => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return [key, low + (high - low) * seed / 2 ** 32];
    })));
  }
  for (const params of scenarios) {
    checkMarkets(params, model.solveFullEquilibrium(params));
    for (const P of [50, 100, 200]) {
      checkMarkets(params, model.solveISLM_for_P(P, params), false);
    }
  }
  const low = model.solveFullEquilibrium(scenarios.find(p => p.G === 60 && p.t === 38
    && p.M === 520 && p.pie === -2.5 && p.b === 32 && p.I0 === 55 && p.cost === -1.5));
  assert.ok(low.Y < 200 && low.P < 70, 'old lower search bounds must not clip equilibrium');
  const high = model.solveFullEquilibrium({ G: 180, t: 10, M: 520, pie: 4, b: 32, I0: 160, cost: 3.5 });
  assert.ok(high.P > 140, 'old upper price bound must not clip equilibrium');
});

test('policy comparisons have the expected signs, with incomplete fiscal multipliers', () => {
  for (const params of Object.values(model.PRESETS)) {
    const base = model.solveFullEquilibrium(params);
    const fiscal = model.solveFullEquilibrium({ ...params, G: params.G + 2 });
    const money = model.solveFullEquilibrium({ ...params, M: params.M + 5 });
    const supply = model.solveFullEquilibrium({ ...params, cost: params.cost + 0.5 });
    const tax = model.solveFullEquilibrium({ ...params, t: params.t + 0.5 });
    assert.ok(fiscal.Y > base.Y && fiscal.i > base.i && fiscal.I < base.I);
    assert.ok((fiscal.Y - base.Y) / 2 < model.getAlpha(params));
    assert.ok(money.Y > base.Y && money.i < base.i);
    assert.ok(supply.P > base.P && supply.Y < base.Y);
    assert.ok(tax.Y < base.Y);
  }
});

test('every preset value is representable by its HTML slider step', () => {
  const sliders = [...html.matchAll(/<input id="slider-(\w+)"[^>]*min="([\d.-]+)" max="([\d.-]+)" step="([\d.]+)"/g)];
  assert.equal(sliders.length, 7);
  for (const [, key, min, max, step] of sliders) {
    for (const params of Object.values(model.PRESETS)) {
      assert.ok(params[key] >= +min && params[key] <= +max);
      const increments = (params[key] - +min) / +step;
      close(increments, Math.round(increments));
    }
  }
});

test('charts include equilibria and bars at extreme slider settings', () => {
  model.setBaseline(model.PRESETS.standard);
  for (const params of [model.PRESETS['1990s'],
    { G: 60, t: 38, M: 520, pie: -2.5, b: 32, I0: 55, cost: -1.5 },
    { G: 180, t: 10, M: 520, pie: 4, b: 32, I0: 160, cost: 3.5 }]) {
    model.writeSliders(params);
    model.renderCharts();
    const eq = model.solveFullEquilibrium(params);
    const inside = (value, range) => assert.ok(value > range[0] && value < range[1]);
    inside(eq.Y, plots.get('chart-islm').layout.xaxis.range);
    inside(eq.i, plots.get('chart-islm').layout.yaxis.range);
    inside(eq.r, plots.get('chart-islm').layout.yaxis.range);
    inside(eq.Y, plots.get('chart-adas').layout.xaxis.range);
    inside(eq.P, plots.get('chart-adas').layout.yaxis.range);
    for (const value of [eq.gdpGap, eq.I, eq.fiscalDeficit]) {
      inside(value, plots.get('chart-bars').layout.yaxis.range);
    }
  }
});

test('investment commentary attributes crowding out only to an isolated G change', () => {
  const params = model.PRESETS['1990s'];
  const base = model.solveFullEquilibrium(params);
  model.setBaseline(params);
  const fiscal = { ...params, G: 140 };
  model.updateKPIsAndCommentary(model.solveFullEquilibrium(fiscal), base, fiscal);
  assert.match(elements.get('kpi-crowding').textContent, /金利上昇による投資減/);
  const mixed = { ...fiscal, pie: 1.2 };
  model.updateKPIsAndCommentary(model.solveFullEquilibrium(mixed), base, mixed);
  assert.match(elements.get('kpi-crowding').textContent, /複数要因/);
  assert.match(model.formatDelta(0.02, 2, '%pt'), /\+0\.02/);
});
