# Изображения и шрифт

`apps/kiosk/public/images/food-sheet.png` создан встроенным инструментом imagegen для этого проекта. Это единый лист 3 × 2: смэш, чикен, BBQ, фри, кола, наггетсы. Интерфейс показывает нужную ячейку через CSS background-position; исходный растр не редактировался. Изображения иллюстративные и не являются фотографиями реального меню.

Промпт:

> Use case: product-mockup. Asset type: a single 3 by 2 contact sheet of six product photographs for a restaurant kiosk, landscape 1536x1024. Six equally sized exact rectangular cells with no gaps, all solid pale cream #f4f0e8 seamless backgrounds, each object centered with generous 15 percent margins and fully contained inside its cell. Top left: gorgeous double smashed beef cheeseburger with brioche sesame bun, melted cheddar, lettuce, pickles and tomato. Top middle: crispy fried chicken burger with lettuce and creamy sauce in sesame brioche bun. Top right: tall cheeseburger with bacon and melted cheddar in brioche bun. Bottom left: appetizing golden french fries in a simple plain orange paper carton. Bottom middle: dark cola with ice in a simple translucent takeaway cup and a straw, no logo. Bottom right: round golden breaded chicken nuggets with a tiny plain white dipping sauce ramekin. Consistent commercial studio food photography, realistic appetizing textures, soft natural shadows, eye-level three-quarter view. NO text, NO labels, NO dividers, NO watermark. All six cells equal size and photo scale. This will be displayed as a CSS sprite sheet.

Manrope поставляется локально пакетом `@fontsource-variable/manrope` (OFL-1.1). Иконки — `lucide-react` (ISC). Их лицензии находятся в соответствующих пакетах; публикация кода проекта не отменяет лицензии зависимостей.

## Обложка проекта

`apps/kiosk/public/images/biteos-social-preview.jpg` — иллюстративная обложка для README, GitHub Social Preview и метатегов публичного демо. Она создана встроенным imagegen с использованием `food-sheet.png` только как визуального референса для бургера, картофеля и напитка. Это рекламная иллюстрация проекта, а не снимок реального интерфейса или предложение с актуальными ценами. Итоговый файл подготовлен в размере 1280 × 640 px; исходное изображение сохранено в истории генерации проекта.

Основной промпт:

> Use case: ads-marketing. Asset type: GitHub repository social preview / README hero for BiteOS, 2:1 landscape composition, clean solid background, polished and legible at thumbnail size. Input image: food-sheet.png is a supporting visual reference only for the existing BiteOS demo burger, fries and cola; create a new original composition, do not copy the 3x2 sheet layout. Primary request: Make a striking but honest open-source project cover for a smart restaurant ordering demo. Left 55%: warm near-black cocoa background, strong typographic hierarchy with the exact large word "BiteOS" in crisp modern sans-serif letters, and beneath it the exact short line "KIOSK · DELIVERY · SMART COMBOS" in smaller uppercase lettering. Right 45%: one juicy double smash burger, bright fries in a plain orange carton, and a cola cup, cropped artistically against a warm cream/orange halo. Slight tasteful UI accents (two subtle rounded price/plus chips) may suggest ordering, but do not invent a detailed screenshot or fake metrics. Palette: near-black brown #201c19, orange #f3933f, warm cream #fff6e8. Premium modern product identity, minimal, high contrast, generous breathing room, no logos beyond BiteOS, no extra text, no watermark. Ensure every letter is spelled exactly.

Промпт финальной правки: убрать две плавающие карточки с долларовыми ценами и декоративными значками, сохранив слово `BiteOS`, строку `KIOSK · DELIVERY · SMART COMBOS`, продукты и композицию без новых надписей.

## Изображения Roby’s

Фотографии в `apps/kiosk/public/images/robys/` взяты из [репозитория Roby’s Coffee House](https://github.com/safal207/robys-coffee-house-demo) для демонстрации меню кафе. Их происхождение и необходимость проверки прав перед коммерческим использованием описаны в [README источника](https://github.com/safal207/robys-coffee-house-demo#business-truth-checklist). Лицензия MIT для оригинального кода BiteOS **не распространяется** на эти фотографии и чужие товарные знаки. Подробнее — в [NOTICE](../NOTICE.md).
