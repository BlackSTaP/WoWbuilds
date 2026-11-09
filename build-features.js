'use strict';
let personalStore, personalRecords = [], activeSavedId = null, personalReadFailed = false, featureReturnFocus, shareName = '';
function classChoicesHTML() {
  return `<div class="creator-class-grid">${Object.keys(CLASSES).map(id => `<button class="creator-class" data-new-class="${id}" style="--class-accent:${CLASSES[id][2]}" aria-label="${esc(t('newClassBuild',{name:className(id)}))}"><img src="${classIcon(id)}" alt=""><span><strong>${className(id)}</strong><small>${TALENTS.classes[id].trees.map(tree => treeName(tree.name)).join(' · ')}</small></span><b aria-hidden="true">↗</b></button>`).join('')}</div>`;
}
function bindClassChoices(container) {
  container.querySelectorAll('[data-new-class]').forEach(button => { button.onclick = () => {
    const picker = $('#classPicker'), origin = picker.open ? featureReturnFocus : document.activeElement;
    if (picker.open) picker.close();
    openBuild(`custom-${button.dataset.newClass}`,'',false,null,t('newClassBuild',{name:className(button.dataset.newClass)}));
    returnFocus = origin;
  }; });
}
function showClassPicker() {
  featureReturnFocus = document.activeElement;
  const picker = $('#classPicker');
  picker.innerHTML = `<div class="personal-dialog-head"><div><div class="eyebrow gold">${t('blankPoints')}</div><h2 id="classPickerTitle">${t('classPickerTitle')}</h2></div><button id="closeClassPicker" class="close" aria-label="${t('close')}">×</button></div><p class="creator-intro">${t('startFirstHelp')}</p>${classChoicesHTML()}<p class="creator-footnote">${t('linkWorkflow')}</p>`;
  $('#closeClassPicker').onclick = () => picker.close(); bindClassChoices(picker); picker.showModal();
}
function buildLink(base, points, name = '') {
  const params = new URLSearchParams({build:base.id,v:'1',o:E.encode(nodesFor(base.classId),points)});
  if (name.trim()) params.set('n',name.trim().slice(0,60));
  return new URL(`${location.pathname}${location.search}#${params}`,location.href).href;
}
function initBuildFeatures() {
  try { personalStore = SavedBuilds.create(localStorage,ALL_BASES,nodesFor,E); refreshPersonal(); }
  catch { personalReadFailed = true; }
  $('#createBuild').onclick = $('#heroCreateBuild').onclick = showClassPicker;
  $('#classPicker').addEventListener('close',() => { if (!$('#buildDialog').open) featureReturnFocus?.isConnected && featureReturnFocus.focus(); });
  $('#myBuilds').onclick = () => { state.mine = true; state.favorites = false; resetFilters(); $('#catalog').scrollIntoView({behavior:'smooth'}); };
  $('#saveDialog').addEventListener('close',() => { featureReturnFocus?.isConnected && featureReturnFocus.focus(); });
  window.addEventListener('storage',event => { if (event.key === SavedBuilds.KEY) { refreshPersonal(); render(); } });
}
function refreshPersonal() {
  try { personalRecords = personalStore.list(); personalReadFailed = false; }
  catch { personalReadFailed = true; }
}
function personalError(error) { return t(error.message === 'limit' ? 'personalLimit' : error.message === 'missing' ? 'personalMissing' : 'personalFailure'); }
function currentSaved() { return personalRecords.find(r => r.id === activeSavedId); }
function showSaveBuild(record = null, copy = false) {
  hideTooltip(); featureReturnFocus = document.activeElement;
  const existing = record || currentSaved(), base = record ? findBuild(record.baseId) : current;
  const capturedOrder = record ? [...record.order] : [...order];
  const dialog = $('#saveDialog');
  dialog.innerHTML = `<form id="saveBuildForm"><div class="personal-dialog-head"><h2 id="saveBuildTitle">${t('buildLinkTitle')}</h2><button type="button" id="cancelSave" class="close" aria-label="${t('close')}">×</button></div><p>${t('portableLinkHelp')}</p><label for="buildName">${t('buildName')}</label><input id="buildName" maxlength="60" required autocomplete="off" value="${esc(existing?.name || shareName || specName(base))}"><label class="link-label" for="generatedBuildLink">${t('linkLabel')}</label><input id="generatedBuildLink" readonly type="url"><button class="button copy-build-link" id="copyBuildLink" type="button">${t('copyBuildLink')}</button><p id="saveError" role="status"></p><div class="personal-dialog-actions"><button class="button secondary" type="submit">${t(existing && !copy ? 'updateBuild' : 'keepLink')}</button>${existing && !copy ? `<button class="button secondary" id="saveCopy" type="button">${t('saveCopy')}</button>` : ''}</div><small class="local-link-note">${t('localOnly')}</small></form>`;
  const updateLink = () => { $('#generatedBuildLink').value = buildLink(base,capturedOrder,$('#buildName').value); };
  $('#buildName').oninput = updateLink; updateLink();
  $('#copyBuildLink').onclick = async () => {
    const label = $('#buildName').value.trim();
    if (!record && current) { shareName = label; activeSavedId = existing && label === existing.name ? existing.id : null; writeHash(); $('#detailTitle').textContent = label || specName(base); }
    try { await navigator.clipboard.writeText($('#generatedBuildLink').value); $('#saveError').textContent = t('copied'); }
    catch { $('#generatedBuildLink').focus(); $('#generatedBuildLink').select(); $('#saveError').textContent = t('copyFallback'); }
  };
  const save = asCopy => {
    const input = $('#buildName'); input.value = input.value.trim(); if (!input.reportValidity()) return;
    try {
      const saved = personalStore.save({name:input.value,baseId:base.id,order:capturedOrder},existing && !asCopy ? existing.id : null);
      refreshPersonal(); if (current && !record) { activeSavedId = saved.id; shareName = saved.name; writeHash(); }
      dialog.close(); render(); if (current) renderDetail(); notify(t('personalSaved'));
    } catch(error) { $('#saveError').textContent = personalError(error); }
  };
  $('#cancelSave').onclick = () => dialog.close();
  $('#saveBuildForm').onsubmit = event => { event.preventDefault(); save(copy); };
  if ($('#saveCopy')) $('#saveCopy').onclick = () => save(true);
  dialog.showModal(); $('#buildName').focus(); $('#buildName').select();
}
function renderPersonalCatalog() {
  refreshPersonal();
  const q = state.query.trim().toLocaleLowerCase();
  const records = personalRecords.filter(r => {
    const b = findBuild(r.baseId), nodes = nodesFor(b.classId), selected = new Set(r.order);
    return (state.classId === 'all' || b.classId === state.classId) && (state.mode === 'all' || b.mode === state.mode) && (state.role === 'all' || b.role === state.role) && (!q || [r.name,...CLASSES[b.classId],b.spec,treeName(b.spec),...nodes.filter(n => selected.has(n.id)).flatMap(n => [n.name,n.nameRu])].join(' ').toLocaleLowerCase().includes(q));
  });
  $('#catalogTitle').textContent = `${t('myBuilds')} · ${records.length}`;
  $('#catalogOverline').textContent = t('yourWorkshop');
  $('#resultLabel').textContent = t('personalIntro');
  $('#builds').innerHTML = `<div class="personal-tools"><span class="personal-storage-note">${t('personalStorage')}</span><details class="backup-menu"><summary>${t('transferBuilds')} <span aria-hidden="true">⌄</span></summary><div class="backup-panel"><button class="button secondary" id="exportBuilds" ${!personalRecords.length || personalReadFailed ? 'disabled' : ''}>${t('exportBuilds')}</button><label class="button secondary file-button">${t('importBuilds')}<input id="importBuilds" type="file" accept="application/json,.json"></label></div></details><span id="personalMessage" role="status">${personalReadFailed ? t('personalFailure') : ''}</span></div>` + (records.length ? records.map(r => {
    const b = findBuild(r.baseId), split = E.totals(nodesFor(b.classId),E.ranks(r.order)).join('/');
    return `<article class="build-card personal-card" style="--accent:${CLASSES[b.classId][2]}"><a class="card-open" data-personal="${r.id}" href="${esc(buildLink(b,r.order,r.name))}"><div class="card-top"><img class="class-icon" src="${classIcon(b.classId)}" alt=""><div><div class="card-class">${className(b.classId)}</div><div class="card-role">${b.custom ? t("fromScratch") : `${specName(b)} · ${t(b.mode)}`}</div></div></div><h3>${esc(r.name)}</h3><div class="card-bottom"><span>${r.order.length}/51 ${t('points')}</span><span class="allocation">${split}</span></div></a><div class="personal-card-actions"><button data-rename="${r.id}">${t('linkAndName')}</button><button data-copy="${r.id}">${t('duplicate')}</button><button data-delete="${r.id}">${t('deleteBuild')}</button></div></article>`;
  }).join('') : personalRecords.length ? `<div class="empty"><h3>${t('empty')}</h3><p>${t('emptyHelp')}</p><button id="clearPersonalFilters">${t('resetFilters')}</button></div>` : `<section class="create-empty"><div class="create-empty-heading"><span class="create-emblem" aria-hidden="true">✧</span><div><h3>${t('startFirstBuild')}</h3><p>${t('startFirstHelp')}</p></div></div>${classChoicesHTML()}<div class="create-empty-footer"><span>${t('linkWorkflow')}</span><button id="choosePreset">${t('orChoosePreset')} ↗</button></div></section>`);
  $$('[data-personal]').forEach(el => { el.onclick = event => { if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; event.preventDefault(); const r = personalRecords.find(r => r.id === el.dataset.personal); openBuild(r.baseId,E.encode(nodesFor(findBuild(r.baseId).classId),r.order),false,r.id,r.name); }; });
  $$('[data-rename]').forEach(el => { el.onclick = () => showSaveBuild(personalRecords.find(r => r.id === el.dataset.rename)); });
  $$('[data-copy]').forEach(el => { el.onclick = () => showSaveBuild(personalRecords.find(r => r.id === el.dataset.copy),true); });
  $$('[data-delete]').forEach(el => { el.onclick = () => deletePersonal(el.dataset.delete); });
  bindClassChoices($('#builds'));
  if ($('#clearPersonalFilters')) $('#clearPersonalFilters').onclick = resetFilters;
  if ($('#choosePreset')) $('#choosePreset').onclick = () => { state.mine = false; resetFilters(); };
  $('#exportBuilds').onclick = () => {
    try { const url = URL.createObjectURL(new Blob([personalStore.exportFile()],{type:'application/json'})); const a = document.createElement('a'); a.href = url; a.download = 'forever-atlas-builds.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000); }
    catch(error) { notify(personalError(error)); }
  };
  $('#importBuilds').onchange = async event => {
    const file = event.target.files[0]; if (!file) return;
    try { if (file.size > SavedBuilds.MAX_BYTES) throw Error('invalid'); const added = personalStore.importFile(await file.text()); refreshPersonal(); render(); $('#personalMessage').textContent = t('imported',{n:added}); }
    catch { $('#personalMessage').textContent = t('importFailed'); }
    finally { event.target.value = ''; }
  };
}
function deletePersonal(id) {
  const r = personalRecords.find(r => r.id === id); featureReturnFocus = document.activeElement;
  const dialog = $('#saveDialog');
  dialog.innerHTML = `<div class="personal-dialog-head"><h2 id="saveBuildTitle">${t('deleteBuild')}?</h2></div><p>${esc(r.name)}</p><div class="personal-dialog-actions"><button id="confirmDelete" class="button">${t('deleteBuild')}</button><button id="cancelDelete" class="button secondary">${t('cancel')}</button></div><p id="saveError" role="alert"></p>`;
  $('#cancelDelete').onclick = () => dialog.close();
  $('#confirmDelete').onclick = () => { try { personalStore.remove(id); refreshPersonal(); if (activeSavedId === id) activeSavedId = null; dialog.close(); render(); notify(t('personalDeleted')); } catch(error) { $('#saveError').textContent = personalError(error); } };
  dialog.showModal(); $('#cancelDelete').focus();
}
function clearDependencies() { $$('.dependency-focus,.dependency-parent,.dependency-child,.dependency-missing,.dependency-edge,.dependency-rows').forEach(el => el.classList.remove('dependency-focus','dependency-parent','dependency-child','dependency-missing','dependency-edge','dependency-rows')); }
function dependencyInfo(id) {
  const nodes = nodesFor(current.classId), allocation = E.ranks(order), node = nodes.find(n => n.id === id);
  const parents = [], descendants = [], edges = new Set(), seen = new Set([id]);
  let cursor = node;
  while (cursor?.requires && !seen.has(cursor.requires)) { edges.add(cursor.id); seen.add(cursor.requires); cursor = nodes.find(n => n.id === cursor.requires); if (cursor) parents.push(cursor); }
  const visit = parent => { for (const child of nodes.filter(n => n.requires === parent)) { if (seen.has(child.id)) continue; seen.add(child.id); descendants.push(child); edges.add(child.id); visit(child.id); } }; visit(id);
  const below = nodes.filter(n => n.treeIndex === node.treeIndex && n.row < node.row).reduce((sum,n) => sum+(allocation[n.id] || 0),0);
  return {node,parents,descendants,edges,allocation,missing:Math.max(0,node.row*5-below)};
}
function highlightDependencies(id) {
  clearDependencies(); const info = dependencyInfo(id);
  $(`[data-node="${id}"]`)?.classList.add('dependency-focus');
  for (const n of info.parents) { const el = $(`[data-node="${n.id}"]`); el?.classList.add('dependency-parent'); if ((info.allocation[n.id] || 0)<n.max) el?.classList.add('dependency-missing'); }
  for (const n of info.descendants) $(`[data-node="${n.id}"]`)?.classList.add('dependency-child');
  for (const id of info.edges) $(`[data-edge="${id}"]`)?.classList.add('dependency-edge');
  if (info.missing) $$('[data-node]').forEach(el => { const n = nodesFor(current.classId).find(n => n.id === el.dataset.node); if (n.treeIndex === info.node.treeIndex && n.row < info.node.row) el.classList.add('dependency-rows'); });
}
function dependencyHTML(id) {
  const info = dependencyInfo(id);
  const missingParents = info.parents.filter(n => (info.allocation[n.id] || 0)<n.max);
  return `<div class="dependency-explanation">${info.missing ? `<p>${t('needMorePoints',{n:info.missing})}</p>` : ''}${missingParents.map(n => `<p>${t('needMoreRanks',{name:esc(talentName(n)),n:n.max-(info.allocation[n.id] || 0)})}</p>`).join('')}${info.parents.length || info.descendants.length ? `<small>${t('dependencyLegend')}</small>` : ''}</div>`;
}
function guideHTML() {
  const guide = window.ATLAS_GUIDES[current.id], nodes = nodesFor(current.classId), allocation = E.ranks(order), preset = E.fromBuild(nodes,current).order;
  const changed = E.encode(nodes,preset) !== E.encode(nodes,order);
  const highlights = nodes.filter(n => n.max === 1 && allocation[n.id]).sort((a,b) => b.row-a.row).slice(0,6);
  const equipment = window.ATLAS_EQUIPMENT[current.role === 'Tank' ? 'Tank' : current.role === 'Healer' ? 'Healer' : ['mage','warlock','priest'].includes(current.classId) || ['Elemental','Balance'].includes(current.spec) ? 'Caster' : current.classId === 'hunter' ? 'Hunter' : 'Melee'][language];
  return `<div class="guide-layout"><section class="guide-card"><div class="eyebrow gold">${className(current.classId)} · ${specName(current)}</div><h3>${t('guidePurpose')}</h3><p>${t(current.mode === 'Leveling' ? 'guideLeveling' : current.mode === 'PvP' ? 'guidePvp' : current.role === 'Tank' ? 'tankDesc' : current.role === 'Healer' ? 'healDesc' : 'damageDesc')}</p>${changed ? `<p class="notice">${t('guideChanged')}</p>` : ''}<h3>${t('guideRotation')}</h3><ol>${guide[language].map(line => `<li>${esc(line)}</li>`).join('')}</ol><h3>${t('guideEquipment')}</h3><p>${esc(equipment)}</p><small>${t('guideEquipmentNote')}</small><p class="source-note"><a href="${esc(guide.source)}" target="_blank" rel="noopener">${t('guideSource')} ↗</a> · 08.11.2026</p></section><section class="guide-card"><h3>${t('guideTalents')}</h3><p class="guide-caption">${t('guideTalentsNote')}</p>${highlights.length ? highlights.map(n => `<details class="guide-talent"><summary><img src="${n.icon}" alt=""><span>${esc(talentName(n))}<small>${esc(language === 'ru' ? n.name : n.nameRu)}</small></span><b>+</b></summary><p>${esc(n.descriptions[language][allocation[n.id]-1])}</p></details>`).join('') : `<p>${t('guideNoTalents')}</p>`}</section></div>`;
}
