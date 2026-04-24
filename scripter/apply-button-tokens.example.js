// ============================================================
// Apply Button Tokens  (приклад apply-скрипта)
// Запускати через плагін Figma Scripter.
//
// ПЕРЕДУМОВИ:
//   1. scripter/create-variables.js вже виконано — колекції Primitives і Tokens є
//   2. ComponentSet Button присутній на поточній сторінці
//   3. Виділено ComponentSet Button (або будь-який його варіант)
//
// Структура компонента, що очікується (з button.yaml):
//   root            COMPONENT  → fill=bg, stroke=border (тільки ghost/neutral)
//   {icon name}     INSTANCE   → всередині VECTOR: stroke або fill (icon)
//   {text name}     TEXT       → fill=text
//
// Варіанти (приклад):
//   Color: Blue | Light blue | Line blue | Line gray
//   State: Default | Hover Active | Disabled
//   Size:  28 | 36 | 40
//
// Disabled: opacity:0.5 на root виставляється вручну/окремим скриптом.
//           Тут прив'язуємо лише кольори.
// ============================================================

// ----------------------------------------------------------
//  TOKEN_MAP  :  Color → State → {bg, border, text, icon}
//  border = null  → рамки немає (solid buttons)
//  Назви точно відповідають змінним у колекції "Tokens".
// ----------------------------------------------------------
var TOKEN_MAP = {

  'Blue': {
    'Default': {
      bg:     'Action/primary/bg-default',
      border: null,
      text:   'Action/primary/text-default',
      icon:   'Action/primary/icon-default'
    },
    'Hover Active': {
      bg:     'Action/primary/bg-hover',
      border: null,
      text:   'Action/primary/text-default',
      icon:   'Action/primary/icon-default'
    },
    'Disabled': {
      bg:     'Action/primary/bg-disabled',
      border: null,
      text:   'Action/primary/text-disabled',
      icon:   'Action/primary/icon-disabled'
    }
  },

  'Light blue': {
    'Default': {
      bg:     'Action/secondary/bg-default',
      border: null,
      text:   'Action/secondary/text-default',
      icon:   'Action/secondary/icon-default'
    },
    'Hover Active': {
      bg:     'Action/secondary/bg-hover',
      border: null,
      text:   'Action/secondary/text-default',
      icon:   'Action/secondary/icon-default'
    },
    'Disabled': {
      bg:     'Action/secondary/bg-disabled',
      border: null,
      text:   'Action/secondary/text-disabled',
      icon:   'Action/secondary/icon-disabled'
    }
  },

  'Line blue': {
    'Default': {
      bg:     'Action/ghost/bg-default',
      border: 'Action/ghost/border-default',
      text:   'Action/ghost/text-default',
      icon:   'Action/ghost/icon-default'
    },
    'Hover Active': {
      bg:     'Action/ghost/bg-hover',
      border: 'Action/ghost/border-hover',
      text:   'Action/ghost/text-hover',
      icon:   'Action/ghost/icon-default'
    },
    'Disabled': {
      bg:     'Action/ghost/bg-default',
      border: 'Action/ghost/border-disabled',
      text:   'Action/ghost/text-disabled',
      icon:   'Action/ghost/icon-disabled'
    }
  },

  'Line gray': {
    'Default': {
      bg:     'Action/neutral/bg-default',
      border: 'Action/neutral/border-default',
      text:   'Action/neutral/text-default',
      icon:   'Action/neutral/icon-default'
    },
    'Hover Active': {
      bg:     'Action/neutral/bg-hover',
      border: 'Action/neutral/border-hover',
      text:   'Action/neutral/text-default',
      icon:   'Action/neutral/icon-default'
    },
    'Disabled': {
      bg:     'Action/neutral/bg-disabled',
      border: 'Action/neutral/border-disabled',
      text:   'Action/neutral/text-disabled',
      icon:   'Action/neutral/icon-disabled'
    }
  }

};

// ----------------------------------------------------------
//  Утиліти
// ----------------------------------------------------------

// Рекурсивно знайти перший вузол з потрібним типом
function findFirst(node, type) {
  if (node.type === type) return node;
  if (!node.children) return null;
  for (var i = 0; i < node.children.length; i++) {
    var found = findFirst(node.children[i], type);
    if (found) return found;
  }
  return null;
}

// Рекурсивно зібрати всі вузли з потрібним типом
function findAll(node, type, result) {
  if (!result) result = [];
  if (node.type === type) result.push(node);
  if (node.children) {
    for (var i = 0; i < node.children.length; i++) {
      findAll(node.children[i], type, result);
    }
  }
  return result;
}

// Рекурсивно знайти вузол за типом і умовою на ім'я
function findFirstWhere(node, type, nameFn) {
  if (node.type === type && nameFn(node.name)) return node;
  if (!node.children) return null;
  for (var i = 0; i < node.children.length; i++) {
    var found = findFirstWhere(node.children[i], type, nameFn);
    if (found) return found;
  }
  return null;
}

// Видалити стиль і прив'язати змінну до fill
function bindFill(node, variable) {
  node.fillStyleId = '';
  var paint = figma.variables.setBoundVariableForPaint(
    { type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 1, visible: true },
    'color',
    variable
  );
  node.fills = [paint];
}

// Видалити стиль і прив'язати змінну до stroke
function bindStroke(node, variable) {
  node.strokeStyleId = '';
  var paint = figma.variables.setBoundVariableForPaint(
    { type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 1, visible: true },
    'color',
    variable
  );
  node.strokes = [paint];
}

// ----------------------------------------------------------
//  Main
// ----------------------------------------------------------
async function main() {
  console.log('▶ Apply Button Tokens...\n');

  // ── 1. Індекс змінних (з колекції "Tokens") ─────────────
  var allVars = figma.variables.getLocalVariables('COLOR');
  var varByName = {};
  allVars.forEach(function(v) { varByName[v.name] = v; });

  // Перевірка що потрібні змінні є
  var sampleKey = 'Action/primary/bg-default';
  if (!varByName[sampleKey]) {
    figma.notify('❌ Змінна "' + sampleKey + '" не знайдена. Спочатку запусти create-variables.js');
    return;
  }

  // ── 2. Знайти ComponentSet — з виділення ─────────────────
  var sel = figma.currentPage.selection;
  if (!sel || sel.length === 0) {
    figma.notify('❌ Виділи ComponentSet Button і запусти знову');
    return;
  }

  var cs = sel[0];
  // Якщо виділено варіант — підніматись до батька
  if (cs.type === 'COMPONENT' && cs.parent && cs.parent.type === 'COMPONENT_SET') {
    cs = cs.parent;
  }
  if (cs.type !== 'COMPONENT_SET') {
    figma.notify('❌ Виділений вузол не є ComponentSet (тип: ' + cs.type + ')');
    return;
  }
  console.log('  Button знайдено у виділенні: id=' + cs.id + ' name=' + cs.name);

  // ── 3. Обробити варіанти ─────────────────────────────────
  var applied = 0, skipped = 0;
  var errors  = [];

  cs.children.forEach(function(variant) {
    if (variant.type !== 'COMPONENT') return;

    var props = variant.variantProperties;
    var color = props['Color'];
    var state = props['State'];
    var size  = props['Size'];

    var label = color + ' / ' + state + ' / ' + size;

    // Отримати токени для цієї комбінації
    if (!TOKEN_MAP[color] || !TOKEN_MAP[color][state]) {
      console.warn('  ⚠ Немає токенів для: ' + label);
      skipped++;
      return;
    }
    var t = TOKEN_MAP[color][state];

    try {
      // ── root: bg (fill) ──────────────────────────────────
      var bgVar = varByName[t.bg];
      if (!bgVar) throw new Error('Змінна не знайдена: ' + t.bg);
      bindFill(variant, bgVar);

      // ── root: border (stroke) — тільки коли не null ───────
      if (t.border) {
        var borderVar = varByName[t.border];
        if (!borderVar) throw new Error('Змінна не знайдена: ' + t.border);
        bindStroke(variant, borderVar);
      } else {
        // Очистити stroke — щоб solid-варіанти не тримали старі рамки
        variant.strokeStyleId = '';
        variant.strokes = [];
      }

      // ── text node: fill (рекурсивний пошук) ─────────────
      // Адаптуй предикат під назви TEXT-вузлів у своєму компоненті.
      var textNode = findFirstWhere(variant, 'TEXT', function(n) {
        return true;  // бере будь-який TEXT — підкоригуй якщо є service-написи
      });
      if (textNode) {
        var textVar = varByName[t.text];
        if (!textVar) throw new Error('Змінна не знайдена: ' + t.text);
        bindFill(textNode, textVar);
      } else {
        console.warn('  ⚠ Не знайдено текстовий вузол у: ' + label);
      }

      // ── icon: всі VECTOR-и в усьому варіанті ────────────────
      // Border — на COMPONENT-вузлі (variant), не на VECTOR-ах,
      // тому всі VECTOR-и = частини іконок.
      var iconVar = varByName[t.icon];
      if (!iconVar) throw new Error('Змінна не знайдена: ' + t.icon);
      var allVectors = findAll(variant, 'VECTOR');
      var iconCount = 0;
      allVectors.forEach(function(vec) {
        if (vec.strokes && vec.strokes.length > 0) { bindStroke(vec, iconVar); iconCount++; }
        if (vec.fills   && vec.fills.length   > 0) { bindFill(vec, iconVar);   iconCount++; }
      });
      if (iconCount === 0) {
        console.warn('  ⚠ Icon vectors не знайдено у: ' + label);
      }

      console.log('  ✓ ' + label);
      applied++;

    } catch (e) {
      var msg = (e && e.message) ? e.message : String(e);
      console.error('  ✗ ' + label + ' → ' + msg);
      errors.push(label + ': ' + msg);
    }
  });

  // ── 4. Підсумок ──────────────────────────────────────────
  console.log('\n─────────────────────────');
  console.log('Оброблено: ' + applied);
  console.log('Пропущено: ' + skipped);
  console.log('Помилок:   ' + errors.length);
  if (errors.length) {
    console.log('\nПомилки:');
    errors.forEach(function(e) { console.log('  ' + e); });
  }

  if (errors.length === 0) {
    figma.notify('✅ Button: ' + applied + ' варіантів — токени прив\'язано');
  } else {
    figma.notify('⚠️ Button: ' + applied + ' ок, ' + errors.length + ' помилок — дивись консоль');
  }
}

main();
