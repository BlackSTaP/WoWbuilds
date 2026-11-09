/* Empty class builds have their own stable IDs, independent of curated presets. */
(function(root) {
  'use strict';
  function create(presets, classes) {
    return [...presets,...Object.keys(classes).map(classId => ({
      id:`custom-${classId}`,classId,custom:true,mode:'Custom',role:'Custom',spec:'Custom',
      allocation:'0/0/0',order:[],source:'https://talentsforever.com/'
    }))];
  }
  const api={create};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  root.BuildCatalog=api;
})(globalThis);
