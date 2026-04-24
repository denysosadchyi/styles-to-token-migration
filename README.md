# Styles → Token Migration

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

Весь pipeline керується через **Claude Code**. У репо лежить `CLAUDE.md` з інструкціями для нього — склонуй репо, відкрий його в Claude Code, і він сам проведе через всі кроки: підготує токени під твою палітру, підкаже коли що запускати у Figma, згенерує YAML-аналіз і apply-скрипти для кожного компонента.

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
