/* Pure talent rules. Shared by the browser and Node tests; no DOM or storage. */
(function (root) {
  'use strict';
  const LIMIT = 51;
  function catalog(trees) {
    return trees.flatMap((tree, treeIndex) => tree.nodes.map(node => ({ ...node, treeIndex, treeName: tree.name })));
  }
  function ranks(order) {
    return order.reduce((result, id) => { result[id] = (result[id] || 0) + 1; return result; }, Object.create(null));
  }
  function totals(nodes, allocation) {
    const values = [0, 0, 0];
    for (const node of nodes) values[node.treeIndex] += allocation[node.id] || 0;
    return values;
  }
  function canAdd(nodes, allocation, id) {
    const node = nodes.find(n => n.id === id);
    if (!node) return { ok: false, code: 'unknown' };
    if ((allocation[id] || 0) >= node.max) return { ok: false, code: 'max', talent: id };
    if (Object.values(allocation).reduce((a, b) => a + b, 0) >= LIMIT) return { ok: false, code: 'budget' };
    const below = nodes.filter(n => n.treeIndex === node.treeIndex && n.row < node.row)
      .reduce((sum, n) => sum + (allocation[n.id] || 0), 0);
    if (below < node.row * 5) return { ok: false, code: 'tier', required: node.row * 5, talent: id };
    if (node.requires) {
      const parent = nodes.find(n => n.id === node.requires);
      if (!parent || (allocation[parent.id] || 0) < parent.max) return { ok: false, code: 'prerequisite', talent: node.requires };
    }
    return { ok: true };
  }
  function validate(nodes, order) {
    if (!Array.isArray(order) || order.length > LIMIT) return { ok: false, code: 'budget' };
    const allocation = Object.create(null);
    for (let step = 0; step < order.length; step++) {
      const check = canAdd(nodes, allocation, order[step]);
      if (!check.ok) return { ...check, step };
      allocation[order[step]] = (allocation[order[step]] || 0) + 1;
    }
    return { ok: true };
  }
  // Preserve the previous order where possible, moving a point only if its gate requires it.
  function sequence(nodes, requested) {
    if (!Array.isArray(requested) || requested.length > LIMIT) return { ok: false, code: 'budget' };
    const pending = [...requested], order = [], allocation = Object.create(null);
    while (pending.length) {
      const next = pending.findIndex(id => canAdd(nodes, allocation, id).ok);
      if (next < 0) return { ...canAdd(nodes, allocation, pending[0]), ok: false };
      const [id] = pending.splice(next, 1);
      order.push(id); allocation[id] = (allocation[id] || 0) + 1;
    }
    return { ok: true, order };
  }
  function add(nodes, order, id) {
    const check = canAdd(nodes, ranks(order), id);
    return check.ok ? { ok: true, order: [...order, id] } : check;
  }
  function remove(nodes, order, id) {
    const last = order.lastIndexOf(id);
    if (last < 0) return { ok: false, code: 'empty' };
    const requested = order.filter((_, index) => index !== last);
    const result = sequence(nodes, requested);
    return result.ok ? result : { ...result, code: 'dependent' };
  }
  function clearTree(nodes, order, treeIndex) {
    return sequence(nodes, order.filter(id => nodes.find(n => n.id === id)?.treeIndex !== treeIndex));
  }
  function fromBuild(nodes, build) {
    const requested = build.order.map(step => nodes.find(n => n.treeName === step.tree && n.name === step.name)?.id);
    if (requested.some(id => !id)) return { ok: false, code: 'unknown' };
    const result = sequence(nodes, requested);
    return { ...result, reordered: result.ok && result.order.some((id, i) => id !== requested[i]) };
  }
  function encode(nodes, order) {
    return order.map(id => nodes.findIndex(n => n.id === id).toString(36)).join('.');
  }
  function decode(nodes, value) {
    if (typeof value !== 'string' || value.length > 160 || (value && !/^[0-9a-z]+(?:\.[0-9a-z]+)*$/.test(value))) return { ok: false, code: 'link' };
    const indexes = value ? value.split('.').map(n => parseInt(n, 36)) : [];
    if (indexes.some(i => !Number.isSafeInteger(i) || !nodes[i])) return { ok: false, code: 'link' };
    const order = indexes.map(i => nodes[i].id), check = validate(nodes, order);
    return check.ok ? { ok: true, order } : { ok: false, code: 'link' };
  }
  const api = { LIMIT, catalog, ranks, totals, canAdd, validate, sequence, add, remove, clearTree, fromBuild, encode, decode };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TalentEngine = api;
})(globalThis);
