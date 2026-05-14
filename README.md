# Styles → Token Migration

Migrates a Figma library from hardcoded Paint Styles to semantic Variables — so that every layer of every component variant is bound to a token, and switching themes happens with a single click in the Variables Panel.

*Українська версія — [нижче](#styles-token-migration-ua).*

---

## What it does

- Scans a ComponentSet in Figma and pulls its structure (colors, variants, layer roles) into a YAML file.
- From the YAML it builds an apply-script that walks every component variant and binds Figma Variables to fills / strokes instead of Paint Styles.
- Keeps a token catalog in two Figma Variables collections: `Primitives` (raw colors) and `Tokens` (semantic aliases over primitives). Any apply-script only works with `Tokens`.

---

## How it works

```
Figma ComponentSet
       │
       ▼
[ Plugin Component → YAML ]          ← scans structure, colors, variants
       │
       ▼
components/*.yaml                    ← semantic component spec
       │
       ▼
[ Claude Code ]                      ← fills token_map, generates apply-script
       │
       ▼
[ Scripter → apply-[component].js ]  ← select ComponentSet → Run
       │
       ▼
Figma Variables bound ✅
```

The whole pipeline is driven through **Claude Code**. The repo ships with `CLAUDE.md` containing the instructions — clone the repo, open it in Claude Code, and it will walk you through every step itself.

### Step 0 — Tokens (once per project)

Two files — `tokens/primitives.css` (raw colors) and `tokens/tokens.css` (semantic aliases). The same values are duplicated as JS objects in `scripter/create-variables.js`.

Running `create-variables.js` in Scripter creates two collections in Figma Variables:

- `Primitives` — `Blue/500 = #3B82F6`, `Gray/900 = #111827`, …
- `Tokens` — `Action/primary/bg-default → Primitives/Blue/500` (VARIABLE_ALIAS)

Upsert by name: re-running doesn't duplicate variables, it only updates values.

### Step 1 — Plugin pulls the component structure

The **Component → YAML** plugin finds every ComponentSet on the current Figma page and builds a semantic YAML for each one. For every node it pulls:

- layer type (COMPONENT / FRAME / TEXT / VECTOR / INSTANCE)
- current fills and strokes (+ whether there was a `boundVariable` before)
- all `variantProperties` and their values
- `opacity` if it differs from 1

It then classifies nodes by roles (`bg` / `border` / `text` / `icon`) and surfaces *quirks* — non-trivial behavioral cases: `opacity: 0.5` on Disabled, a border that only appears for certain Color values, a wrapper pattern `COMPONENT > FRAME-wrapper > FRAME-field`.

The result is a file like:

```yaml
meta:
  name: Button
  figma_id: "76:17851"

variants:
  Color: [Blue, Light blue, Line blue, Line gray]
  State: [Default, Hover Active, Disabled]

structure:
  - node: "root"
    type: COMPONENT
    roles:
      - role: bg
        paint: fill
      - role: border
        paint: stroke
        condition: "Color in [Line blue, Line gray]"
  - node: "Button Label"
    type: TEXT
    roles:
      - { role: text, paint: fill }

quirks:
  - "State=Disabled → opacity: 0.5 on root — the script does not touch opacity"

token_map:
  Blue:
    Default:
      bg:   "TODO"   # rgb(59,130,246)
      text: "TODO"   # rgb(255,255,255)
    …
```

`token_map` is filled in separately; the plugin only substitutes current RGB as a hint.

### Step 2 — Claude Code fills the token_map

Claude Code reads `components/[component].yaml`, takes the list of available tokens from `scripter/create-variables.js`, and for every `Color × State` combination picks a semantic token by layer role.

The key logic is **contextual mapping, not color matching by hex**:

```
rgb(59,130,246) on a button bg            →  Action/primary/bg-default
rgb(59,130,246) on an outlined border     →  Action/ghost/border-default
rgb(59,130,246) on link text              →  Global/text/brand
```

If there's no token for a color — it writes it into `missing_tokens`, asks you to add the token to `tokens.css` + `create-variables.js` and re-run the variables script.

If `quirks` contains `"opacity: 0.5 on root"` — for Disabled it applies the same tokens as Default (the "disabled" look is achieved by the opacity at the component level itself).

### Step 3 — Claude Code generates the apply-script

Based on the filled `token_map` and the rules in `docs/06-apply-script-rules.md`, Claude Code writes `scripter/apply-[component]-tokens.js`. The script has a rigid structure:

1. **`TOKEN_MAP`** — a mirror of `token_map` from YAML, but ready for JS
2. **Utilities** — `findFirst` / `findAll` / `findFirstWhere` / `bindFill` / `bindStroke` (recursive search + Variable binding to `fills` / `strokes`)
3. **`main()`** — takes the ComponentSet from the selection (auto-lifting from a variant to its parent), iterates variants, finds layers by role for each one and binds the corresponding token

Per-role logic differs:

- `bg` — always `fill` on the `variant` (root COMPONENT node)
- `border` — `stroke` on the `variant`, but if the token_map entry is `null` → mandatory `variant.strokes = []` (otherwise the old gray stroke from a previous variant will remain)
- `text` — recursive search for a TEXT node by name, doesn't crash if not found
- `icon` — `findAll(variant, 'VECTOR')` and binding to every VECTOR (both `fills` and `strokes`), because a single icon = several paths, and a button can have two icons on the left and right

### Step 4 — Scripter applies

In Figma: open Scripter, paste the contents of `apply-[component]-tokens.js`, select the ComponentSet (or a single variant — the script will lift to the parent itself), press **Run**.

The script walks all variants, clears `fillStyleId` / `strokeStyleId` (dropping the Paint Style) via the Figma Plugin API and sets `setBoundVariableForPaint(..., variable)` — that's how a new Variable is bound in place of the style.

In the Scripter console you'll get a log for each variant (`✓ Blue / Default / 40`) plus a summary `Processed: N, Errors: 0`.

### Result

- Select any component variant → in the Fill / Stroke panel you'll see a variable icon and the token name (`Action/primary/bg-default`) instead of a hex color.
- Switch the mode in the Variables Panel (light ↔ dark ↔ brand) — all bound layers adapt automatically, with no manual fixes in the component.
- A developer opening the component via Figma Dev Mode / MCP / Cursor sees token names instead of hardcoded values — and can directly use the CSS variable `--color-action-primary-bg-default` in code.

---

## Quick start

```bash
git clone https://github.com/denysosadchyi/styles-to-token-migration.git
cd styles-to-token-migration
claude
```

After Claude Code starts, tell it: **"let's start the migration"** — it will read `CLAUDE.md`, look at the current state and suggest the first step.

---

## Repo structure

```
styles-to-token-migration/
├── CLAUDE.md                        — instructions for Claude Code (main entry point)
├── docs/                            — methodology
│   ├── 01-architecture.md            — three-level token system
│   ├── 02-plugin-install.md          — plugin installation
│   ├── 03-plugin-usage.md            — working with the plugin
│   ├── 04-migration-workflow.md      — step-by-step component migration
│   ├── 05-scripter-scripts.md        — Scripter scripts reference
│   └── 06-apply-script-rules.md      — rules for writing apply-scripts
│
├── figma-plugin/                    — Figma plugin "Component → YAML"
│   ├── manifest.json
│   ├── code.js
│   └── ui.html
│
├── scripter/                        — Figma Scripter scripts
│   ├── create-variables.js           — upsert Primitives + Tokens into Figma Variables
│   └── apply-button-tokens.example.js
│
└── examples/                        — example tokens and YAML
    ├── tokens/
    │   ├── primitives.css
    │   └── tokens.css
    └── components/
        └── button.example.yaml
```

---

## Requirements

- **Claude Code** — [claude.com/claude-code](https://claude.com/claude-code)
- **Figma Desktop / Web** with edit rights on the file
- **Scripter** — a free Figma plugin, `Plugins → Browse plugins → Scripter`

Node.js / npm are not required — the plugin and scripts run directly inside Figma.

---

## License

[MIT](LICENSE)

---

<a id="styles-token-migration-ua"></a>

# Styles → Token Migration (UA)

Мігрує Figma-бібліотеку з захардкоджених Paint Styles на семантичні Variables — так, щоб кожен шар кожного варіанту компонента був прив'язаний до токена, і зміна теми перемикалась одним кліком у Variables Panel.

---

## Що робить

- Сканує ComponentSet у Figma і витягує його структуру (кольори, варіанти, ролі шарів) у YAML-файл.
- По YAML будує apply-скрипт, який проходить по всіх варіантах компонента і прив'язує Figma Variables до fills / strokes замість Paint Styles.
- Веде каталог токенів у двох колекціях Figma Variables: `Primitives` (сирі кольори) і `Tokens` (семантичні aliases на primitives). Будь-який apply-скрипт працює тільки з `Tokens`.

---

## Як це працює

```
Figma ComponentSet
       │
       ▼
[ Плагін Component → YAML ]          ← сканує структуру, кольори, варіанти
       │
       ▼
components/*.yaml                    ← семантична специфікація компонента
       │
       ▼
[ Claude Code ]                      ← заповнює token_map, генерує apply-скрипт
       │
       ▼
[ Scripter → apply-[component].js ]  ← виділи ComponentSet → Run
       │
       ▼
Figma Variables прив'язані ✅
```

Весь pipeline керується через **Claude Code**. У репо лежить `CLAUDE.md` з інструкціями для нього — склонуй репо, відкрий його в Claude Code, і він сам проведе через всі кроки.

### Крок 0 — Токени (один раз на проект)

Два файли — `tokens/primitives.css` (сирі кольори) і `tokens/tokens.css` (семантичні aliases). Ті самі значення дублюються як JS-об'єкти у `scripter/create-variables.js`.

Запуск `create-variables.js` у Scripter створює у Figma Variables дві колекції:

- `Primitives` — `Blue/500 = #3B82F6`, `Gray/900 = #111827`, …
- `Tokens` — `Action/primary/bg-default → Primitives/Blue/500` (VARIABLE_ALIAS)

Upsert по імені: повторний запуск не дублює змінні, лише оновлює значення.

### Крок 1 — Плагін витягує структуру компонента

Плагін **Component → YAML** знаходить всі ComponentSet на поточній сторінці Figma і для кожного будує семантичний YAML. По кожному вузлу витягується:

- тип шару (COMPONENT / FRAME / TEXT / VECTOR / INSTANCE)
- поточні fills і strokes (+ чи був `boundVariable` раніше)
- всі `variantProperties` і їх значення
- `opacity` якщо відрізняється від 1

Далі плагін класифікує вузли по ролях (`bg` / `border` / `text` / `icon`) і виявляє *quirks* — нетривіальні поведінкові кейси: `opacity: 0.5` на Disabled, border який з'являється лише у певних Color-значень, wrapper-патерн `COMPONENT > FRAME-wrapper > FRAME-field`.

Результат — файл на кшталт:

```yaml
meta:
  name: Button
  figma_id: "76:17851"

variants:
  Color: [Blue, Light blue, Line blue, Line gray]
  State: [Default, Hover Active, Disabled]

structure:
  - node: "root"
    type: COMPONENT
    roles:
      - role: bg
        paint: fill
      - role: border
        paint: stroke
        condition: "Color in [Line blue, Line gray]"
  - node: "Button Label"
    type: TEXT
    roles:
      - { role: text, paint: fill }

quirks:
  - "State=Disabled → opacity: 0.5 на root — скрипт не чіпає opacity"

token_map:
  Blue:
    Default:
      bg:   "TODO"   # rgb(59,130,246)
      text: "TODO"   # rgb(255,255,255)
    …
```

`token_map` — заповнюється окремо, плагін підставляє лише поточні RGB як підказку.

### Крок 2 — Claude Code заповнює token_map

Claude Code читає `components/[component].yaml`, бере список доступних токенів з `scripter/create-variables.js`, і для кожної комбінації `Color × State` підбирає семантичний токен по ролі шару.

Ключова логіка — **контекстуальний mapping, не color matching по hex**:

```
rgb(59,130,246) на bg кнопки         →  Action/primary/bg-default
rgb(59,130,246) на рамці outlined    →  Action/ghost/border-default
rgb(59,130,246) на тексті посилання  →  Global/text/brand
```

Якщо для якогось кольору токена немає — пише в `missing_tokens`, просить додати токен у `tokens.css` + `create-variables.js` і перезапустити скрипт варіаблів.

Якщо у `quirks` є `"opacity: 0.5 на root"` — для Disabled застосовує ті ж токени що й Default (вигляд «disabled» забезпечує сам opacity на рівні компонента).

### Крок 3 — Claude Code генерує apply-скрипт

На основі заповненого `token_map` і правил з `docs/06-apply-script-rules.md` Claude Code пише `scripter/apply-[component]-tokens.js`. Скрипт має жорстку структуру:

1. **`TOKEN_MAP`** — дзеркало `token_map` з YAML, але готове для JS
2. **Утиліти** — `findFirst` / `findAll` / `findFirstWhere` / `bindFill` / `bindStroke` (рекурсивний пошук + прив'язка Variable до `fills` / `strokes`)
3. **`main()`** — бере ComponentSet з виділення (з автопідйомом від варіанту до батька), перебирає варіанти, для кожного знаходить шари по ролях і прив'язує відповідний токен

По ролях логіка різна:

- `bg` — завжди `fill` на `variant` (root COMPONENT-вузол)
- `border` — `stroke` на `variant`, але якщо в token_map `null` → обов'язково `variant.strokes = []` (інакше залишиться старий сірий stroke від попереднього варіанту)
- `text` — рекурсивний пошук TEXT-вузла по імені, не падає якщо не знайдено
- `icon` — `findAll(variant, 'VECTOR')` і прив'язка до кожного VECTOR-а (і до `fills` і до `strokes`), тому що одна іконка = кілька path'ів, а кнопка може мати дві іконки зліва і справа

### Крок 4 — Scripter застосовує

У Figma: відкриваєш Scripter, вставляєш вміст `apply-[component]-tokens.js`, виділяєш ComponentSet (або один варіант — скрипт сам підніметься до батька), тиснеш **Run**.

Скрипт проходить по всіх варіантах, через Figma Plugin API очищує `fillStyleId` / `strokeStyleId` (викидаючи Paint Style) і ставить `setBoundVariableForPaint(..., variable)` — так новий Variable прив'язується замість стилю.

У консолі Scripter — лог по кожному варіанту (`✓ Blue / Default / 40`) + підсумок `Оброблено: N, Помилок: 0`.

### Результат

- Виділи будь-який варіант компонента → у панелі Fill / Stroke замість hex-кольору стоїть іконка змінної та назва токена (`Action/primary/bg-default`).
- Перемкни mode у Variables Panel (light ↔ dark ↔ brand) — всі прив'язані шари адаптуються автоматично, без ручних правок у компоненті.
- Розробник, відкриваючи компонент через Figma Dev Mode / MCP / Cursor, бачить назви токенів замість захардкоджених значень — і може напряму використовувати CSS-змінну `--color-action-primary-bg-default` у коді.

---

## Швидкий старт

```bash
git clone https://github.com/denysosadchyi/styles-to-token-migration.git
cd styles-to-token-migration
claude
```

Після запуску Claude Code скажи йому: **«давай почнемо міграцію»** — він прочитає `CLAUDE.md`, подивиться поточний стан і підкаже перший крок.

---

## Структура репо

```
styles-to-token-migration/
├── CLAUDE.md                        — інструкції для Claude Code (головний вхід)
├── docs/                            — методологія
│   ├── 01-architecture.md            — трирівнева токен-система
│   ├── 02-plugin-install.md          — встановлення плагіна
│   ├── 03-plugin-usage.md            — робота з плагіном
│   ├── 04-migration-workflow.md      — покрокова міграція компонента
│   ├── 05-scripter-scripts.md        — довідник Scripter-скриптів
│   └── 06-apply-script-rules.md      — правила написання apply-скриптів
│
├── figma-plugin/                    — Figma plugin «Component → YAML»
│   ├── manifest.json
│   ├── code.js
│   └── ui.html
│
├── scripter/                        — Figma Scripter скрипти
│   ├── create-variables.js           — upsert Primitives + Tokens у Figma Variables
│   └── apply-button-tokens.example.js
│
└── examples/                        — приклад токенів і YAML
    ├── tokens/
    │   ├── primitives.css
    │   └── tokens.css
    └── components/
        └── button.example.yaml
```

---

## Вимоги

- **Claude Code** — [claude.com/claude-code](https://claude.com/claude-code)
- **Figma Desktop / Web** з правами на редагування файлу
- **Scripter** — безкоштовний плагін Figma, `Plugins → Browse plugins → Scripter`

Node.js / npm не потрібні — плагін і скрипти запускаються напряму у Figma.

---

## Ліцензія

[MIT](LICENSE)
