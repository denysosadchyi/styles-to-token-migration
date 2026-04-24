# Міграція компонента на семантичні токени — покроковий процес

---

## Загальна схема pipeline

```
Figma ComponentSet
       │
       ▼
[ Плагін Component → YAML ]
       │  сканує структуру, кольори, варіанти
       ▼
components/[component].yaml
       │
       ▼
[ LLM (Claude / GPT / …) ]
       │  аналізує YAML, підбирає токени
       ▼
token_map заповнений + apply-скрипт
       │
       ▼
[ Figma Scripter → apply-[component].js ]
       │  виділи ComponentSet → Run
       ▼
Figma Variables прив'язані до компонента ✅
```

---

## Підготовка (один раз на проект)

**1. Переконатись що Variables у Figma є**

```
Figma → Assets панель → Local variables
```

Мають бути дві колекції: **Primitives** і **Tokens**.

**2. Якщо колекцій немає — залити через Scripter**

```
Scripter → відкрити scripter/create-variables.js → Run
```

Скрипт не потребує нічого виділяти. Він читає вбудовані в сам скрипт об'єкти `PRIMS` і `TOKENS` (які відповідають твоєму `primitives.css` і `tokens.css`) і створює обидві колекції. Займає ~5 секунд.

> Якщо пізніше в `tokens.css` з'являться нові токени — оновити `TOKENS` у скрипті і перезапустити `create-variables.js`. Існуючі змінні не дублюються (upsert по імені).

---

## Крок 1 — Отримати YAML через плагін

1. Відкрити сторінку з потрібним компонентом
2. Запустити **Plugins → Development → Component → YAML**
3. Натиснути **Сканувати сторінку**
4. Знайти потрібний компонент у списку → натиснути **↓** (скачати один файл)
5. Покласти файл у папку `components/` свого проекту

> Можна скачати **.zip** і розпакувати все одразу.

---

## Крок 2 — Заповнити `token_map` через LLM

Відкрити YAML у LLM-асистенті (Claude Code, Cursor, ChatGPT) і написати:

```
Подивися на [component].yaml і заповни token_map.
Контекст: tokens/tokens.css + scripter/create-variables.js.
```

LLM:
- Прочитає структуру вузлів і кольорові підказки `# rgb(...)`
- Порівняє з токенами в `tokens.css` / `create-variables.js`
- Заповнить `token_map` відповідними назвами токенів
- Додасть нові токени в `missing_tokens` якщо потрібно

### Приклад заповненого token_map для Button

```yaml
token_map:
  Blue:
    Default:
      bg:   "Action/primary/bg-default"
      text: "Action/primary/text-default"
      icon: "Action/primary/icon-default"
    Hover Active:
      bg:   "Action/primary/bg-hover"
    Disabled:
      bg:   "Action/primary/bg-default"    # opacity:0.5 на root
      text: "Action/primary/text-default"
  Line blue:
    Default:
      bg:     "Action/ghost/bg-default"
      border: "Action/ghost/border-default"
      text:   "Action/ghost/text-default"
```

---

## Крок 3 — Додати відсутні токени (якщо є)

Якщо у `missing_tokens` є записи:

1. Відкрити `tokens/tokens.css`
2. Додати нові токени у відповідну секцію з коментарем

```css
/* ----------------------------------------------------------
   ACTION — Ghost
---------------------------------------------------------- */
--color-action-ghost-border-default: var(--color-blue-200);
/* Рамка у спокійному стані — ніжна синя. */
```

3. Додати ті самі токени в `scripter/create-variables.js` (об'єкт `TOKENS`)
4. Запустити `create-variables.js` у Scripter — нові токени потраплять у Figma

> Без цього кроку apply-скрипт виведе попередження і пропустить цей вузол.

---

## Крок 4 — Отримати apply-скрипт

Написати LLM:

```
Зроби apply-скрипт для компонента [назва].
Правила — у docs/06-apply-script-rules.md.
Шаблон — у scripter/apply-button-tokens.example.js.
```

LLM згенерує `scripter/apply-[component]-tokens.js`.

### Що робить apply-скрипт

```javascript
// 1. Знаходить ComponentSet — з поточного виділення у Figma
var cs = figma.currentPage.selection[0];

// 2. Перебирає всі варіанти (COMPONENT)
cs.children.forEach(function(variant) {
  var Color = variant.variantProperties['Color'];
  var State = variant.variantProperties['State'];

  // 3. Знаходить потрібні вузли (bg, border, text, icon)
  // 4. Видаляє Paint Styles (styleId = '')
  // 5. Прив'язує Figma Variable через setBoundVariableForPaint()
});
```

---

## Крок 5 — Запустити apply-скрипт у Figma

1. Відкрити **Scripter** у Figma
2. Вставити вміст `apply-[component]-tokens.js`
3. Виділити потрібний ComponentSet (або будь-який його дочірній варіант)
4. Натиснути **Run**
5. Переглянути консоль Scripter:

```
✓ Color=Blue / State=Default      text×1  icon×1
✓ Color=Blue / State=Hover Active text×1  icon×1
...
─────────────────────────
Оброблено: 12
Помилок:   0
```

---

## Крок 6 — Перевірка результату

**Візуальна перевірка:**
- Пройтись по варіантах компонента, перевірити кольори
- Особлива увага: Hover, Disabled, Error-стани

**Перевірка Variables:**
- Виділити будь-який варіант
- Відкрити **Design** панель → Fill / Stroke
- Замість hex-кольору має бути іконка змінної і назва токена

**Тест перемикання теми:**
- Якщо є dark mode — перемкнути mode у Variables Panel
- Всі прив'язані шари мають адаптуватись автоматично

---

## Правила маппінгу токенів

### Семантика важливіша за колір

```
rgb(59,130,246) на bg кнопки          →  Action/primary/bg-default
rgb(59,130,246) на рамці outlined     →  Action/ghost/border-default
rgb(59,130,246) на тексті посилання   →  Global/text/brand
```

### Немає токена = додати, не пропускати

Якщо для конкретного кольору в `tokens.css` немає відповідного токена — додати у `missing_tokens` у YAML, потім додати в CSS.

### Icon без окремого токена

Якщо для іконки немає свого токена — використовувати `text`-токен тієї ж групи:

```
Action/ghost не має icon-токена  →  використовувати Action/ghost/text-default
```

### Disabled через opacity — ті самі токени

Якщо в `quirks` є `"opacity: 0.5 на root"` — apply-скрипт застосовує ті самі токени що й Default. Не змінює opacity.

---

## Часті помилки

| Ситуація | Причина | Рішення |
|----------|---------|---------|
| Border зник після скрипта | bg/border прив'язувались до root, а вони на дочірньому FRAME | Перевірити `structure.node` у YAML |
| Посилання стало сірим | Скрипт застосував `text`-токен до всіх TEXT включно з link | Додати окрему гілку для link-вузлів |
| "Змінну не знайдено" | Токен є в `token_map` але відсутній у Figma Variables | Оновити `create-variables.js` і запустити ще раз |
| Скрипт пише "not a ComponentSet" | Виділено не ComponentSet | Виділити сам ComponentSet, не варіант |

---

## Що НЕ робить скрипт

- Не змінює `opacity` — тільки кольори
- Не змінює `strokeWeight`, `fontSize`, `cornerRadius`
- Не прив'язує токени напряму до Primitives (тільки до Tokens-колекції)
- Не торкається вузлів без відповідної ролі у `token_map`
