# Styles → Token Migration

Pipeline для міграції Figma-бібліотеки з **Paint Styles / захардкоджених кольорів** на **семантичні Variables** — з підтримкою перемикання тем (light / dark / brand).

Все відбувається **всередині Figma**, без MCP і без ручного перепроставлення токенів по сотнях шарів.

---

## Що це

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
[ LLM (Claude / GPT / будь-який) ]   ← заповнює token_map, генерує apply-скрипт
       │
       ▼
[ Scripter → apply-[component].js ]  ← виділи ComponentSet → Run
       │
       ▼
Figma Variables прив'язані ✅
```

Одразу на виході: компонент, кожен варіант якого прив'язаний до семантичного токена. Перемикання mode у Variables Panel → тема міняється без ручних правок.

---

## Чому не Figma MCP / не Token Studio

- **Figma MCP** працює в одну сторону (дизайн → код). Він не мігрує саму design system, не розуміє контекстуальних ролей шарів і має жорсткі ліміти викликів.
- **Token Studio** — це **імпорт** токенів у Figma, а не міграція існуючих компонентів з Paint Styles на Variables. Він не перепрошиває кожен варіант Component Set.

Цей pipeline вирішує саме задачу **міграції існуючих компонентів** — там, де Variables ще не застосовано, а треба прив'язати їх без ручної роботи по тисячах шарів.

---

## Швидкий старт

### 1. Встановити плагін Component → YAML

У Figma: `Plugins → Development → Import plugin from manifest...` → вибрати [`figma-plugin/manifest.json`](figma-plugin/manifest.json).

→ Повна інструкція: [docs/02-plugin-install.md](docs/02-plugin-install.md)

### 2. Підготувати токени (один раз на проект)

1. Описати свої токени у `tokens/primitives.css` + `tokens/tokens.css` (приклад у [`examples/tokens/`](examples/tokens/))
2. Перенести їх у Scripter-скрипт [`scripter/create-variables.js`](scripter/create-variables.js) (у вигляді JS-об'єктів `PRIMS` + `TOKENS`)
3. Запустити у **Scripter** → створить дві колекції у Figma Variables: `Primitives` і `Tokens`

### 3. Мігрувати компонент

1. Плагін `Component → YAML` → `Scan` → скачати `button.yaml`
2. Передати YAML у LLM: *«подивися на button.yaml і заповни token_map»*
3. Отримати `apply-button-tokens.js` → виділити ComponentSet Button → **Run** у Scripter

→ Покроковий процес: [docs/04-migration-workflow.md](docs/04-migration-workflow.md)

---

## Структура репо

```
styles-to-token-migration/
├── docs/                         — вся методологія
│   ├── 01-architecture.md         — трирівнева токен-система (Primitives → Tokens → Variables)
│   ├── 02-plugin-install.md       — встановлення плагіна
│   ├── 03-plugin-usage.md         — робота з плагіном
│   ├── 04-migration-workflow.md   — покрокова міграція одного компонента
│   ├── 05-scripter-scripts.md     — довідник Scripter-скриптів
│   └── 06-apply-script-rules.md   — правила написання apply-скриптів
│
├── figma-plugin/                 — Figma plugin «Component → YAML»
│   ├── manifest.json
│   ├── code.js
│   └── ui.html
│
├── scripter/                     — Figma Scripter скрипти (шаблони)
│   ├── create-variables.js        — upsert Primitives + Tokens у Figma Variables
│   └── apply-button-tokens.example.js  — приклад apply-скрипта
│
└── examples/                     — приклад токенів і YAML
    ├── tokens/
    │   ├── primitives.css
    │   └── tokens.css
    └── components/
        └── button.example.yaml
```

---

## Вимоги

- **Figma Desktop / Web** з правами на редагування файлу
- **Scripter** (Figma plugin) — безкоштовний, `Plugins → Browse plugins → Scripter`
- Будь-який LLM-асистент (Claude Code / Cursor / ChatGPT) — для заповнення `token_map` і генерації apply-скриптів

Node.js / npm **не потрібні** — плагін і скрипти запускаються напряму у Figma.

---

## Ліцензія

[MIT](LICENSE)
