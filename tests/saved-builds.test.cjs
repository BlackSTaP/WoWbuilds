const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm'), fs = require('node:fs');
const E = require('../calculator.js'), S = require('../saved-builds.js');
const data = require('../data.json'), talents = require('../talents.json');
const nodesFor = id => E.catalog(talents.classes[id].trees);
const base = data.builds[0], order = E.fromBuild(nodesFor(base.classId),base).order;
function setup() {
  const values = new Map(); let n=0;
  const storage={getItem:k=>values.get(k) ?? null,setItem:(k,v)=>values.set(k,v)};
  return {storage,store:S.create(storage,data.builds,nodesFor,E,()=>`test-${++n}`)};
}
test('save, reload, rename, copy and delete keep exact point order',()=>{
  const {store,storage}=setup(), r=store.save({name:'  Мой билд  ',baseId:base.id,order});
  order.push('invalid'); assert.equal(store.list()[0].order.length,51); order.pop();
  assert.equal(r.name,'Мой билд');
  const reloaded=S.create(storage,data.builds,nodesFor,E);
  assert.deepEqual(reloaded.list()[0].order,order);
  store.save({...r,name:'Renamed'},r.id); assert.equal(store.list().length,1);
  const copy=store.save({...r,name:'Copy'}); assert.notEqual(copy.id,r.id);
  store.remove(r.id); assert.equal(store.list()[0].name,'Copy');
});
test('export/import is portable, deduplicated and preserves existing records',()=>{
  const a=setup(), b=setup(); a.store.save({name:'Export',baseId:base.id,order});
  b.store.save({name:'Existing',baseId:base.id,order:[]});
  assert.equal(b.store.importFile(a.store.exportFile()),1);
  assert.equal(b.store.importFile(a.store.exportFile()),0);
  assert.equal(b.store.list().length,2);
  assert.deepEqual(b.store.list()[1].order,order);
});
test('bad files, illegal points, duplicate IDs and overlong names fail atomically',()=>{
  const {store}=setup(); const r=store.save({name:'Keep',baseId:base.id,order}); const before=store.exportFile();
  for(const patch of [{order:['missing']},{order:[...order,...order]},{baseId:'missing'},{name:''},{name:'x'.repeat(61)},{order:['2:shield-slam']}]) {
    assert.throws(()=>store.importFile(JSON.stringify({format:'forever-atlas-builds',version:1,builds:[{...r,...patch}]})));
    assert.equal(store.exportFile(),before);
  }
  assert.throws(()=>store.importFile('{bad json'));
  assert.throws(()=>store.importFile(JSON.stringify({format:'forever-atlas-builds',version:2,builds:[r]})));
  assert.throws(()=>store.importFile(JSON.stringify({format:'forever-atlas-builds',version:1,builds:[r,r]})));
  assert.throws(()=>store.save(r,'deleted-id'));
});
test('quota and corrupt storage cannot report success or silently erase data',()=>{
  const {store,storage}=setup(); store.save({name:'Keep',baseId:base.id,order});
  const before=store.exportFile(); storage.setItem=()=>{throw Error('quota')};
  assert.throws(()=>store.save({name:'New',baseId:base.id,order})); assert.equal(store.exportFile(),before);
  storage.getItem=()=>'{corrupt'; assert.throws(()=>store.list()); assert.throws(()=>store.save({name:'New',baseId:base.id,order}));
});
test('100-build cap rejects oversized imports without partial writes',()=>{
  const {store}=setup(); const records=Array.from({length:100},(_,i)=>({id:`id-${i}`,name:`Build ${i}`,baseId:base.id,order:[]}));
  store.importFile(JSON.stringify({format:'forever-atlas-builds',version:1,builds:records}));
  const before=store.exportFile(); assert.throws(()=>store.save({name:'Overflow',baseId:base.id,order:[]})); assert.equal(store.exportFile(),before);
});
test('every preset has bilingual, sourced guidance and role equipment notes',()=>{
  const context={};vm.runInNewContext(fs.readFileSync(require.resolve('../guides.js'),'utf8'),context);
  assert.equal(Object.keys(context.ATLAS_GUIDES).length,data.builds.length);
  for(const b of data.builds){const g=context.ATLAS_GUIDES[b.id];assert.equal(g.source,b.source);for(const lang of ['ru','en'])assert.ok(g[lang].length&&g[lang].every(s=>s.length>50));}
  for(const role of ['Tank','Healer','Caster','Hunter','Melee'])for(const lang of ['ru','en'])assert.ok(context.ATLAS_EQUIPMENT[role][lang]);
});
test('portable links contain name and exact order without local record IDs',()=>{
  const context={URL,URLSearchParams,E,nodesFor,location:{pathname:'/WoWbuilds/',search:'',href:'https://example.org/WoWbuilds/'}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../build-features.js'),'utf8'),context);
  const name='Мой билд <test> & PvP';
  const link=new URL(context.buildLink(base,order,name));const params=new URLSearchParams(link.hash.slice(1));
  assert.equal(params.get('n'),name);assert.equal(params.get('build'),base.id);assert.equal(params.get('v'),'1');
  assert.deepEqual(E.decode(nodesFor(base.classId),params.get('o')).order,order);
  assert.equal([...params.keys()].length,4);
  assert.equal(new URLSearchParams(new URL(context.buildLink(base,[],'')).hash.slice(1)).get('o'),'');
});
test('dependency paths identify prerequisites and exact missing tier points',()=>{
  const context={E,nodesFor,current:{classId:'warrior'},order:[]};
  vm.runInNewContext(fs.readFileSync(require.resolve('../build-features.js'),'utf8'),context);
  const info=context.dependencyInfo('2:shield-slam');
  assert.ok(info.parents.some(n=>n.name==='Concussion Blow'));
  assert.equal(info.missing,30); assert.ok(info.edges.has('2:shield-slam'));
  const tank=data.builds.find(b=>b.id==='protection-warrior-pve');context.order=E.fromBuild(nodesFor('warrior'),tank).order;
  assert.equal(context.dependencyInfo('2:shield-slam').missing,0);
  assert.ok(context.dependencyInfo('2:concussion-blow').descendants.some(n=>n.id==='2:shield-slam'));
});
