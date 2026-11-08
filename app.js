'use strict';
const DATA = window.ATLAS_DATA, TALENTS = window.ATLAS_TALENTS, E = window.TalentEngine;
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CLASSES = {
  warrior:['Воин','Warrior','#d3ac8a'], paladin:['Паладин','Paladin','#e5a5c4'], hunter:['Охотник','Hunter','#d6b67c'],
  rogue:['Разбойник','Rogue','#e2cc8b'], priest:['Жрец','Priest','#ded8ed'], shaman:['Шаман','Shaman','#97b3f4'],
  mage:['Маг','Mage','#a6c7f0'], warlock:['Чернокнижник','Warlock','#b9a0eb'], druid:['Друид','Druid','#dea475']
};
const SPECS = {Arms:'Оружие',Fury:'Неистовство',Protection:'Защита',Holy:'Свет',Retribution:'Воздаяние','Beast Mastery':'Повелитель зверей',Marksmanship:'Стрельба',Survival:'Выживание',Combat:'Бой',Assassination:'Ликвидация',Subtlety:'Скрытность',Discipline:'Послушание',Shadow:'Тьма',Elemental:'Стихии',Enhancement:'Совершенствование',Restoration:'Исцеление',Arcane:'Тайная магия',Fire:'Огонь',Frost:'Лёд',Affliction:'Колдовство',Demonology:'Демонология',Destruction:'Разрушение','Feral Combat':'Сила зверя',Balance:'Баланс'};
function stored(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
let language = stored('forever-atlas-language','ru');
if (!['ru','en'].includes(language)) language = 'ru';
const savedFavorites = stored('forever-atlas-favorites',[]);
const favorites = new Set((Array.isArray(savedFavorites) ? savedFavorites : []).filter(id => DATA.builds.some(b => b.id === id)));
const state = {classId:'all',mode:'all',role:'all',query:'',favorites:false};
const edits = new Map(), catalogs = new Map();
let current = null, order = [], tab = 'calculator', mobileTree = 0, returnFocus = null, tooltipId = null, pinnedTooltip = false, tooltipTimer;
function t(key, values = {}) {
  let text = window.ATLAS_I18N[language][key] || key;
  for (const [name,value] of Object.entries(values)) text = text.replaceAll(`{${name}}`,String(value));
  return text;
}
const className = id => CLASSES[id][language === 'ru' ? 0 : 1];
const treeName = name => language === 'ru' ? SPECS[name] || name : name;
const talentName = node => language === 'ru' ? node.nameRu : node.name;
const classIcon = id => `assets/class_${id}.jpg`;
function nodesFor(id) { if (!catalogs.has(id)) catalogs.set(id,E.catalog(TALENTS.classes[id].trees)); return catalogs.get(id); }
function specName(b) { return treeName(b.spec) + (b.id.includes('tank') && b.classId === 'druid' ? ` · ${t('bear')}` : b.id.includes('cat') ? ` · ${t('cat')}` : ''); }
function persist(key,value) { try { localStorage.setItem(key,JSON.stringify(value)); } catch { notify(t('sessionOnly')); } }
function notify(message) { $('#toast').textContent = message; $('#toast').classList.add('show'); clearTimeout(notify.timer); notify.timer = setTimeout(() => $('#toast').classList.remove('show'),3300); }
function applyLanguage() {
  document.documentElement.lang = language;
  $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  $$('[data-language]').forEach(el => { el.setAttribute('aria-pressed',String(el.dataset.language === language)); el.onclick = () => setLanguage(el.dataset.language); });
  $('#search').placeholder = t('search'); $('#search').setAttribute('aria-label',t('searchLabel'));
  $('#role').setAttribute('aria-label',t('role')); $('#modes').setAttribute('aria-label',t('builds')); $('#catalog').setAttribute('aria-label',t('library'));
}
function setLanguage(next) { language = next; persist('forever-atlas-language',language); hideTooltip(); applyLanguage(); render(); if (current) renderDetail(); if ($('#sourceDialog').open) renderSources(); }
function saveFavorite(id) {
  favorites.has(id) ? favorites.delete(id) : favorites.add(id); persist('forever-atlas-favorites',[...favorites]); render();
  if (current) { $('#detailFavorite').textContent = favorites.has(id) ? `★ ${t('saved')}` : `☆ ${t('addFavorite')}`; $('#detailFavorite').setAttribute('aria-pressed',String(favorites.has(id))); }
}
function filtered() {
  const q = state.query.trim().toLocaleLowerCase();
  return DATA.builds.filter(b => {
    if ((state.classId !== 'all' && b.classId !== state.classId) || (state.mode !== 'all' && b.mode !== state.mode) || (state.role !== 'all' && b.role !== state.role) || (state.favorites && !favorites.has(b.id))) return false;
    const selected = new Set(b.order.map(s => s.name));
    const names = nodesFor(b.classId).filter(n => selected.has(n.name)).flatMap(n => [n.name,n.nameRu]);
    return !q || [b.id,...CLASSES[b.classId],b.spec,SPECS[b.spec],t(b.mode),t(b.role),...names].join(' ').toLocaleLowerCase().includes(q);
  });
}
function renderClasses() {
  const item = (id,name,count,icon) => `<button class="class-button ${state.classId === id ? 'active' : ''}" data-class="${id}" aria-pressed="${state.classId === id}">${icon}${name}<small>${count}</small></button>`;
  $('#classes').innerHTML = item('all',t('allClasses'),46,'<span class="all-icon">◈</span>') + Object.keys(CLASSES).map(id => item(id,className(id),DATA.builds.filter(b => b.classId === id).length,`<img src="${classIcon(id)}" alt="">`)).join('');
  $$('[data-class]').forEach(el => { el.onclick = () => { state.classId = el.dataset.class; render(); }; });
}
function render() {
  renderClasses(); const list = filtered(); $('#favCount').textContent = favorites.size;
  $('#browse').classList.toggle('active',!state.favorites); $('#favorites').classList.toggle('active',state.favorites);
  $('#catalogTitle').innerHTML = `${state.favorites ? t('favorites') : state.classId === 'all' ? t('allClasses') : className(state.classId)} <span id="resultCount">${list.length}</span>`;
  $('#catalogOverline').textContent = t('library'); $('#resultLabel').textContent = `${t('ready')}: ${list.length} · 51 ${t('points')}`;
  $('#reset').hidden = state.classId === 'all' && state.mode === 'all' && state.role === 'all' && !state.query;
  $$('[data-mode]').forEach(el => { el.classList.toggle('active',state.mode === el.dataset.mode); el.setAttribute('aria-pressed',String(state.mode === el.dataset.mode)); }); $('#role').value = state.role;
  $('#builds').innerHTML = list.length ? list.map((b,i) => {
    const desc = b.mode === 'Leveling' ? 'levelingDesc' : b.mode === 'PvP' ? 'pvpDesc' : b.role === 'Tank' ? 'tankDesc' : b.role === 'Healer' ? 'healDesc' : 'damageDesc';
    const label = `${className(b.classId)}, ${specName(b)}, ${t(b.mode)}`;
    return `<article class="build-card" style="--accent:${CLASSES[b.classId][2]};animation-delay:${Math.min(i,8)*20}ms"><button class="favorite-button ${favorites.has(b.id) ? 'saved' : ''}" data-fav="${b.id}" aria-label="${esc(t(favorites.has(b.id) ? 'removeFavorite' : 'addFavorite')+': '+label)}" aria-pressed="${favorites.has(b.id)}">${favorites.has(b.id) ? '★' : '☆'}</button><button class="card-open" data-build="${b.id}" aria-label="${esc(t('openBuild')+': '+label)}"><div class="card-top"><img class="class-icon" src="${classIcon(b.classId)}" alt="" loading="lazy"><div><div class="card-class">${className(b.classId)}</div><div class="card-role">${t(b.role)}</div></div></div><h3>${specName(b)}</h3><p class="card-description">${t(desc)}</p><div class="card-bottom"><span class="mode-pill ${b.mode.toLowerCase()}">${t(b.mode)}</span><span class="allocation">${b.allocation}</span><span class="card-arrow">↗</span></div></button></article>`;
  }).join('') : `<div class="empty"><h3>${t(state.favorites ? 'emptyFavorites' : 'empty')}</h3><p>${t(state.favorites ? 'emptyFavoritesHelp' : 'emptyHelp')}</p><button id="emptyReset">${t('allBuilds')}</button></div>`;
  $$('[data-build]').forEach(el => { el.onclick = () => openBuild(el.dataset.build); }); $$('[data-fav]').forEach(el => { el.onclick = () => saveFavorite(el.dataset.fav); });
  if ($('#emptyReset')) $('#emptyReset').onclick = () => { state.favorites = false; resetFilters(); };
}
function resetFilters() { Object.assign(state,{classId:'all',mode:'all',role:'all',query:''}); $('#search').value = ''; render(); }
function shareURL() { const params = new URLSearchParams({build:current.id,v:'1',o:E.encode(nodesFor(current.classId),order)}); return `${location.pathname}${location.search}#${params}`; }
function writeHash() { history.replaceState(null,'',shareURL()); }
function errorMessage(result) {
  const node = current && nodesFor(current.classId).find(n => n.id === result.talent);
  const key = {budget:'errBudget',max:'errMax',tier:'errTier',prerequisite:'errPrerequisite',dependent:'errDependent',empty:'errEmpty',unknown:'errUnknown',link:'invalidLink'}[result.code] || 'errUnknown';
  return t(key,{n:result.required,name:node ? talentName(node) : result.talent});
}
function edit(action,id) {
  const nodes = nodesFor(current.classId), result = action === 'add' ? E.add(nodes,order,id) : E.remove(nodes,order,id);
  if (!result.ok) { notify(errorMessage(result)); return; }
  order = result.order; edits.set(current.id,[...order]); writeHash(); updateCalculator(); if (tooltipId) updateTooltip();
}
function openBuild(id,encoded = null,fromHash = false) {
  const b = DATA.builds.find(b => b.id === id); if (!b) { notify(t('unknownBuild')); return; }
  if (!$('#buildDialog').open) returnFocus = document.activeElement;
  current = b; const nodes = nodesFor(b.classId), preset = E.fromBuild(nodes,b);
  order = edits.has(id) ? [...edits.get(id)] : preset.ok ? preset.order : []; if (!preset.ok) notify(t('invalidPreset'));
  if (encoded !== null) { const decoded = E.decode(nodes,encoded); if (decoded.ok) order = decoded.order; else { order = preset.ok ? preset.order : []; notify(t('invalidLink')); } }
  tab = 'calculator'; const totals = E.totals(nodes,E.ranks(order)); mobileTree = totals.indexOf(Math.max(...totals));
  hideTooltip(); renderDetail(); if (!$('#buildDialog').open) $('#buildDialog').showModal(); $('#buildDialog').scrollTop = 0;
  if (!fromHash || encoded !== null) writeHash();
}
function renderDetail() {
  const b = current;
  $('#buildDialog').classList.toggle('calculator-mode',tab === 'calculator');
  $('#detail').innerHTML = `<div class="detail-header"><div class="detail-topline"><button class="back-button" id="back">← ${t('back')}</button><div class="detail-languages language-switch"><button data-language="ru" aria-label="Русский" lang="ru">RU</button><button data-language="en" aria-label="English" lang="en">EN</button></div><button class="close" id="closeDetail" aria-label="${t('close')}">×</button></div><div class="detail-title-line"><img src="${classIcon(b.classId)}" alt=""><div><div class="eyebrow" style="color:${CLASSES[b.classId][2]}">${className(b.classId).toUpperCase()} · ${t(b.mode)} · ${t(b.role)}</div><h2 id="detailTitle">${specName(b)}</h2></div><div class="detail-actions"><button class="button secondary" id="detailFavorite" aria-pressed="${favorites.has(b.id)}">${favorites.has(b.id) ? '★ '+t('saved') : '☆ '+t('addFavorite')}</button><button class="button" id="share">${t('share')} ↗</button></div></div><div class="detail-tabs" role="tablist"><button role="tab" id="tab-calculator" data-tab="calculator" aria-selected="${tab === 'calculator'}" aria-controls="detailBody" class="${tab === 'calculator' ? 'active' : ''}">${t('calculator')}</button><button role="tab" id="tab-plan" data-tab="plan" aria-selected="${tab === 'plan'}" aria-controls="detailBody" class="${tab === 'plan' ? 'active' : ''}">${t('progression')}</button></div></div><div class="detail-content" id="detailBody" role="tabpanel" aria-labelledby="tab-${tab}">${tab === 'calculator' ? calculatorHTML() : planHTML()}</div>`;
  $('#back').onclick = $('#closeDetail').onclick = () => $('#buildDialog').close(); $('#detailFavorite').onclick = () => saveFavorite(b.id); $('#share').onclick = share;
  $$('[data-tab]').forEach(el => {
    const change = next => { hideTooltip(); tab = next; renderDetail(); $(`[data-tab="${tab}"]`).focus(); };
    el.onclick = () => change(el.dataset.tab);
    el.onkeydown = event => { if (['ArrowLeft','ArrowRight'].includes(event.key)) { event.preventDefault(); change(tab === 'plan' ? 'calculator' : 'plan'); } };
  });
  applyLanguage();
  if (tab === 'calculator') bindCalculator();
  else $('#expandAll').onclick = () => { const all = $$('.level-group').every(el => el.open); $$('.level-group').forEach(el => { el.open = !all; }); $('#expandAll').textContent = t(all ? 'expand' : 'collapse'); };
}
function sourceNote() { return `<div class="source-note"><a href="${esc(current.source)}" target="_blank" rel="noopener">${t('sourceBuild')} ↗</a> · <a href="https://talentsforever.com/" target="_blank" rel="noopener">${t('rulesNote')}</a></div>`; }
function calculatorHTML() {
  const trees = TALENTS.classes[current.classId].trees;
  return `<div class="calc-toolbar"><div><div class="eyebrow" id="buildStatus"></div><strong id="calcSplit"></strong><span id="spentPoints"></span></div><div class="points-remaining"><b id="pointsLeft"></b><span>${t('left')}</span></div><div class="calc-actions"><button class="button secondary" id="restoreBuild">↺ ${t('restore')}</button><button class="button secondary" id="resetAll">${t('resetAll')}</button></div></div><p class="calc-help">${t('calculatorHelp')}</p><div class="mobile-tree-tabs" role="group" aria-label="${t('selectedTree')}">${trees.map((tree,ti) => `<button data-tree-tab="${ti}" aria-pressed="${ti === mobileTree}">${treeName(tree.name)}</button>`).join('')}</div><div class="calculator-trees">${trees.map((tree,ti) => `<section class="calc-tree ${ti === mobileTree ? 'mobile-active' : ''}" data-tree="${ti}"><div class="calc-tree-head"><img src="${tree.icon}" alt=""><h3>${treeName(tree.name)}</h3><b data-tree-points="${ti}"></b><button data-reset-tree="${ti}" aria-label="${t('clearTree')}: ${treeName(tree.name)}" title="${t('clearTree')}">↺</button></div><div class="calc-board"><svg class="talent-links" viewBox="0 0 400 700" preserveAspectRatio="none" aria-hidden="true"><defs><marker id="arrow-${ti}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="currentColor"/></marker></defs>${tree.nodes.filter(n => n.requires).map(n => {
    const p = tree.nodes.find(p => p.id === n.requires), sx = p.col*100+50, sy = p.row*100+84, tx = n.col*100+50, ty = n.row*100+12;
    const direction = Math.sign(tx-sx);
    const path = p.row === n.row ? `M${sx+direction*36},${p.row*100+50} H${tx-direction*39}` : sx === tx ? `M${sx},${sy} V${ty}` : `M${sx},${sy} V${sy+8} H${tx} V${ty}`;
    return `<path class="talent-link" data-edge="${n.id}" d="${path}" marker-end="url(#arrow-${ti})"/>`;
  }).join('')}</svg>${tree.nodes.map(n => `<button class="calc-node" data-node="${n.id}" style="left:${n.col*25+12.5}%;top:${(n.row+.5)/7*100}%" aria-label="${esc(talentName(n))}" aria-describedby="calculatorHelp"><img src="${n.icon}" alt="" draggable="false"><span class="node-rank"></span></button>`).join('')}</div></section>`).join('')}</div><p class="calc-help" id="calculatorHelp">${t('basePoint')}</p>${sourceNote()}`;
}
function updateCalculator() {
  if (tab !== 'calculator') return;
  const nodes = nodesFor(current.classId), allocation = E.ranks(order), totals = E.totals(nodes,allocation), preset = E.fromBuild(nodes,current).order || [];
  $('#calcSplit').textContent = totals.join(' / '); $('#pointsLeft').textContent = E.LIMIT-order.length; $('#spentPoints').textContent = `${order.length} / 51 ${t('points')}`;
  $('#buildStatus').textContent = t(E.encode(nodes,preset) === E.encode(nodes,order) ? 'preset' : 'custom'); $('#resetAll').disabled = order.length === 0;
  $$('[data-tree-points]').forEach(el => { el.textContent = totals[Number(el.dataset.treePoints)]; }); $$('[data-reset-tree]').forEach(el => { el.disabled = totals[Number(el.dataset.resetTree)] === 0; });
  $$('[data-node]').forEach(el => {
    const n = nodes.find(n => n.id === el.dataset.node), rank = allocation[n.id] || 0, can = E.canAdd(nodes,allocation,n.id);
    el.classList.toggle('learned',rank > 0); el.classList.toggle('maxed',rank === n.max); el.classList.toggle('locked',!can.ok && rank === 0 && can.code !== 'budget'); el.classList.toggle('available',can.ok);
    el.querySelector('.node-rank').textContent = `${rank}/${n.max}`; el.setAttribute('aria-label',`${talentName(n)}, ${t('rank')} ${rank}/${n.max}`);
  });
  $$('[data-edge]').forEach(el => { const child = nodes.find(n => n.id === el.dataset.edge), parent = nodes.find(n => n.id === child.requires); el.classList.toggle('satisfied',(allocation[parent.id] || 0) === parent.max); });
}
function bindCalculator() {
  $('#resetAll').onclick = () => { hideTooltip(); order = []; edits.set(current.id,[]); writeHash(); updateCalculator(); };
  $('#restoreBuild').onclick = () => { hideTooltip(); const preset = E.fromBuild(nodesFor(current.classId),current); if (!preset.ok) { notify(t('invalidPreset')); return; } order = preset.order; edits.delete(current.id); writeHash(); updateCalculator(); notify(t('restored')); };
  $$('[data-reset-tree]').forEach(el => { el.onclick = () => { hideTooltip(); const result = E.clearTree(nodesFor(current.classId),order,Number(el.dataset.resetTree)); if (result.ok) { order = result.order; edits.set(current.id,[...order]); writeHash(); updateCalculator(); } else notify(errorMessage(result)); }; });
  $$('[data-tree-tab]').forEach(el => { el.onclick = () => { hideTooltip(); mobileTree = Number(el.dataset.treeTab); $$('[data-tree-tab]').forEach(btn => btn.setAttribute('aria-pressed',String(Number(btn.dataset.treeTab) === mobileTree))); $$('.calc-tree').forEach(tree => tree.classList.toggle('mobile-active',Number(tree.dataset.tree) === mobileTree)); }; });
  $$('[data-node]').forEach(el => {
    el.onpointerenter = event => { if (event.pointerType !== 'touch') showTooltip(el.dataset.node,false); }; el.onpointerleave = scheduleHideTooltip;
    el.onfocus = () => showTooltip(el.dataset.node,false); el.onblur = scheduleHideTooltip;
    el.onclick = event => { if (event.pointerType === 'touch' || ((innerWidth <= 760 || matchMedia('(hover: none)').matches) && event.detail > 0)) { showTooltip(el.dataset.node,true); return; } edit(event.shiftKey ? 'remove' : 'add',el.dataset.node); showTooltip(el.dataset.node,false); };
    el.oncontextmenu = event => { event.preventDefault(); edit('remove',el.dataset.node); showTooltip(el.dataset.node,false); };
    el.onkeydown = event => { if (['-','Delete','Backspace'].includes(event.key)) { event.preventDefault(); edit('remove',el.dataset.node); } };
  }); updateCalculator();
}
function hideTooltip() { clearTimeout(tooltipTimer); tooltipId = null; pinnedTooltip = false; $('#talentTooltip').hidden = true; }
function scheduleHideTooltip() { if (!pinnedTooltip) tooltipTimer = setTimeout(() => { if (!$('#talentTooltip').matches(':hover') && !$('#talentTooltip').contains(document.activeElement)) hideTooltip(); },160); }
function showTooltip(id,pinned) { clearTimeout(tooltipTimer); tooltipId = id; pinnedTooltip = pinned; updateTooltip(); }
function updateTooltip() {
  if (!current || !tooltipId) return;
  const nodes = nodesFor(current.classId), n = nodes.find(n => n.id === tooltipId), allocation = E.ranks(order), rank = allocation[n.id] || 0, other = language === 'ru' ? 'en' : 'ru';
  const rankHTML = (r,label) => `<section class="tooltip-rank"><h4>${label} ${r}/${n.max}</h4><p lang="${language}">${esc(n.descriptions[language][r-1])}</p><p class="tooltip-original" lang="${other}"><b>${other.toUpperCase()}</b> ${esc(n.descriptions[other][r-1])}</p>${!n.confirmed.includes(r) ? `<small class="tooltip-warning">${t('estimated')}</small>` : ''}</section>`;
  const parent = nodes.find(p => p.id === n.requires), can = E.canAdd(nodes,allocation,n.id), canRemove = E.remove(nodes,order,n.id).ok, panel = $('#talentTooltip');
  panel.innerHTML = `<button class="tooltip-close" id="closeTooltip" aria-label="${t('close')}">×</button><div class="tooltip-title"><img src="${n.icon}" alt=""><div><h3 lang="${language}">${esc(talentName(n))}</h3><span lang="${other}">${esc(language === 'ru' ? n.name : n.nameRu)}</span></div></div><div class="tooltip-meta">${treeName(n.treeName)} · ${t('rank')} ${rank}/${n.max}</div>${n.cost[language] ? `<p class="tooltip-cost">${esc(n.cost[language])}</p>` : ''}${rank ? rankHTML(rank,t('currentRank')) : ''}${rank < n.max ? rankHTML(rank+1,t('nextRank')) : ''}<div class="tooltip-requirements">${n.row ? `<div>${t('requiresPoints')}: ${n.row*5}</div>` : ''}${parent ? `<div>${t('requiresTalent')}: ${esc(talentName(parent))} (${parent.max}/${parent.max})</div>` : ''}</div><div class="tooltip-controls"><button id="removeTalent" aria-label="${t('remove')}" ${!canRemove ? 'disabled' : ''}>−</button><strong>${rank} / ${n.max}</strong><button id="addTalent" aria-label="${t('add')}" ${!can.ok ? 'disabled' : ''}>+</button></div><small class="translation-note">${t('translation')}</small>`;
  panel.hidden = false; panel.onpointerenter = () => clearTimeout(tooltipTimer); panel.onpointerleave = scheduleHideTooltip;
  $('#closeTooltip').onclick = () => { const anchor = $(`[data-node="${tooltipId}"]`); hideTooltip(); anchor?.focus({preventScroll:true}); hideTooltip(); };
  $('#addTalent').onclick = () => { pinnedTooltip = true; edit('add',n.id); $('#addTalent')?.focus({preventScroll:true}); };
  $('#removeTalent').onclick = () => { pinnedTooltip = true; edit('remove',n.id); $('#removeTalent')?.focus({preventScroll:true}); }; positionTooltip();
}
function positionTooltip() {
  const panel = $('#talentTooltip'); if (panel.hidden || !tooltipId) return;
  const anchor = $(`[data-node="${tooltipId}"]`); if (!anchor) { hideTooltip(); return; }
  if (innerWidth <= 760) { panel.style.left = '12px'; panel.style.top = 'auto'; panel.style.bottom = '12px'; return; }
  panel.style.bottom = 'auto'; const rect = anchor.getBoundingClientRect(), width = panel.offsetWidth, height = panel.offsetHeight;
  let left = rect.right+13; if (left+width > innerWidth-12) left = rect.left-width-13;
  panel.style.left = `${Math.max(12,Math.min(left,innerWidth-width-12))}px`; panel.style.top = `${Math.max(12,Math.min(rect.top-20,innerHeight-height-12))}px`;
}
function planHTML() {
  const nodes = nodesFor(current.classId), totals = E.totals(nodes,E.ranks(order)), counts = {};
  const steps = order.map((id,index) => { const node = nodes.find(n => n.id === id); counts[id] = (counts[id] || 0)+1; return {...node,level:index+10,rank:counts[id]}; });
  return `<div class="plan-layout"><aside class="build-summary"><div class="eyebrow gold">${t('spent')}</div><div class="point-total">${totals.join('/')}</div><div class="point-label">${order.length} / 51 ${t('points')}</div><p>${order.length ? `${t('completeAt')} ${order.length+9}` : t('emptyBuild')}</p><p class="summary-note">${t('basePoint')}</p></aside><section><div class="route-title"><h3>${t('pathTitle')}</h3><button id="expandAll">${t('expand')}</button></div><p class="route-intro">${t('pathHelp')} ${current.mode !== 'Leveling' ? t('pathPve') : ''}</p>${!steps.length ? `<p class="notice">${t('routeEmpty')}</p>` : ''}${[[10,19],[20,29],[30,39],[40,49],[50,60]].map(([start,end],i) => {
    const group = steps.filter(s => s.level >= start && s.level <= end); if (!group.length) return '';
    return `<details class="level-group" ${i === 0 ? 'open' : ''}><summary><span class="level-badge">${start}–${Math.min(end,steps.length+9)}</span><b>${t('levels')}</b><span class="group-hint">${esc(talentName(group.find(n => n.max === 1) || group[0]))}</span><span class="chevron">›</span></summary>${group.map(n => `<div class="step"><span class="step-level">${n.level} ${t('level')}</span><img src="${n.icon}" alt="" loading="lazy"><div><div class="step-name">${esc(talentName(n))}</div><div class="step-tree">${treeName(n.treeName)}</div></div><span class="rank">${n.rank}/${n.max} <small>+1</small></span></div>`).join('')}</details>`;
  }).join('')}${sourceNote()}</section></div>`;
}
async function share() {
  const url = new URL(shareURL(),location.href).href;
  try { await navigator.clipboard.writeText(url); notify(t('copied')); }
  catch { const input = document.createElement('input'); input.value = url; input.className = 'share-fallback'; input.setAttribute('aria-label',t('linkLabel')); $('#detailBody').prepend(input); input.select(); notify(t('copyFallback')); }
}
function renderSources() {
  $('#sourceDialog').innerHTML = `<button class="close source-close" aria-label="${t('close')}">×</button><div class="eyebrow gold">FOREVER ATLAS</div><h2 id="sourcesTitle">${t('sourceTitle')}</h2><p>${t('sourceIntro')}</p><div class="notice">${t('sourceSnapshot')}</div><p>${t('sourceRules')}</p><p>${t('sourceTranslation')}</p><a class="source-item" href="https://wowforeverbuilder.com/builds/" target="_blank" rel="noopener"><b>WoW Forever Builder ↗</b><span>${t('sourceBuilds')}</span></a><a class="source-item" href="https://talentsforever.com/data.json" target="_blank" rel="noopener"><b>Talents Forever · CC BY 4.0 ↗</b><span>${t('sourceTalents')}</span></a><a class="source-item" href="https://wowforeverbuilder.com/wallpapers/" target="_blank" rel="noopener"><b>Blizzard Entertainment ↗</b><span>${t('sourceArtwork')}</span></a><a href="talents.json" download class="button secondary">${t('download')} ↓</a>`;
  $('.source-close').onclick = () => $('#sourceDialog').close();
}
function readHash() {
  const params = new URLSearchParams(location.hash.slice(1));
  if (params.has('build')) { if (params.has('v') && params.get('v') !== '1') { notify(t('invalidLink')); openBuild(params.get('build'),null,true); return; } openBuild(params.get('build'),params.has('o') ? params.get('o') : null,true); }
  else if ($('#buildDialog').open) $('#buildDialog').close();
}
$('#buildDialog').addEventListener('close',() => { hideTooltip(); if (current) edits.set(current.id,[...order]); current = null; if (new URLSearchParams(location.hash.slice(1)).has('build')) history.replaceState(null,'',location.pathname+location.search); if (returnFocus?.isConnected) returnFocus.focus(); });
$('#buildDialog').addEventListener('cancel',event => { if (tooltipId) { event.preventDefault(); hideTooltip(); } });
$('#buildDialog').addEventListener('scroll',() => { if (tooltipId && !pinnedTooltip) hideTooltip(); else positionTooltip(); }); window.addEventListener('resize',positionTooltip);
[$('#buildDialog'),$('#sourceDialog')].forEach(dialog => dialog.addEventListener('click',event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } }));
['sources','footerSources','dataInfo'].forEach(id => { $('#'+id).onclick = () => { renderSources(); $('#sourceDialog').showModal(); }; });
$('#browse').onclick = () => { state.favorites = false; render(); }; $('#favorites').onclick = () => { state.favorites = true; render(); $('#catalog').scrollIntoView({behavior:'smooth'}); };
$$('[data-mode]').forEach(el => { el.onclick = () => { state.mode = el.dataset.mode; render(); }; }); $('#role').onchange = event => { state.role = event.target.value; render(); }; $('#search').oninput = event => { state.query = event.target.value; render(); }; $('#reset').onclick = resetFilters;
$('.brand').onclick = event => { event.preventDefault(); state.favorites = false; resetFilters(); window.scrollTo({top:0,behavior:'smooth'}); };
document.addEventListener('keydown',event => { if (event.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName) && !$('dialog[open]')) { event.preventDefault(); $('#search').focus(); } if (event.key === 'Escape' && tooltipId) { event.preventDefault(); event.stopPropagation(); hideTooltip(); } });
window.addEventListener('hashchange',readHash); applyLanguage(); render(); readHash();
