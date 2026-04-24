// ============================================================
// Create Figma Variables — Primitives + Semantic Tokens
// Запускати через плагін Figma Scripter.
//
// Що робить:
//   1. Колекція "Primitives" — усі базові кольори (hex → Color)
//   2. Колекція "Tokens"     — семантичні токени (alias → primitive)
//
// Логіка: upsert (оновлює якщо вже є, створює якщо немає).
// Усі alias-ланцюги (token → token → primitive) розв'язані
// напряму до примітива для простоти.
//
// ─────────────────────────────────────────────────────────────
// ВАЖЛИВО: адаптуй PRIMS і TOKENS під свій проект.
// Значення повинні відповідати твоїм tokens/primitives.css
// і tokens/tokens.css (див. examples/tokens/).
// ============================================================

// ----------------------------------------------------------
//  Утиліти кольорів
// ----------------------------------------------------------
function hex(h) {
  h = h.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
    a: 1
  };
}
function rgba(r, g, b, a) { return { r: r / 255, g: g / 255, b: b / 255, a: a }; }
var TRANSPARENT = { r: 0, g: 0, b: 0, a: 0 };

// ----------------------------------------------------------
//  PRIMITIVES  (ПРИКЛАД — заміни на свою палітру)
//  Назва → RGB значення
// ----------------------------------------------------------
var PRIMS = {

  // ── Brand (example: indigo-like scale) ────────────────────
  'Blue/50':  hex('#EFF6FF'),
  'Blue/100': hex('#DBEAFE'),
  'Blue/200': hex('#BFDBFE'),
  'Blue/300': hex('#93C5FD'),
  'Blue/400': hex('#60A5FA'),
  'Blue/500': hex('#3B82F6'),
  'Blue/600': hex('#2563EB'),
  'Blue/700': hex('#1D4ED8'),
  'Blue/800': hex('#1E40AF'),
  'Blue/900': hex('#1E3A8A'),

  // ── Neutral ───────────────────────────────────────────────
  'Neutral/Black': hex('#000000'),
  'Neutral/White': hex('#FFFFFF'),

  // ── Gray (text / UI) ──────────────────────────────────────
  'Gray/50':  hex('#F9FAFB'),
  'Gray/100': hex('#F3F4F6'),
  'Gray/200': hex('#E5E7EB'),
  'Gray/300': hex('#D1D5DB'),
  'Gray/400': hex('#9CA3AF'),
  'Gray/500': hex('#6B7280'),
  'Gray/600': hex('#4B5563'),
  'Gray/700': hex('#374151'),
  'Gray/800': hex('#1F2937'),
  'Gray/900': hex('#111827'),

  // ── System / Red ──────────────────────────────────────────
  'System/Red/50':  hex('#FEF2F2'),
  'System/Red/100': hex('#FEE2E2'),
  'System/Red/500': hex('#EF4444'),
  'System/Red/600': hex('#DC2626'),
  'System/Red/700': hex('#B91C1C'),

  // ── System / Amber ────────────────────────────────────────
  'System/Amber/50':  hex('#FFFBEB'),
  'System/Amber/100': hex('#FEF3C7'),
  'System/Amber/500': hex('#F59E0B'),
  'System/Amber/600': hex('#D97706'),

  // ── System / Green ────────────────────────────────────────
  'System/Green/50':  hex('#F0FDF4'),
  'System/Green/100': hex('#DCFCE7'),
  'System/Green/500': hex('#22C55E'),
  'System/Green/600': hex('#16A34A'),

  // ── Shadow ────────────────────────────────────────────────
  'Shadow/sm': rgba(0, 0, 0, 0.05),
  'Shadow/md': rgba(0, 0, 0, 0.10),
  'Shadow/lg': rgba(0, 0, 0, 0.15)
};

// ----------------------------------------------------------
//  TOKENS  (ПРИКЛАД — заміни на свою семантику)
//  Назва → ключ примітива (або null для transparent)
// ----------------------------------------------------------
var TOKENS = {

  // ── Global / Background ───────────────────────────────────
  'Global/bg/page':         'Gray/50',
  'Global/bg/default':      'Neutral/White',
  'Global/bg/subtle':       'Gray/100',
  'Global/bg/muted':        'Gray/200',
  'Global/bg/inverse':      'Gray/900',
  'Global/bg/overlay':      'Gray/800',
  'Global/bg/brand':        'Blue/500',
  'Global/bg/brand-subtle': 'Blue/50',

  // ── Global / Text ─────────────────────────────────────────
  'Global/text/primary':   'Gray/900',
  'Global/text/secondary': 'Gray/600',
  'Global/text/tertiary':  'Gray/400',
  'Global/text/disabled':  'Gray/300',
  'Global/text/inverse':   'Neutral/White',
  'Global/text/brand':     'Blue/600',
  'Global/text/on-brand':  'Neutral/White',

  // ── Global / Icon ─────────────────────────────────────────
  'Global/icon/primary':   'Gray/900',
  'Global/icon/secondary': 'Gray/500',
  'Global/icon/disabled':  'Gray/300',
  'Global/icon/inverse':   'Neutral/White',
  'Global/icon/brand':     'Blue/600',

  // ── Global / Border ───────────────────────────────────────
  'Global/border/subtle':   'Gray/100',
  'Global/border/default':  'Gray/200',
  'Global/border/strong':   'Gray/300',
  'Global/border/brand':    'Blue/500',
  'Global/border/disabled': 'Gray/200',
  'Global/border/focus':    'Blue/500',

  // ── Feedback / Error ──────────────────────────────────────
  'Feedback/error/bg':       'System/Red/100',
  'Feedback/error/bg-solid': 'System/Red/500',
  'Feedback/error/text':     'System/Red/600',
  'Feedback/error/border':   'System/Red/500',
  'Feedback/error/icon':     'System/Red/500',

  // ── Feedback / Warning ────────────────────────────────────
  'Feedback/warning/bg':       'System/Amber/100',
  'Feedback/warning/bg-solid': 'System/Amber/500',
  'Feedback/warning/text':     'System/Amber/600',
  'Feedback/warning/border':   'System/Amber/500',
  'Feedback/warning/icon':     'System/Amber/500',

  // ── Feedback / Success ────────────────────────────────────
  'Feedback/success/bg':       'System/Green/100',
  'Feedback/success/bg-solid': 'System/Green/500',
  'Feedback/success/text':     'System/Green/600',
  'Feedback/success/border':   'System/Green/500',
  'Feedback/success/icon':     'System/Green/500',

  // ── Feedback / Info ───────────────────────────────────────
  'Feedback/info/bg':       'Blue/100',
  'Feedback/info/bg-solid': 'Blue/500',
  'Feedback/info/text':     'Blue/600',
  'Feedback/info/border':   'Blue/500',
  'Feedback/info/icon':     'Blue/500',

  // ── Action / Primary ──────────────────────────────────────
  // Example: solid brand button.
  'Action/primary/bg-default':    'Blue/500',
  'Action/primary/bg-hover':      'Blue/600',
  'Action/primary/bg-active':     'Blue/700',
  'Action/primary/bg-disabled':   'Blue/500',
  'Action/primary/text-default':  'Neutral/White',
  'Action/primary/text-disabled': 'Neutral/White',
  'Action/primary/icon-default':  'Neutral/White',
  'Action/primary/icon-disabled': 'Neutral/White',

  // ── Action / Secondary ────────────────────────────────────
  // Example: soft-tinted button, no border.
  'Action/secondary/bg-default':    'Blue/50',
  'Action/secondary/bg-hover':      'Blue/100',
  'Action/secondary/bg-active':     'Blue/200',
  'Action/secondary/bg-disabled':   'Blue/50',
  'Action/secondary/text-default':  'Blue/700',
  'Action/secondary/text-disabled': 'Blue/700',
  'Action/secondary/icon-default':  'Blue/700',
  'Action/secondary/icon-disabled': 'Blue/700',

  // ── Action / Ghost ────────────────────────────────────────
  // Example: outlined button with brand border.
  'Action/ghost/bg-default':      'Neutral/White',
  'Action/ghost/bg-hover':        'Blue/50',
  'Action/ghost/bg-active':       'Blue/100',
  'Action/ghost/border-default':  'Blue/300',
  'Action/ghost/border-hover':    'Blue/500',
  'Action/ghost/border-disabled': 'Blue/200',
  'Action/ghost/text-default':    'Gray/900',
  'Action/ghost/text-hover':      'Gray/900',
  'Action/ghost/text-disabled':   'Gray/400',
  'Action/ghost/icon-default':    'Gray/900',
  'Action/ghost/icon-disabled':   'Gray/400',

  // ── Action / Neutral ──────────────────────────────────────
  // Example: outlined button with neutral border.
  'Action/neutral/bg-default':      'Neutral/White',
  'Action/neutral/bg-hover':        'Gray/50',
  'Action/neutral/bg-active':       'Gray/100',
  'Action/neutral/bg-disabled':     'Neutral/White',
  'Action/neutral/border-default':  'Gray/300',
  'Action/neutral/border-hover':    'Gray/400',
  'Action/neutral/border-disabled': 'Gray/200',
  'Action/neutral/text-default':    'Gray/900',
  'Action/neutral/text-disabled':   'Gray/400',
  'Action/neutral/icon-default':    'Gray/900',
  'Action/neutral/icon-disabled':   'Gray/400',

  // ── Action / Danger ───────────────────────────────────────
  'Action/danger/bg-default':    'System/Red/500',
  'Action/danger/bg-hover':      'System/Red/600',
  'Action/danger/bg-active':     'System/Red/700',
  'Action/danger/bg-disabled':   'Gray/200',
  'Action/danger/text-default':  'Neutral/White',
  'Action/danger/text-disabled': 'Gray/400',
  'Action/danger/border-default':'System/Red/500',

  // ── Control / Field ───────────────────────────────────────
  // Input, Textarea, Dropdown, Search, DatePicker, etc.
  'Control/field/bg-default':       'Neutral/White',
  'Control/field/bg-disabled':      'Gray/50',
  'Control/field/border-default':   'Gray/200',
  'Control/field/border-hover':     'Gray/400',
  'Control/field/border-focus':     'Blue/500',
  'Control/field/border-error':     'System/Red/500',
  'Control/field/border-disabled':  'Gray/200',
  'Control/field/text-default':     'Gray/900',
  'Control/field/text-placeholder': 'Gray/400',
  'Control/field/text-disabled':    'Gray/400',
  'Control/field/icon-default':     'Gray/500',
  'Control/field/icon-active':      'Blue/500',
  'Control/field/icon-disabled':    'Gray/300',

  // ── Control / Checkbox ────────────────────────────────────
  'Control/checkbox/bg-default':     'Neutral/White',
  'Control/checkbox/border-default': 'Gray/300',
  'Control/checkbox/bg-checked':     'Blue/500',
  'Control/checkbox/border-checked': 'Blue/500',
  'Control/checkbox/icon':           'Neutral/White',

  // ── Selection ─────────────────────────────────────────────
  // ListItem, Cell, Tab, Sidebar MenuItem
  'Selection/bg-default':      null,           // transparent
  'Selection/bg-hover':        'Gray/50',
  'Selection/bg-active':       'Gray/100',
  'Selection/bg-selected':     'Blue/50',
  'Selection/text-default':    'Gray/900',
  'Selection/text-selected':   'Blue/600',
  'Selection/border-selected': 'Blue/500',
  'Selection/icon-selected':   'Blue/500'
};

// ----------------------------------------------------------
//  Upsert: знайти або створити змінну, встановити значення
// ----------------------------------------------------------
function upsertVar(name, collId, modeId, value, existingByName) {
  var v = existingByName[name];
  if (!v) {
    v = figma.variables.createVariable(name, collId, 'COLOR');
  }
  v.setValueForMode(modeId, value);
  return v;
}

// ----------------------------------------------------------
//  Main
// ----------------------------------------------------------
async function main() {
  console.log('▶ Creating Variables (Primitives + Tokens)...\n');

  // ── 1. Primitives ────────────────────────────────────────
  var allColls = figma.variables.getLocalVariableCollections();

  var primColl = allColls.find(function(c) { return c.name === 'Primitives'; });
  if (!primColl) {
    primColl = figma.variables.createVariableCollection('Primitives');
    console.log('  Created collection: Primitives');
  } else {
    console.log('  Using existing collection: Primitives');
  }
  primColl.renameMode(primColl.modes[0].modeId, 'Value');
  var primModeId = primColl.modes[0].modeId;

  // Індекс існуючих
  var allVars = figma.variables.getLocalVariables();
  var primExisting = {};
  allVars.filter(function(v) {
    return v.variableCollectionId === primColl.id && v.resolvedType === 'COLOR';
  }).forEach(function(v) { primExisting[v.name] = v; });

  // Upsert примітивів
  var primMap = {}; // name → Variable (для alias токенів)
  var primNew = 0, primUpdated = 0;
  for (var pName in PRIMS) {
    var existed = !!primExisting[pName];
    primMap[pName] = upsertVar(pName, primColl.id, primModeId, PRIMS[pName], primExisting);
    existed ? primUpdated++ : primNew++;
  }
  console.log('  Primitives: ' + primNew + ' created, ' + primUpdated + ' updated');

  // ── 2. Tokens ────────────────────────────────────────────
  var tokColl = allColls.find(function(c) { return c.name === 'Tokens'; });
  if (!tokColl) {
    tokColl = figma.variables.createVariableCollection('Tokens');
    console.log('  Created collection: Tokens');
  } else {
    console.log('  Using existing collection: Tokens');
  }
  tokColl.renameMode(tokColl.modes[0].modeId, 'Value');
  var tokModeId = tokColl.modes[0].modeId;

  var tokExisting = {};
  figma.variables.getLocalVariables().filter(function(v) {
    return v.variableCollectionId === tokColl.id && v.resolvedType === 'COLOR';
  }).forEach(function(v) { tokExisting[v.name] = v; });

  // Upsert токенів
  var tokNew = 0, tokUpdated = 0, tokErrors = [];
  for (var tName in TOKENS) {
    var primKey = TOKENS[tName];
    var value;
    if (primKey === null) {
      value = TRANSPARENT;
    } else if (primMap[primKey]) {
      value = { type: 'VARIABLE_ALIAS', id: primMap[primKey].id };
    } else {
      tokErrors.push(tName + ' → "' + primKey + '" not found');
      continue;
    }
    var texisted = !!tokExisting[tName];
    upsertVar(tName, tokColl.id, tokModeId, value, tokExisting);
    texisted ? tokUpdated++ : tokNew++;
  }
  console.log('  Tokens: ' + tokNew + ' created, ' + tokUpdated + ' updated');

  if (tokErrors.length) {
    console.warn('\n  ⚠ Unresolved token references:');
    tokErrors.forEach(function(e) { console.warn('    ' + e); });
  }

  var summary = (primNew + primUpdated) + ' primitives + ' + (tokNew + tokUpdated) + ' tokens';
  console.log('\n▶ Done! ' + summary);
  figma.notify('✅ Variables ready: ' + summary);
}

main().catch(function(err) {
  var msg = (err && err.message) || String(err);
  console.error('❌ ' + msg);
  figma.notify('❌ Error: ' + msg, { error: true });
});
