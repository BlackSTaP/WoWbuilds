/* Versioned, validated local builds. Imports never replace existing records. */
(function(root) {
  'use strict';
  const KEY = 'forever-atlas-personal-v1', LIMIT = 100, MAX_BYTES = 1024 * 1024;
  function create(storage, presets, nodesFor, engine, uuid = () => crypto.randomUUID()) {
    function record(value) {
      if (!value || typeof value !== 'object' || typeof value.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(value.id) || typeof value.name !== 'string') throw Error('invalid');
      const name = value.name.trim(), preset = presets.find(b => b.id === value.baseId);
      if (!name || name.length > 60 || !preset || !engine.validate(nodesFor(preset.classId),value.order).ok) throw Error('invalid');
      return {id:value.id,name,baseId:preset.id,order:[...value.order]};
    }
    function parse(text) {
      if (typeof text !== 'string' || text.length > MAX_BYTES) throw Error('invalid');
      const data = JSON.parse(text);
      if (data?.format !== 'forever-atlas-builds' || data.version !== 1 || !Array.isArray(data.builds) || data.builds.length > LIMIT) throw Error('invalid');
      const records = data.builds.map(record);
      if (new Set(records.map(r => r.id)).size !== records.length) throw Error('invalid');
      return records;
    }
    function pack(records) { return JSON.stringify({format:'forever-atlas-builds',version:1,builds:records},null,2); }
    function list() { const text = storage.getItem(KEY); return text === null ? [] : parse(text); }
    function write(records) {
      if (records.length > LIMIT) throw Error('limit');
      const checked = parse(pack(records));
      storage.setItem(KEY,pack(checked));
      return checked;
    }
    function save(value, id = null) {
      const records = list();
      if (id && !records.some(r => r.id === id)) throw Error('missing');
      const saved = record({...value,id:id || uuid()});
      write(id ? records.map(r => r.id === id ? saved : r) : [...records,saved]);
      return saved;
    }
    function remove(id) { return write(list().filter(r => r.id !== id)); }
    function importFile(text) {
      const incoming = parse(text), records = list(), existing = new Set(records.map(signature));
      let added = 0;
      for (const item of incoming) {
        if (existing.has(signature(item))) continue;
        existing.add(signature(item)); records.push({...item,id:uuid()}); added++;
      }
      if (added) write(records);
      return added;
    }
    function signature(r) { return JSON.stringify([r.baseId,r.name,r.order]); }
    return {list,save,remove,importFile,exportFile:() => pack(list()),parse};
  }
  const api = {create,KEY,LIMIT,MAX_BYTES};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SavedBuilds = api;
})(globalThis);
