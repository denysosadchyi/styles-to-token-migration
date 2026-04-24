# Правила написання apply-скриптів

Цей документ — обов'язковий стандарт для будь-якого нового `apply-*.js` скрипта.
Базується на реальних багах, знайдених під час розробки.

---

## Структура скрипта

```
1. TOKEN_MAP        — таблиця токенів з YAML
2. Утиліти          — findFirst / findAll / findFirstWhere / bindFill / bindStroke
3. main()
   3.1 Індекс змінних
   3.2 Отримати ComponentSet із виділення
   3.3 Перебрати варіанти → прив'язати токени
   3.4 Підсумок у консоль + figma.notify
```

---

## 1. TOKEN_MAP

Береться із `token_map` у відповідному YAML-файлі.

```javascript
var TOKEN_MAP = {
  'VariantValue': {
    'State': {
      bg:     'Token/name/here',   // або null якщо немає
      border: 'Token/name/here',   // або null якщо немає
      text:   'Token/name/here',
      icon:   'Token/name/here'
    }
  }
};
```

**Правила:**
- Назви ключів — точно як `variantProperties` у Figma (`'Line gray'`, `'Hover Active'` тощо)
- Назви токенів — точно як у колекції `Tokens` у Figma Variables (`'Action/primary/bg-default'`)
- Якщо ролі немає для даного варіанту → `null` (не рядок `'none'`, не `undefined`)

---

## 2. Утиліти — обов'язковий набір

Копіювати в кожен скрипт без змін:

```javascript
// Рекурсивно знайти перший вузол із потрібним типом
function findFirst(node, type) {
  if (node.type === type) return node;
  if (!node.children) return null;
  for (var i = 0; i < node.children.length; i++) {
    var found = findFirst(node.children[i], type);
    if (found) return found;
  }
  return null;
}

// Рекурсивно зібрати ВСІ вузли з потрібним типом
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

// Рекурсивно знайти перший вузол за типом і умовою на ім'я
function findFirstWhere(node, type, nameFn) {
  if (node.type === type && nameFn(node.name)) return node;
  if (!node.children) return null;
  for (var i = 0; i < node.children.length; i++) {
    var found = findFirstWhere(node.children[i], type, nameFn);
    if (found) return found;
  }
  return null;
}

// Прив'язати змінну до fill
function bindFill(node, variable) {
  node.fillStyleId = '';
  var paint = figma.variables.setBoundVariableForPaint(
    { type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 1, visible: true },
    'color',
    variable
  );
  node.fills = [paint];
}

// Прив'язати змінну до stroke
function bindStroke(node, variable) {
  node.strokeStyleId = '';
  var paint = figma.variables.setBoundVariableForPaint(
    { type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 1, visible: true },
    'color',
    variable
  );
  node.strokes = [paint];
}
```

**Чому рекурсія:** вузли можуть бути вкладені в auto-layout фрейми. Пошук лише по прямих дітях (`node.children[i]` без рекурсії) — гарантований баг.

---

## 3. Отримання ComponentSet із виділення

```javascript
var sel = figma.currentPage.selection;
if (!sel || sel.length === 0) {
  figma.notify('❌ Виділи ComponentSet і запусти знову');
  return;
}

var cs = sel[0];
// Автопідйом: якщо виділено варіант — взяти батька
if (cs.type === 'COMPONENT' && cs.parent && cs.parent.type === 'COMPONENT_SET') {
  cs = cs.parent;
}
if (cs.type !== 'COMPONENT_SET') {
  figma.notify('❌ Виділений вузол не є ComponentSet (тип: ' + cs.type + ')');
  return;
}
```

**Правило:** завжди підтримувати обидва сценарії — виділено ComponentSet або один з його варіантів.

---

## 4. Індекс змінних

```javascript
var allVars = figma.variables.getLocalVariables('COLOR');
var varByName = {};
allVars.forEach(function(v) { varByName[v.name] = v; });

// Швидка перевірка що Variables взагалі є
if (!varByName['Action/primary/bg-default']) {
  figma.notify('❌ Змінні не знайдені. Спочатку запусти create-variables.js');
  return;
}
```

---

## 5. Прив'язка по ролях

### bg — завжди fill на root (variant)

```javascript
var bgVar = varByName[t.bg];
if (!bgVar) throw new Error('Змінна не знайдена: ' + t.bg);
bindFill(variant, bgVar);
```

### border — stroke на root, але з обов'язковим очищенням

```javascript
if (t.border) {
  var borderVar = varByName[t.border];
  if (!borderVar) throw new Error('Змінна не знайдена: ' + t.border);
  bindStroke(variant, borderVar);
} else {
  // ОБОВ'ЯЗКОВО очистити — інакше старий stroke залишається
  variant.strokeStyleId = '';
  variant.strokes = [];
}
```

**Чому важливо:** якщо у варіанті Line gray є border, а у Blue — ні, без очищення Blue-варіант залишить сірий border від попереднього стану або іншого варіанту.

### text — fill, рекурсивний пошук

```javascript
var textNode = findFirstWhere(variant, 'TEXT', function(n) {
  return n === 'Exact Node Name';
});
if (textNode) {
  bindFill(textNode, varByName[t.text]);
} else {
  console.warn('  ⚠ Текстовий вузол не знайдено у: ' + label);
}
```

**Правило:** не кидати помилку якщо текст не знайдено — попереджати і продовжувати.

### icon — всі VECTOR-и в усьому варіанті

```javascript
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
```

**Чому весь варіант, а не конкретний instance:**
- Кнопка може мати **дві іконки** (зліва і справа). Пошук за іменем `"account"` знаходить лише першу.
- Кожна іконка складається з **кількох VECTOR-шляхів**. `findFirst` бере лише перший — решта залишається зі старим кольором.
- Пошук по всьому варіанту через `findAll(variant, 'VECTOR')` збирає всі частини всіх іконок за один прохід.

**Чому border не потрапляє в цей список:**
Border — це stroke на COMPONENT-вузлі (`variant`), а не на VECTOR-і. `findAll` збирає лише вузли типу `VECTOR`, тому root не потрапить.

**Чому перевіряємо і fills і strokes на кожному VECTOR:**
Різні шляхи однієї іконки можуть бути пофарбовані по-різному — одні через stroke, інші через fill. Перевіряємо обидва і прив'язуємо туди де є фарба.

---

## 6. Правило Disabled

Якщо у `quirks` YAML є `"opacity: 0.5 на root"` → Disabled реалізований через opacity, а не окремі кольори. У такому випадку:

```javascript
// Варіант А — є dedicated *-disabled токени (перевірити у create-variables.js)
'Disabled': {
  bg:   'Action/primary/bg-disabled',   // той самий колір що Default
  text: 'Action/primary/text-disabled'  // той самий колір що Default
}

// Варіант Б — немає dedicated токенів → використовувати Default
'Disabled': {
  bg:   'Action/primary/bg-default',
  text: 'Action/primary/text-default'
}
```

Перед написанням скрипта перевірити у `create-variables.js` чи є `*-disabled` токени для цього компонента.

---

## 7. Логування

```javascript
// Кожен варіант:
console.log('  ✓ ' + label);   // успіх
console.warn('  ⚠ ' + msg);    // попередження (вузол не знайдено)
console.error('  ✗ ' + msg);   // помилка (токен не знайдено)

// Підсумок:
console.log('Оброблено: ' + applied);
console.log('Пропущено: ' + skipped);
console.log('Помилок:   ' + errors.length);

// Notify у Figma:
figma.notify('✅ ComponentName: ' + applied + ' варіантів — токени прив\'язано');
// або:
figma.notify('⚠️ ComponentName: ' + applied + ' ок, ' + errors.length + ' помилок — дивись консоль');
```

---

## 8. Часті помилки

| Симптом | Причина | Рішення |
|---------|---------|---------|
| Іконка частково змінює колір | `findFirst` замість `findAll` для VECTOR | Замінити на `findAll` + обробляти кожен vec |
| Іконка не змінює колір зовсім | Пошук лише в прямих дітях | Замінити на рекурсивний `findFirstWhere` |
| Border залишається на варіанті без рамки | Немає `strokes = []` у гілці `else` | Додати очищення коли `t.border === null` |
| `⚠ Instance не знайдено` | Ім'я node — `"account (L)"`, а шукаємо `"account"` | Пошук по `indexOf`, не точний збіг |
| `Змінна не знайдена: X` | Токен є у TOKEN_MAP але відсутній у Figma | Запустити `create-variables.js` |
| Скрипт не знаходить ComponentSet | Виділено FRAME або GROUP | Перевірити тип у консолі, виділити правильний вузол |

---

## Чеклист перед написанням скрипта

- [ ] Прочитав `components/[name].yaml` — знаю structure і token_map
- [ ] Перевірив у `create-variables.js` що всі токени є
- [ ] TOKEN_MAP скопійований точно з YAML
- [ ] Для icon використовується `findAll` + перевірка fills/strokes
- [ ] Для border є `else { strokes = [] }` коли null
- [ ] Пошук вузлів — рекурсивний
- [ ] Пошук instance по іконці — по префіксу імені, не точний збіг
