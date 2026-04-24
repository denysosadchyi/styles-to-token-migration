# Плагін «Component → YAML» — використання

---

## Що робить плагін

1. Сканує **поточну сторінку** Figma
2. Знаходить всі `ComponentSet`-и
3. Для кожного генерує `.yaml` файл з описом структури
4. Виводить список файлів в UI — кожен можна скачати окремо або всі разом у ZIP

---

## Запуск

```
Головне меню → Plugins → Development → Component → YAML
```

В UI натиснути кнопку **Сканувати сторінку**.

> Сканування займає 1–5 секунд залежно від кількості компонентів.

---

## Інтерфейс

```
┌─────────────────────────────────────────┐
│  Component → YAML                       │
├─────────────────────────────────────────┤
│  [Сканувати сторінку]                   │
├─────────────────────────────────────────┤
│  ● button.yaml              [↓]         │
│  ● alert.yaml               [↓]         │
│  ● input-password.yaml      [↓]         │
│  ✕ unnamed-component.yaml   (error)     │
│  ...                                    │
├─────────────────────────────────────────┤
│  Сторінка: Components   54 файли        │
│  [← Назад]     [Завантажити .zip]       │
└─────────────────────────────────────────┘
```

| Елемент | Дія |
|---------|-----|
| **Сканувати сторінку** | Запустити сканування |
| **●** (зелена крапка) | Компонент успішно оброблений |
| **✕** (червона крапка) | Помилка при обробці компонента |
| **[↓]** (кнопка поруч з ім'ям) | Скачати цей один YAML-файл |
| **Завантажити .zip** | Скачати всі файли одним архівом |

---

## Структура згенерованого YAML

```yaml
# Компонент: Button
# Згенеровано плагіном Component → YAML

meta:
  name: Button
  figma_id: "76:17851"          # Figma node ID ComponentSet
  type: COMPONENT_SET

variants:
  Color: [Blue, Light blue, Line blue, Line gray]
  State: [Default, Hover Active, Disabled]
  Size: [28, 36, 40]

# role: bg | border | text | icon
# paint: fill | stroke
structure:
  - node: "root"
    type: COMPONENT
    roles:
      - role: bg
        paint: fill
      - role: border
        paint: stroke
        condition: "Color in [Line blue, Line gray]"
  - node: "Next Step Button"
    type: TEXT
    roles:
      - role: text
        paint: fill
  - node: "account"
    type: INSTANCE > VECTOR
    roles:
      - role: icon
        paint: stroke

quirks:
  - "State=Disabled → opacity: 0.5 на root — скрипт не чіпає opacity"
  - "border не має boundVar — setBoundVariable виконується вперше"

# token_map — заповнити токенами вручну (або з допомогою Claude Code)
token_map:
  Blue:
    Default:
      bg:     "TODO"   # rgb(59,130,246)
      text:   "TODO"   # rgb(255,255,255)
      icon:   "TODO"   # rgb(255,255,255)

missing_tokens: []
```

---

## Поля YAML

### `meta`
| Поле | Пояснення |
|------|-----------|
| `name` | Назва ComponentSet у Figma |
| `figma_id` | Node ID (потрібен для apply-скриптів) |
| `type` | Завжди `COMPONENT_SET` |

### `variants`
Всі варіантні виміри компонента і їх можливі значення. Плагін визначає це з `componentPropertyDefinitions` ComponentSet.

### `structure`
Список вузлів, які несуть колір. Для кожного:
- `node` — назва шару в Figma (або `"root"` для самого COMPONENT)
- `type` — тип шару (`COMPONENT`, `FRAME`, `TEXT`, `INSTANCE > VECTOR`, `VECTOR`)
- `roles` — масив ролей (bg/border/text/icon) з властивістю (fill/stroke)
- `condition` — умова коли ця роль активна (наприклад, лише для певних Color-значень)

### `quirks`
Автоматично виявлені нетривіальні поведінкові кейси:
- `opacity: 0.5` для Disabled
- border якого раніше не було boundVar (вперше прив'язується)
- однаковий bg+border в одному вузлі
- border, що є тільки в деяких Color-значеннях

### `token_map`
Маппінг варіантів → токени. **Заповнюється вручну або Claude Code.** Плагін підставляє тільки підказки у вигляді `"TODO"` з коментарем `# rgb(...)` — щоб було зрозуміло який колір замінити.

### `missing_tokens`
Список токенів, яких ще немає в `tokens.css`. Заповнюється при аналізі Claude Code.

---

## Алгоритм роботи плагіна

### Визначення `structure`

**bg (fill):**
Плагін шукає FRAME або RECTANGLE з заповненим fill серед дочірніх вузлів. Якщо root-COMPONENT має fill → `node: "root"`. Якщо fill на дочірньому FRAME → вказується ім'я того FRAME.

**border (stroke):**
Сканується **кожен варіант** ComponentSet (не тільки перший) — деякі border з'являються тільки в певних станах (наприклад, `Error` або `ActiveVisible`).
Пріоритет: FRAME зі stroke > FRAME з fill.
Також підтримується wrapper-патерн: `COMPONENT > FRAME-wrapper > FRAME-field`.

**text:**
Всі TEXT-вузли, що мають видимий fill, з усіх варіантів (дедуплікація по імені).

**icon:**
Перший VECTOR всередині кожного INSTANCE. Якщо VECTOR має stroke → `paint: stroke`. Якщо тільки fill → `paint: fill`.

### Визначення `quirks`

- Порівнює Default vs Disabled для кожного Color-значення
- Якщо `opacity < 1` на Disabled — фіксує в quirks
- Якщо border є тільки в частини Color-значень — додає `condition`
- Якщо bg і border в одному вузлі — фіксує в quirks

---

## Типові ситуації

### Компонент без варіантів
YAML матиме порожній `variants: {}` і один запис у `structure`.

### Компонент де border є тільки в Error-стані
Плагін сканує всі варіанти і знайде border-вузол навіть якщо в Default він відсутній.

### Вкладені компоненти (INSTANCE всередині INSTANCE)
Плагін шукає VECTOR тільки в прямих дітях INSTANCE, не рекурсує далі у вкладені компоненти. Це запобігає зайвим записам у structure.

### Компонент із wrapper-патерном
Деякі компоненти мають структуру `COMPONENT > FRAME (wrapper) > FRAME (field)`. Плагін перевіряє рівень 2 (діти wrapper'а) якщо на рівні 1 нічого не знайдено.

---

## Після скачування YAML

1. Перемістити YAML у папку `components/` свого проекту
2. Відкрити у редакторі
3. Заповнити `token_map` — вручну або передати в Claude Code (див. [04-migration-workflow.md](04-migration-workflow.md))
4. Перевірити `missing_tokens` — якщо є, додати в `tokens.css`
5. Попросити Claude Code згенерувати apply-скрипт
