// Run after editing talents.json or talent-name-overrides.json. No network requests.
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'talents.json'), 'utf8'));
const overrides = JSON.parse(fs.readFileSync(path.join(root, 'talent-name-overrides.json'), 'utf8'));
for (const cls of Object.values(data.classes)) for (const tree of cls.trees) for (const node of tree.nodes) {
  if (overrides[node.name]) node.nameRu = overrides[node.name];
}
fs.writeFileSync(path.join(root, 'talents.json'), JSON.stringify(data, null, 2) + '\n');
fs.writeFileSync(path.join(root, 'talents.js'), 'globalThis.ATLAS_TALENTS = ' + JSON.stringify(data) + ';\n');
