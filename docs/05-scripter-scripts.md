# Figma Scripter — довідник скриптів

Всі скрипти запускаються через плагін **Scripter** у Figma.
Встановлення Scripter: `Plugins → Browse plugins → "Scripter"`.

---

## Як запустити скрипт

1. Відкрити **Scripter** (`Plugins → Scripter`)
2. Вставити вміст потрібного `.js` файлу в редактор
3. Виконати попередні умови (виділення, якщо потрібно)
4. Натиснути **▶ Run** або `Cmd/Ctrl + Enter`
5. Результат — у консолі Scripter і/або у `figma.notify` (нотифікація у Figma)

---

## `create-variables.js`

**Файл:** `scripter/create-variables.js`
**Виділення:** не потрібно
**Запускати:** один раз на проект + після додавання нових токенів у `tokens.css`

### Що робить

Створює дві колекції у Figma Variables:

- **Primitives** — сирі кольори (`Blue/500 = #3B82F6`)
- **Tokens** — semantic aliases: `Action/primary/bg-default` → `Primitives/Blue/500`

Якщо змінна вже існує → **оновлює значення** (upsert по імені). Якщо примітив для токена не знайдено → виводить попередження у консоль.

### Налаштування під свій проект

У скрипті є два об'єкти:

```javascript
var PRIMS = {
  'Blue/500': hex('#3B82F6'),
  // ...додати свої примітиви
};

var TOKENS = {
  'Action/primary/bg-default': 'Blue/500',
  // ...додати свої токени
};
```

Скопіюй значення зі своїх `primitives.css` і `tokens.css` у ці об'єкти. Якщо токен `null` — створюється transparent-змінна.

### Перевірка результату

```
Figma → Assets → Local variables
```

Мають з'явитись дві колекції з відповідною кількістю змінних.

---

## `apply-[component]-tokens.js`

**Файл:** `scripter/apply-[component]-tokens.js`
**Виділення:** ComponentSet потрібного компонента (або будь-який його варіант)
**Джерело:** `components/[component].yaml`

### Правило виділення

Всі apply-скрипти підтримують два варіанти виділення:
- Виділено **ComponentSet** → скрипт працює з ним напряму
- Виділено **COMPONENT** (варіант) → скрипт автоматично підіймається до батьківського ComponentSet

```javascript
var cs = sel[0];
if (cs.type === 'COMPONENT' && cs.parent && cs.parent.type === 'COMPONENT_SET') {
  cs = cs.parent;
}
```

### Структура apply-скрипта

```javascript
// 1. Константи
var COMPONENT_NAME = 'ComponentName';

// 2. TOKEN_MAP — з token_map у YAML
var TOKEN_MAP = { /* ... */ };

// 3. Утиліти: bindFill, bindStroke, findAll, findFirstWhere, ...

// 4. main()
async function main() {
  // Завантажити Variables
  var allVars = figma.variables.getLocalVariables('COLOR');
  var varByName = {};
  allVars.forEach(function(v) { varByName[v.name] = v; });

  // Отримати ComponentSet з виділення
  var cs = figma.currentPage.selection[0];

  // Перебрати варіанти і прив'язати токени
  cs.children.forEach(function(variant) {
    var tokens = TOKEN_MAP[variant.variantProperties['State']];
    // bindFill(node, variable)
    // bindStroke(node, variable)
  });
}

main();
```

Повноцінний шаблон з усіма утилітами і обробкою країв — у [`scripter/apply-button-tokens.example.js`](../scripter/apply-button-tokens.example.js).

Правила написання нових apply-скриптів (з реальних багів) — у [06-apply-script-rules.md](06-apply-script-rules.md).

---

## Написання нового apply-скрипта через LLM

Попросити LLM:

```
Зроби apply-скрипт для компонента [назва].
Правила у docs/06-apply-script-rules.md.
YAML у components/[назва].yaml.
Шаблон у scripter/apply-button-tokens.example.js.
```

LLM прочитає YAML і згенерує скрипт за шаблоном.

---

## Часті помилки у Scripter

| Помилка | Причина | Рішення |
|---------|---------|---------|
| `❌ Змінні не знайдені` | Variables не створені у Figma | Запустити `create-variables.js` |
| `❌ Виділи ComponentSet` | Нічого не виділено | Виділити компонент перед запуском |
| `❌ не є ComponentSet` | Виділено FRAME або GROUP | Виділити саме ComponentSet |
| `Не знайдено: Token/name` | Токен є в скрипті, але відсутній у Figma Variables | Перевірити назву; оновити `create-variables.js` і перезапустити |
| Консоль порожня | Скрипт не запустився | Перевірити синтаксис; Scripter показує помилку вгорі |
