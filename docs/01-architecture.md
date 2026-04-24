# Архітектура токен-системи

---

## Три рівні

```
РІВЕНЬ 1 — Primitives (primitives.css)
  Сирі значення кольорів без семантики.
  Приклад: --color-blue-500: #3B82F6

        ↓  (через var())

РІВЕНЬ 2 — Semantic Tokens (tokens.css)
  Іменовані ролі. Кожен токен описує НАВІЩО колір, а не який він.
  Приклад: --color-action-primary-bg-default: var(--color-blue-500)

        ↓  (через scripter/create-variables.js)

РІВЕНЬ 3 — Figma Variables
  Колекція Primitives + колекція Tokens як VARIABLE_ALIAS.
  Компонент прив'язаний до токена → при зміні теми змінюється значення.
```

---

## Колекції у Figma Variables

| Колекція | Зміст | Приклад кількості |
|----------|-------|-------------------|
| **Primitives** | Сирі кольори (`#3B82F6`, `#FEE2E2`, …) | ~30–60 |
| **Tokens** | Semantic aliases на Primitives | ~80–150 |

**Primitives не прив'язуються до компонентів напряму** — тільки Tokens. Це дозволяє змінити значення палітри в одному місці і оновити всі компоненти автоматично.

---

## Naming convention у Figma Variables

Формат: `Категорія/підкатегорія/роль`

```
Global/bg/page              → фон усієї сторінки
Global/bg/default           → основна поверхня: картка, модалка
Global/text/primary         → основний текст
Global/text/brand           → брендовий текст (посилання)
Global/icon/brand           → брендова іконка
Global/border/focus         → focus ring

Feedback/error/bg           → фон error-блоку
Feedback/error/icon         → іконка помилки
Feedback/success/bg-solid   → насичений фон success-Alert (solid variant)

Action/primary/bg-default   → фон primary кнопки (Default)
Action/primary/bg-hover     → фон primary кнопки (Hover)
Action/ghost/border-default → рамка outlined кнопки

Control/field/bg-default    → фон поля введення
Control/field/border-focus  → рамка при фокусі
Control/field/border-error  → рамка в помилковому стані

Selection/bg-selected       → фон вибраного рядка
Selection/text-selected     → текст вибраного рядка
```

---

## CSS naming convention (`tokens.css`)

Формат: `--color-[категорія]-[підкатегорія]-[стан]`

```css
/* Global */
--color-bg-page
--color-text-primary
--color-icon-brand
--color-border-focus

/* Feedback */
--color-feedback-error-bg
--color-feedback-error-bg-solid     /* для solid variant Alert */
--color-feedback-error-icon

/* Action */
--color-action-primary-bg-default
--color-action-primary-bg-hover
--color-action-ghost-border-default

/* Control */
--color-control-field-bg-default
--color-control-field-border-error

/* Selection */
--color-selection-bg-selected
--color-selection-text-selected
```

> Слеші у Figma Variables (`Action/primary/bg-default`) відповідають `-` у CSS (`--color-action-primary-bg-default`). Це узгодження спрощує перенесення значень між dev-кодом і Figma.

---

## Ролі шарів у компонентах

Кожен шар в YAML описується через роль:

| Роль | Тип шару Figma | Властивість | Приклад |
|------|---------------|-------------|---------|
| `bg` | COMPONENT / FRAME | `fills` | фон кнопки |
| `border` | COMPONENT / FRAME | `strokes` | рамка outlined кнопки |
| `text` | TEXT | `fills` | підпис кнопки |
| `icon` | VECTOR (всередині INSTANCE) | `fills` або `strokes` | іконка всередині кнопки |
| `link` | TEXT (посилання) | `fills` | "Forgot password?" |

> Той самий hex-колір → різні токени залежно від ролі:
> `#3B82F6` на фоні кнопки   = `Action/primary/bg-default`
> `#3B82F6` в тексті посилання = `Global/text/brand`
> `#3B82F6` на рамці outlined = `Action/ghost/border-default`

Це **контекстуальний semantic mapping** — не color matching по hex.

---

## Feedback-токени: subtle vs solid

Alert-компонент зазвичай має два варіанти фону:

| variant | bg-токен | text/icon |
|---------|---------|-----------|
| `subtle` | `Feedback/*/bg` (світлий тинт) | `Global/text/primary` + статусна іконка |
| `left-accent` | `Feedback/*/bg` | те саме |
| `top-accent` | `Feedback/*/bg` | те саме |
| `solid` | `Feedback/*/bg-solid` (насичений) | `Global/text/inverse` (білий) |

---

## Disabled-стани: дві стратегії

### Стратегія 1 — opacity на root (Button, Checkbox)

```yaml
quirks:
  - "State=Disabled → opacity: 0.5 на root — скрипт не чіпає opacity"
```

Apply-скрипт застосовує **ті самі токени що й Default**. Вигляд "disabled" забезпечує `opacity: 0.5` на рівні компонента.

### Стратегія 2 — окрема disabled-палітра (Control/fields)

```yaml
token_map:
  Disabled:
    bg:     "Control/field/bg-disabled"
    border: "Control/field/border-default"
    text:   "Global/text/disabled"
```

Apply-скрипт застосовує окремі `*/disabled` токени.

**Як визначити яка стратегія:** подивитись на `quirks` у YAML. Якщо там `"opacity: 0.5 на root"` — це стратегія 1. Якщо немає — стратегія 2.

---

## Відсутні токени

Якщо при заповненні `token_map` виявлено колір без відповідного токена:

1. Додати токен у `tokens/tokens.css` у відповідну секцію
2. Оновити об'єкт `TOKENS` у `scripter/create-variables.js`
3. Запустити `create-variables.js` у Scripter
4. Продовжити міграцію

Всі відсутні токени фіксуються у YAML під ключем `missing_tokens`.
