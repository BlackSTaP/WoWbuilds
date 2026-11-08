const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const E = require('../calculator.js');
const talents = require('../talents.json');
const builds = require('../data.json').builds;
const warrior = E.catalog(talents.classes.warrior.trees);

test('all 46 original routes are legal, unchanged and survive share-link round trips', () => {
  assert.equal(builds.length, 46);
  for (const build of builds) {
    const nodes = E.catalog(talents.classes[build.classId].trees);
    const preset = E.fromBuild(nodes, build);
    assert.equal(preset.ok, true, build.id);
    assert.equal(preset.reordered, false, build.id);
    assert.equal(preset.order.length, 51, build.id);
    assert.equal(E.totals(nodes, E.ranks(preset.order)).join('/'), build.allocation, build.id);
    assert.deepEqual(E.decode(nodes, E.encode(nodes, preset.order)).order, preset.order);
    for (let length = 0; length <= 51; length++) assert.equal(E.validate(nodes, preset.order.slice(0, length)).ok, true);
  }
});

test('rank caps, locked tiers, full prerequisites and 51 point budget', () => {
  assert.equal(E.add(warrior, [], '0:improved-charge').code, 'tier');
  const first = Array(5).fill('0:deflection');
  assert.equal(E.add(warrior, first, '0:deflection').code, 'max');
  assert.equal(E.add(warrior, first, '0:improved-charge').ok, true);
  const ten = [...first, ...Array(3).fill('0:improved-heroic-strike'), ...Array(2).fill('0:improved-charge')];
  assert.equal(E.add(warrior, ten, '0:deep-wounds').code, 'prerequisite');
  const full = E.fromBuild(warrior, builds.find(b => b.id === 'protection-warrior-pve')).order;
  assert.equal(E.add(warrior, full, '0:improved-heroic-strike').code, 'budget');
});

test('removal refuses broken dependencies, permits leaf refunds and never mutates its input', () => {
  const full = E.fromBuild(warrior, builds.find(b => b.id === 'fury-warrior-leveling')).order;
  const before = [...full];
  assert.equal(E.remove(warrior, full, '1:death-wish').code, 'dependent');
  const result = E.remove(warrior, full, '0:impale');
  assert.equal(result.ok, true);
  assert.equal(result.order.length, 50);
  assert.equal(E.validate(warrior, result.order).ok, true);
  assert.deepEqual(full, before);
});

test('every permitted refund in every preset remains valid; tree resets preserve other trees', () => {
  for (const build of builds) {
    const nodes = E.catalog(talents.classes[build.classId].trees), full = E.fromBuild(nodes, build).order;
    for (const id of new Set(full)) {
      const result = E.remove(nodes, full, id);
      if (result.ok) {
        assert.equal(result.order.length, 50);
        assert.equal(E.validate(nodes, result.order).ok, true, `${build.id}: ${id}`);
      }
    }
    for (let tree = 0; tree < 3; tree++) {
      const result = E.clearTree(nodes, full, tree);
      assert.equal(result.ok, true);
      assert.equal(E.totals(nodes, E.ranks(result.order))[tree], 0);
      const expected = full.filter(id => nodes.find(n => n.id === id).treeIndex !== tree);
      assert.deepEqual(result.order, expected);
    }
  }
});

test('empty and malformed links cannot bypass the rules', () => {
  assert.deepEqual(E.decode(warrior, '').order, []);
  for (const value of ['..', '-1', 'zzz', '1<script>', '0.'.repeat(60), '0.0.0.0', '6']) {
    assert.equal(E.decode(warrior, value).ok, false, value);
  }
});

test('all trees have complete bilingual ranks, assets, unique positions and valid dependency references', () => {
  let count = 0;
  for (const cls of Object.values(talents.classes)) {
    assert.equal(cls.trees.length, 3);
    const nodes = E.catalog(cls.trees);
    for (const tree of cls.trees) {
      assert.equal(new Set(tree.nodes.map(n => `${n.row}:${n.col}`)).size, tree.nodes.length);
      for (const n of tree.nodes) {
        count++;
        assert.ok(n.row >= 0 && n.row <= 6 && n.col >= 0 && n.col <= 3, n.name);
        assert.ok(n.name && n.nameRu && /[а-яё]/i.test(n.nameRu), n.name);
        assert.equal(n.descriptions.en.length, n.max, n.name);
        assert.equal(n.descriptions.ru.length, n.max, n.name);
        assert.ok(n.descriptions.ru.every(text => text && /[а-яё]/i.test(text)), n.name);
        assert.ok(fs.existsSync(path.join(__dirname, '..', n.icon)), n.icon);
        if (n.requires) assert.ok(nodes.some(parent => parent.id === n.requires && parent.row <= n.row && parent.id !== n.id), n.name);
      }
    }
  }
  assert.equal(count, 467);
});

test('generated browser data matches JSON and both UI locales have the same keys', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../talents.js'), 'utf8'), context);
  assert.equal(JSON.stringify(context.ATLAS_TALENTS), JSON.stringify(talents));
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../i18n.js'), 'utf8'), context);
  assert.deepEqual(Object.keys(context.ATLAS_I18N.ru).sort(), Object.keys(context.ATLAS_I18N.en).sort());
  const app = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
  for (const [, key] of app.matchAll(/\bt\('([^']+)'/g)) assert.ok(context.ATLAS_I18N.en[key], key);
});

test('Russian rank descriptions preserve every numerical value in the English source', () => {
  const numbers = text => (text.replace(/(?<=\d),(?=\d{3}\b)/g, '').replaceAll(',', '.').match(/\d+(?:\.\d+)?/g) || []).map(Number).sort((a,b) => a-b);
  for (const cls of Object.values(talents.classes)) for (const tree of cls.trees) for (const node of tree.nodes) {
    node.descriptions.en.forEach((text, rank) => assert.deepEqual(numbers(node.descriptions.ru[rank]), numbers(text), `${node.name} rank ${rank+1}`));
  }
});
