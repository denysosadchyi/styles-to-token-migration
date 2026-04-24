// ============================================================
//  Component → YAML  |  Figma Plugin
//  Сканує поточну сторінку, генерує YAML для кожного
//  ComponentSet і відправляє масив файлів у UI.
// ============================================================

figma.showUI(__html__, { width: 500, height: 580, title: 'Component → YAML' });

figma.ui.onmessage = function (msg) {
  if (!msg || !msg.type) return;
  if (msg.type === 'scan')  runScan();
  if (msg.type === 'close') figma.closePlugin();
};

// ----------------------------------------------------------
//  Сканування сторінки
// ----------------------------------------------------------
function runScan() {
  try {
    var componentSets = figma.currentPage.findAll(function (n) {
      return n.type === 'COMPONENT_SET';
    });

    if (!componentSets.length) {
      return figma.ui.postMessage({
        type: 'error',
        message: 'На поточній сторінці не знайдено жодного ComponentSet.'
      });
    }

    var files       = [];
    var errors      = [];
    var usedNames   = {};   // для запобігання колізій імен файлів

    for (var i = 0; i < componentSets.length; i++) {
      var cs = componentSets[i];
      try {
        var yaml     = generateYaml(cs);
        var baseName = (cs.name || 'component-' + i)
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9\-_]/g, '');
        if (!baseName) baseName = 'component-' + i;

        // Запобігання колізіям
        var fileName = baseName + '.yaml';
        if (usedNames[fileName]) {
          usedNames[fileName]++;
          fileName = baseName + '-' + usedNames[fileName] + '.yaml';
        } else {
          usedNames[fileName] = 1;
        }

        files.push({ name: fileName, content: yaml });
      } catch (e) {
        errors.push({ name: cs.name || ('component-' + i), message: (e && e.message) || String(e) });
      }
    }

    figma.ui.postMessage({
      type: 'result',
      pageName: figma.currentPage.name,
      files: files,
      errors: errors
    });
  } catch (e) {
    figma.ui.postMessage({
      type: 'error',
      message: 'Помилка сканування: ' + ((e && e.message) || String(e))
    });
  }
}

// ----------------------------------------------------------
//  Helpers — кольори
// ----------------------------------------------------------
function getRgba(color, opacity) {
  if (!color || color.r === undefined || color.g === undefined || color.b === undefined) return null;
  var r  = Math.round(color.r * 255);
  var g  = Math.round(color.g * 255);
  var b  = Math.round(color.b * 255);
  var a  = (opacity !== undefined) ? opacity : (color.a !== undefined ? color.a : 1);
  var aR = Math.round(a * 100) / 100;
  return aR === 1
    ? 'rgb(' + r + ',' + g + ',' + b + ')'
    : 'rgba(' + r + ',' + g + ',' + b + ',' + aR + ')';
}

function solidColor(paints) {
  if (!paints || paints === figma.mixed) return null;
  for (var i = 0; i < paints.length; i++) {
    var p = paints[i];
    if (p.type === 'SOLID' && p.visible !== false) {
      var c = getRgba(p.color, p.opacity);
      if (c) return c;
    }
  }
  return null;
}

function hasFill(n) {
  return !!solidColor('fills' in n ? n.fills : null);
}
function hasStroke(n) {
  return !!solidColor('strokes' in n ? n.strokes : null);
}

function hasUnboundStroke(n) {
  if (!('strokes' in n) || !n.strokes || n.strokes === figma.mixed) return false;
  for (var i = 0; i < n.strokes.length; i++) {
    var s = n.strokes[i];
    if (s.type === 'SOLID' && s.visible !== false && !(s.boundVariables && s.boundVariables.color)) return true;
  }
  return false;
}

// ----------------------------------------------------------
//  findFirstVector — рекурсивно по всьому піддереву
//  Зупиняється на INSTANCE (не заходить глибше у вкладені компоненти)
// ----------------------------------------------------------
function findFirstVector(node) {
  if (node.type === 'VECTOR') return node;
  if (node.type === 'INSTANCE') {
    // Шукаємо тільки в прямих дітях instance (не рекурсивно далі)
    if ('children' in node) {
      for (var i = 0; i < node.children.length; i++) {
        var v = findVectorDeep(node.children[i]);
        if (v) return v;
      }
    }
    return null;
  }
  if ('children' in node) {
    for (var j = 0; j < node.children.length; j++) {
      var found = findFirstVector(node.children[j]);
      if (found) return found;
    }
  }
  return null;
}

// Рекурсивно шукає VECTOR у піддереві (без зупинки на INSTANCE)
function findVectorDeep(node) {
  if (node.type === 'VECTOR') return node;
  if ('children' in node) {
    for (var i = 0; i < node.children.length; i++) {
      var v = findVectorDeep(node.children[i]);
      if (v) return v;
    }
  }
  return null;
}

// ----------------------------------------------------------
//  findPaintFrame — знайти головний "контейнер з фарбою"
//  серед прямих дітей вузла.
//  Пріоритет: FRAME зі stroke (інтерактивний елемент)
//           > FRAME з fill тільки
//  Якщо серед прямих дітей нічого — перевіряємо дітей
//  першого FRAME/GROUP дитини (wrapper-патерн).
// ----------------------------------------------------------
function findPaintFrame(node) {
  if (!('children' in node)) return null;

  var fillOnly = null;

  // Рівень 1: прямі діти
  for (var i = 0; i < node.children.length; i++) {
    var ch = node.children[i];
    if (ch.type !== 'FRAME' && ch.type !== 'RECTANGLE') continue;
    if (hasStroke(ch)) return ch;                          // є stroke → це головний контейнер
    if (!fillOnly && hasFill(ch)) fillOnly = ch;
  }
  if (fillOnly) return fillOnly;

  // Рівень 2: діти першого FRAME/GROUP (wrapper-патерн: COMPONENT > FRAME wrapper > FRAME field)
  for (var j = 0; j < node.children.length; j++) {
    var wrapper = node.children[j];
    if (wrapper.type !== 'FRAME' && wrapper.type !== 'GROUP') continue;
    if (!('children' in wrapper)) continue;
    for (var k = 0; k < wrapper.children.length; k++) {
      var gc = wrapper.children[k];
      if (gc.type !== 'FRAME' && gc.type !== 'RECTANGLE') continue;
      if (hasStroke(gc)) return gc;
      if (!fillOnly && hasFill(gc)) fillOnly = gc;
    }
  }
  return fillOnly;
}

// ----------------------------------------------------------
//  walkStructure — рекурсивний обхід для збору TEXT і INSTANCE>VECTOR
//  Зупиняється на INSTANCE, дедуплікує по імені.
// ----------------------------------------------------------
function walkStructure(node, out, seen, depth) {
  if (depth > 8) return;

  if (node.type === 'TEXT') {
    if (hasFill(node) && !seen[node.name + '_text']) {
      out.push({ node: node.name, type: 'TEXT', roles: [{ role: 'text', paint: 'fill' }] });
      seen[node.name + '_text'] = true;
    }
    return;
  }

  if (node.type === 'INSTANCE') {
    if (!seen[node.name + '_icon']) {
      var vec = findFirstVector(node);
      if (vec) {
        var paint = hasStroke(vec) ? 'stroke' : 'fill';
        out.push({ node: node.name, type: 'INSTANCE > VECTOR', roles: [{ role: 'icon', paint: paint }] });
        seen[node.name + '_icon'] = true;
      }
    }
    return;
  }

  if (node.type === 'VECTOR') {
    if (!seen[node.name + '_icon']) {
      var p = hasStroke(node) ? 'stroke' : 'fill';
      out.push({ node: node.name, type: 'VECTOR', roles: [{ role: 'icon', paint: p }] });
      seen[node.name + '_icon'] = true;
    }
    return;
  }

  if ('children' in node) {
    for (var i = 0; i < node.children.length; i++) {
      walkStructure(node.children[i], out, seen, depth + 1);
    }
  }
}

// ----------------------------------------------------------
//  analyzeStructure — де знаходяться bg, border, text, icon
// ----------------------------------------------------------
function analyzeStructure(componentSet) {
  if (!componentSet.children || !componentSet.children.length) return [];
  var first     = componentSet.children[0];
  var structure = [];

  // ── colorKey: 'Color' або перший variant-вимір ────────────
  var firstVp  = first.variantProperties || {};
  var vpKeys   = Object.keys(firstVp);
  var colorKey = firstVp['Color'] !== undefined ? 'Color' : (vpKeys[0] || 'Color');

  // ── Перевірити ROOT на stroke в усіх варіантах ────────────
  // (потрібно для умови "Color in [Line gray, Line blue]")
  var allColorValues = {}, rootStrokeByColor = {};
  for (var i = 0; i < componentSet.children.length; i++) {
    var v = componentSet.children[i], vp = v.variantProperties;
    if (!vp) continue;
    var c = vp[colorKey];
    if (c) {
      allColorValues[c] = true;
      if (hasStroke(v)) rootStrokeByColor[c] = true;
    }
  }
  var rootStrokeKeys = Object.keys(rootStrokeByColor);

  // ── Знайти bgNode і borderNode ────────────────────────────
  var bgNode     = hasFill(first)              ? first : null;
  var borderNode = rootStrokeKeys.length > 0   ? first : null;

  // Якщо чогось немає — шукаємо в дочірніх frame першого варіанту
  if (!bgNode || !borderNode) {
    var pf = findPaintFrame(first);
    if (pf) {
      if (!bgNode     && hasFill(pf))   bgNode     = pf;
      if (!borderNode && hasStroke(pf)) borderNode = pf;
    }
  }

  // Якщо border ще не знайдено — сканувати ВСІ варіанти
  // (наприклад, Default не має stroke, але Error — має)
  if (!borderNode) {
    outer: for (var vi = 0; vi < componentSet.children.length; vi++) {
      var variantI = componentSet.children[vi];
      if (!('children' in variantI)) continue;
      for (var ci = 0; ci < variantI.children.length; ci++) {
        var cand = variantI.children[ci];
        if ((cand.type === 'FRAME' || cand.type === 'RECTANGLE') && hasStroke(cand)) {
          borderNode = cand;
          break outer;
        }
        // Рівень 2 (wrapper)
        if ((cand.type === 'FRAME' || cand.type === 'GROUP') && 'children' in cand) {
          for (var ci2 = 0; ci2 < cand.children.length; ci2++) {
            var cand2 = cand.children[ci2];
            if ((cand2.type === 'FRAME' || cand2.type === 'RECTANGLE') && hasStroke(cand2)) {
              borderNode = cand2;
              break outer;
            }
          }
        }
      }
    }
  }

  // Якщо є border але немає bg — беремо той самий вузол
  if (!bgNode && borderNode) bgNode = borderNode;

  // ── Генерувати записи структури ───────────────────────────
  function entryFor(node, roles) {
    var isRoot = (node === first);
    return {
      node:  isRoot ? 'root' : node.name,
      type:  isRoot ? 'COMPONENT' : node.type,
      roles: roles
    };
  }

  if (bgNode || borderNode) {
    var sameNode = (bgNode && borderNode && bgNode === borderNode);

    if (sameNode) {
      var isRoot = (bgNode === first);
      var roles  = [];
      roles.push({ role: 'bg', paint: 'fill' });
      var bRole = { role: 'border', paint: 'stroke' };
      // Умова (тільки для root і тільки якщо border є не у всіх color-значень)
      if (isRoot && rootStrokeKeys.length && rootStrokeKeys.length < Object.keys(allColorValues).length) {
        bRole.condition = colorKey + ' in [' + rootStrokeKeys.join(', ') + ']';
      }
      roles.push(bRole);
      structure.push(entryFor(bgNode, roles));
    } else {
      if (bgNode)     structure.push(entryFor(bgNode,     [{ role: 'bg',     paint: 'fill'   }]));
      if (borderNode) structure.push(entryFor(borderNode, [{ role: 'border', paint: 'stroke' }]));
    }
  }

  // ── Зібрати TEXT і INSTANCE>VECTOR з УСІХ варіантів ──────
  // Сканування всіх варіантів ловить вузли, що є тільки
  // в деяких станах (наприклад, helper text тільки в Error).
  var seen = {};
  for (var vj = 0; vj < componentSet.children.length; vj++) {
    var variantJ = componentSet.children[vj];
    if (!('children' in variantJ)) continue;
    for (var j = 0; j < variantJ.children.length; j++) {
      walkStructure(variantJ.children[j], structure, seen, 0);
    }
  }

  return structure;
}

// ----------------------------------------------------------
//  detectQuirks
// ----------------------------------------------------------
function detectQuirks(componentSet) {
  var quirks      = [];
  var byGroup     = {};
  var hasColorDim = false;

  for (var i = 0; i < componentSet.children.length; i++) {
    var v = componentSet.children[i], vp = v.variantProperties;
    if (!vp || !vp['State']) continue;
    if (vp['Color']) hasColorDim = true;
    var groupKey = vp['Color'] || '__all__';
    if (!byGroup[groupKey]) byGroup[groupKey] = {};
    byGroup[groupKey][vp['State']] = v;
  }

  var foundOpacity = false;
  for (var group in byGroup) {
    if (!Object.prototype.hasOwnProperty.call(byGroup, group)) continue;
    var def = byGroup[group]['Default'];
    var dis = byGroup[group]['Disabled'];
    if (!def || !dis) continue;

    var label = hasColorDim ? group : '';

    if (!foundOpacity && dis.opacity !== undefined && dis.opacity < 1) {
      quirks.push('State=Disabled → opacity: 0.5 на root — скрипт не чіпає opacity');
      foundOpacity = true;
    }

    var defBg  = solidColor(def.fills);
    var disBg  = solidColor(dis.fills);
    var prefix = label ? label + ' ' : '';
    if (defBg && disBg && defBg !== disBg) {
      quirks.push(prefix + 'Disabled → власна палітра (bg відрізняється від Default)');
    } else if (dis.opacity !== undefined && dis.opacity < 1) {
      quirks.push(prefix + 'Disabled → bg збігається з Default, opacity:0.5 забезпечує ефект');
    }
  }

  // Перевірка незв'язаних stroke на root варіантах
  var hasUnbound = false;
  for (var j = 0; j < componentSet.children.length; j++) {
    if (hasUnboundStroke(componentSet.children[j])) { hasUnbound = true; break; }
  }
  if (hasUnbound) quirks.push('border не має boundVar — setBoundVariable виконується вперше');

  return quirks;
}

// ----------------------------------------------------------
//  extractColors — рекурсивно збирає кольори з вузла
// ----------------------------------------------------------
function extractColors(node, entry, depth) {
  if (depth > 6) return;

  if (node.type === 'TEXT') {
    if (hasFill(node) && !entry.text) entry.text = solidColor(node.fills);
    return;
  }

  if (node.type === 'INSTANCE') {
    if (!entry.icon) {
      var vec = findFirstVector(node);
      if (vec) entry.icon = hasStroke(vec) ? solidColor(vec.strokes) : solidColor(vec.fills);
    }
    return;
  }

  if (node.type === 'VECTOR') {
    if (!entry.icon) entry.icon = hasStroke(node) ? solidColor(node.strokes) : solidColor(node.fills);
    return;
  }

  if ('children' in node) {
    if (hasFill(node)   && !entry.bg)     entry.bg     = solidColor(node.fills);
    if (hasStroke(node) && !entry.border) entry.border = solidColor(node.strokes);
    for (var j = 0; j < node.children.length; j++) {
      extractColors(node.children[j], entry, depth + 1);
    }
  }
}

// ----------------------------------------------------------
//  buildTokenMapData — збирає кольори для token_map
// ----------------------------------------------------------
function buildTokenMapData(componentSet, variantKeys) {
  var hasColor = variantKeys.indexOf('Color') !== -1;
  var hasState = variantKeys.indexOf('State') !== -1;
  var nested   = hasColor && hasState;

  var data = {};

  for (var i = 0; i < componentSet.children.length; i++) {
    var variant = componentSet.children[i];
    var vp = variant.variantProperties;
    if (!vp) continue;

    var entry = {};

    // 1. Спочатку root
    if (hasFill(variant))   entry.bg     = solidColor(variant.fills);
    if (hasStroke(variant)) entry.border = solidColor(variant.strokes);

    // 2. Якщо чогось не знайдено — шукаємо в головному paint-frame
    //    Пріоритет: frame зі stroke > frame з fill
    if (!entry.bg || !entry.border) {
      var pf = findPaintFrame(variant);
      if (pf) {
        if (!entry.bg     && hasFill(pf))   entry.bg     = solidColor(pf.fills);
        if (!entry.border && hasStroke(pf)) entry.border = solidColor(pf.strokes);
      }
    }

    // 3. Рекурсивно — підбираємо text і icon (і bg/border якщо ще не знайдено)
    if ('children' in variant) {
      for (var j = 0; j < variant.children.length; j++) {
        extractColors(variant.children[j], entry, 0);
      }
    }

    // Записуємо
    if (nested) {
      var outer = vp['Color'], inner = vp['State'];
      if (!outer || !inner) continue;
      if (!data[outer])         data[outer]         = {};
      if (!data[outer][inner])  data[outer][inner]  = entry;
    } else {
      var key = hasState ? vp['State'] : vp[variantKeys[0]];
      if (!key) continue;
      if (!data[key]) data[key] = entry;
    }
  }

  return { data: data, nested: nested };
}

// ----------------------------------------------------------
//  YAML-утиліти
// ----------------------------------------------------------
function escYaml(s) {
  return String(s)
    .replace(/\\/g,  '\\\\')
    .replace(/"/g,   '\\"')
    .replace(/\n/g,  '\\n')
    .replace(/\r/g,  '\\r')
    .replace(/\t/g,  '\\t');
}
function yamlKey(s) {
  if (/[:#\[\]{}&*!|>'",%@`]/.test(s) || /^\s|\s$/.test(s) || s === '') {
    return '"' + escYaml(s) + '"';
  }
  return s;
}

// ----------------------------------------------------------
//  generateYaml
// ----------------------------------------------------------
function generateYaml(componentSet) {
  var name = componentSet.name || 'Unknown';
  var defs = componentSet.componentPropertyDefinitions || {};

  var variants    = {};
  var variantKeys = [];
  for (var key in defs) {
    if (!Object.prototype.hasOwnProperty.call(defs, key)) continue;
    var def = defs[key];
    if (def.type === 'VARIANT' && Array.isArray(def.variantOptions) && def.variantOptions.length) {
      var cleanKey = key.replace(/#\d+:\d+$/, '').trim();
      variants[cleanKey]  = def.variantOptions;
      variantKeys.push(cleanKey);
    }
  }

  var structure   = analyzeStructure(componentSet);
  var quirks      = detectQuirks(componentSet);
  var tokenResult = buildTokenMapData(componentSet, variantKeys);
  var tokenData   = tokenResult.data;
  var nested      = tokenResult.nested;

  var L    = [];
  var push = function (s) { L.push(s === undefined ? '' : s); };

  push('# Компонент: ' + name);
  push('# Згенеровано плагіном Component → YAML');
  push();

  push('meta:');
  push('  name: ' + name);
  push('  figma_id: "' + componentSet.id + '"');
  push('  type: COMPONENT_SET');
  push();

  push('variants:');
  for (var vk in variants) {
    if (!Object.prototype.hasOwnProperty.call(variants, vk)) continue;
    push('  ' + yamlKey(vk) + ': [' + variants[vk].join(', ') + ']');
  }
  push();

  push('# role: bg | text | icon | border');
  push('# paint: fill | stroke');
  push('structure:');
  for (var s = 0; s < structure.length; s++) {
    var sn = structure[s];
    push('  - node: "' + escYaml(sn.node) + '"');
    push('    type: ' + sn.type);
    push('    roles:');
    for (var r = 0; r < sn.roles.length; r++) {
      var role = sn.roles[r];
      push('      - role: ' + role.role);
      push('        paint: ' + role.paint);
      if (role.condition) push('        condition: "' + escYaml(role.condition) + '"');
    }
  }
  push();

  if (quirks.length) {
    push('quirks:');
    for (var q = 0; q < quirks.length; q++) push('  - "' + escYaml(quirks[q]) + '"');
    push();
  }

  push('# ' + (nested ? 'Color × State' : 'State') + ' → поточні кольори (підказки). Замінити на назви токенів.');
  push('token_map:');

  if (nested) {
    for (var color in tokenData) {
      if (!Object.prototype.hasOwnProperty.call(tokenData, color)) continue;
      push();
      push('  ' + yamlKey(color) + ':');
      for (var state in tokenData[color]) {
        if (!Object.prototype.hasOwnProperty.call(tokenData[color], state)) continue;
        push('    ' + yamlKey(state) + ':');
        var e = tokenData[color][state];
        if (e.bg     != null) push('      bg:     "TODO"    # ' + e.bg);
        if (e.border != null) push('      border: "TODO"    # ' + e.border);
        if (e.text   != null) push('      text:   "TODO"    # ' + e.text);
        if (e.icon   != null) push('      icon:   "TODO"    # ' + e.icon);
      }
    }
  } else {
    for (var st in tokenData) {
      if (!Object.prototype.hasOwnProperty.call(tokenData, st)) continue;
      push();
      push('  ' + yamlKey(st) + ':');
      var en = tokenData[st];
      if (en.bg     != null) push('    bg:     "TODO"    # ' + en.bg);
      if (en.border != null) push('    border: "TODO"    # ' + en.border);
      if (en.text   != null) push('    text:   "TODO"    # ' + en.text);
      if (en.icon   != null) push('    icon:   "TODO"    # ' + en.icon);
    }
  }
  push();

  push('missing_tokens: []');

  return L.join('\n');
}
