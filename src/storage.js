import { BOONS, instantiateTemplate } from './logic.js';

var RUN_KEY  = 'pick3_run';
var COLL_KEY = 'pick3_collection';

// Build a template map for boon deserialization
var BOON_TEMPLATE_MAP = {};
BOONS.forEach(function(b) { BOON_TEMPLATE_MAP[b.id] = b; });

export function loadRunState() {
  try { var s = localStorage.getItem(RUN_KEY); return s ? JSON.parse(s) : null; }
  catch(e) { return null; }
}
export function saveRunState(state) {
  try { localStorage.setItem(RUN_KEY, JSON.stringify(state)); } catch(e) {}
}
export function clearRunState() {
  try { localStorage.removeItem(RUN_KEY); } catch(e) {}
}
export function loadCollection() {
  try { var s = localStorage.getItem(COLL_KEY); return new Set(s ? JSON.parse(s) : []); }
  catch(e) { return new Set(); }
}
export function saveCollection(col) {
  try { localStorage.setItem(COLL_KEY, JSON.stringify(Array.from(col))); } catch(e) {}
}

// Serialize a boon to plain JSON (strips functions)
export function serializeBoon(b) {
  var out = {};
  Object.keys(b).forEach(function(k) { if (typeof b[k] !== 'function') out[k] = b[k]; });
  return out;
}
// Reconstruct a boon from its serialized form by re-attaching template functions
export function deserializeBoon(saved) {
  if (!saved || !saved.id) return null;
  var tpl = BOON_TEMPLATE_MAP[saved.id];
  if (!tpl) return null;
  var fresh = instantiateTemplate(tpl);
  Object.keys(saved).forEach(function(k) { fresh[k] = saved[k]; });
  return fresh;
}
