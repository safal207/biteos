# Изображения и шрифт

`apps/kiosk/public/images/food-sheet.png` создан встроенным инструментом imagegen для этого проекта. Это единый лист 3 × 2: смэш, чикен, BBQ, фри, кола, наггетсы. Интерфейс показывает нужную ячейку через CSS background-position; исходный растр не редактировался. Изображения иллюстративные и не являются фотографиями реального меню.

Промпт:

> Use case: product-mockup. Asset type: a single 3 by 2 contact sheet of six product photographs for a restaurant kiosk, landscape 1536x1024. Six equally sized exact rectangular cells with no gaps, all solid pale cream #f4f0e8 seamless backgrounds, each object centered with generous 15 percent margins and fully contained inside its cell. Top left: gorgeous double smashed beef cheeseburger with brioche sesame bun, melted cheddar, lettuce, pickles and tomato. Top middle: crispy fried chicken burger with lettuce and creamy sauce in sesame brioche bun. Top right: tall cheeseburger with bacon and melted cheddar in brioche bun. Bottom left: appetizing golden french fries in a simple plain orange paper carton. Bottom middle: dark cola with ice in a simple translucent takeaway cup and a straw, no logo. Bottom right: round golden breaded chicken nuggets with a tiny plain white dipping sauce ramekin. Consistent commercial studio food photography, realistic appetizing textures, soft natural shadows, eye-level three-quarter view. NO text, NO labels, NO dividers, NO watermark. All six cells equal size and photo scale. This will be displayed as a CSS sprite sheet.

Manrope поставляется локально пакетом `@fontsource-variable/manrope` (OFL-1.1). Иконки — `lucide-react` (ISC). Их лицензии находятся в соответствующих пакетах; публикация кода проекта не отменяет лицензии зависимостей.
