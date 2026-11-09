const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm'), fs = require('node:fs');
const E = require('../calculator.js'), S = require('../saved-builds.js');
const C = require('../build-catalog.js');
const presets = require('../data.json').builds, talents = require('../talents.json');
const bases = C.create(presets,talents.classes);
const nodesFor = id => E.catalog(talents.classes[id].trees);
function storage() { const map=new Map(); return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)}; }

test('all nine classes start empty and remain independent from the 46 unchanged presets',()=>{
  assert.equal(presets.length,46); assert.equal(bases.length,55);
  assert.equal(new Set(bases.map(b=>b.id)).size,55);
  for (const preset of presets) assert.equal(bases.find(b=>b.id===preset.id),preset);
  for (const classId of Object.keys(talents.classes)) {
    const base=bases.find(b=>b.id===`custom-${classId}`);
    assert.equal(base.classId,classId); assert.equal(base.custom,true);
    assert.deepEqual(E.fromBuild(nodesFor(classId),base).order,[]);
    assert.equal(E.validate(nodesFor(classId),[]).ok,true);
  }
});

test('blank and edited custom builds survive named links, reload and portable backups for every class',()=>{
  const context={URL,URLSearchParams,E,nodesFor,location:{pathname:'/WoWbuilds/',search:'',href:'https://example.org/WoWbuilds/'}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../build-features.js'),'utf8'),context);
  const disk=storage(); let sequence=0;
  const store=S.create(disk,bases,nodesFor,E,()=>`source-${++sequence}`);
  for(const base of bases.filter(b=>b.custom)) {
    const nodes=nodesFor(base.classId), first=nodes.find(n=>E.add(nodes,[],n.id).ok);
    const point=E.add(nodes,[],first.id).order;
    for(const order of [[],point]) {
      const name=`Мой ${base.classId} & PvP`;
      const params=new URLSearchParams(new URL(context.buildLink(base,order,name)).hash.slice(1));
      const resolved=bases.find(b=>b.id===params.get('build'));
      assert.equal(resolved,base); assert.equal(params.get('n'),name);
      assert.deepEqual(E.decode(nodesFor(resolved.classId),params.get('o')).order,order);
      store.save({name,baseId:resolved.id,order});
    }
  }
  const reloaded=S.create(disk,bases,nodesFor,E);
  assert.equal(reloaded.list().length,18);
  const destination=S.create(storage(),bases,nodesFor,E,()=>`copy-${++sequence}`);
  assert.equal(destination.importFile(reloaded.exportFile()),18);
  assert.deepEqual(destination.list().map(({id,...r})=>r),store.list().map(({id,...r})=>r));
});

test('existing saved preset builds still load with the expanded catalog',()=>{
  const disk=storage(), old=S.create(disk,presets,nodesFor,E,()=> 'legacy');
  const base=presets[0], order=E.fromBuild(nodesFor(base.classId),base).order;
  const record=old.save({name:'Existing build',baseId:base.id,order});
  assert.deepEqual(S.create(disk,bases,nodesFor,E).list(),[record]);
});
