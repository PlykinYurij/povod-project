# Правила frontend «Повода»

Статус: правила согласованы владельцем (D-26), 11 ноября 2026; точные версии и последующие технические настройки ещё проверяются. Код/зависимости/конфиги пока не создаются. Приоритет [решений](../product/decisions.md); план каркаса не расширяется установкой всего стека сразу.

## Принято владельцем

TypeScript; FSD по возможности с адаптацией к Next.js; i18n; TanStack React Query для клиентских запросов и серверные запросы там, где нужны. CSS Modules и CSS custom properties для цветов, отступов, размеров и светлой/тёмной темы. UI-kit-слой в shared/ui. NestJS публикует Swagger/OpenAPI; Orval генерирует API-типы, методы и query/mutation hooks. Тесты Vitest. Кабинет/admin строятся на готовом kit, шаблоны — собственные. Если требуется глобальное клиентское состояние — Zustand, не второй кеш серверных данных. Менеджер npm, Node 26.13.0.

## Предлагаемая структура Next.js + FSD

```text
apps/web/
  app/                 # Next routing/layout/metadata/loading/error, тонкие файлы
  src/
    _app/              # композиция providers, темы, i18n
    _pages/            # композиция экранов
    widgets/           # крупные самостоятельные части экранов
    features/          # действия: edit-draft, publish, choose-slug
    entities/          # project, invitation, session-user
    shared/
      ui/              # адаптеры UI-kit, общие примитивы, без бизнес-правил
      api/             # transport, ошибки, browser/server entry points
      config/
      lib/
      styles/          # tokens.css, themes.css, минимальные global/reset
packages/api-client/   # сгенерированные Orval-модели и функции
```

Это проектная адаптация, не требование заранее создать пустые папки. Next app и FSD _app/_pages разделены, чтобы не конфликтовать с особым значением app/pages для Next. Импорты идут вниз по слоям; соседние features не связывать через внутренние файлы, композиция выше. Slice открывает небольшой публичный API. Разделять `index.ts` и `index.server.ts`; server-only модуль не экспортируется из client-barrel. `use client` только на интерактивной границе, не на всём приложении. FSD не оправдывает лишние обёртки или абстракции для одного поля.

## UI-kit, стили и темы

**Согласовано:** Mantine для кабинета и admin (уже начальный вариант §9). Он подходит к CSS Modules и переменным; выбор kit принят D-26. Компоненты kit используются через shared/ui; бизнес-композиция остаётся в features/widgets. Адаптер создаётся по реальной потребности, не копировать весь kit заранее. Прямые vendor-импорты допускаются в этом слое и конфигурации provider; правило импортов позже автоматизировать.

Публичный лендинг может использовать общие простые примитивы; приглашения — собственные versioned template components/CSS, без зависимости от provider/тяжёлого bundle кабинета. Провайдеры Query/kit/theme подключать только к нужным layout, не превращать все гостевые страницы в клиентские.

Семантические tokens: `--color-bg`, `--color-surface`, `--color-text`, `--color-text-muted`, `--color-border`, `--color-accent`, `--space-1..8`, радиусы, шрифты, max-width, z-index. Предлагаемая spacing-шкала: 4/8/12/16/24/32/48/64 px, использование через rem/variables. Не каждый 1px border или breakpoint обязан быть переменной: токенизировать переиспользуемый дизайн, а не усложнять CSS. Палитры light/dark меняют токены; настройку kit связать с ними, не заводить второй независимый набор цветов. Контраст/focus/reduced-motion обязательны.

Тема кабинета не должна перекрашивать опубликованное приглашение: templateVersion/themeId задают его отдельную визуальную схему. Системную тему/сохранение выбора/SSR без вспышки проверить отдельно. Пользовательский HTML/CSS/JS не допускается.

## i18n и состояние

Принято требование локализации, но слово i18n само по себе не выбирает библиотеку. **Согласовано:** next-intl для App Router/RSC; i18next не используется как параллельная система переводов. Сервис/кабинет RU/EN, приглашения/RSVP RU по FR-25. Тексты UI и ошибок через ключи, не конкатенировать переведённые фразы; формат дат/чисел учитывает locale и пояс события. Контент владельца автоматически не переводится. Namespace-модули, в client передавать только нужные сообщения, не весь каталог.

Server Components для первоначального чтения и публичного приглашения; TanStack Query для клиентского серверного состояния, мутаций, polling фото и инвалидирования. Не делать одинаковый initial fetch дважды; hydration только при реальной необходимости. QueryClient на сервере создаётся на запрос, не singleton между владельцами. Cache keys включают контекст проекта/параметры; logout очищает private cache.

Локальный React-state для локального UI, данные формы — form state, серверные данные — Query. Zustand только для действительно общего UI-состояния; SSR-store не глобален между запросами. Не хранить cookies/password/reset tokens в store/localStorage. Сохранённый черновик и локальный несохранённый ввод различаются.

## OpenAPI → Orval

Swagger UI — представление, источник генерации — OpenAPI JSON NestJS со стабильными operationId, DTO, статусами/ошибками и описанием cookie/CSRF/идемпотентности. Доступ к UI/JSON по среде согласовать, не считать документацию auth-защитой API. Генерация из проверенной версии схемы, без скачивания production-секретов. Generated-файлы не редактировать; исправлять схему и перегенерировать. Продуктовые view models не обязательно совпадают с DTO, но DTO/enum не копируются руками.

Предложение: раздельные browser/server entry points в packages/api-client. Browser получает Orval React Query hooks/methods; server — generated plain fetch-функции без React hooks, browser globals и client-провайдеров. Orval-конфигурация и версия должны быть проверены перед созданием генерации, не импортировать hook-модуль в RSC. Общий transport обрабатывает base URL, credentials/CSRF, AbortSignal и согласованный Error DTO. Сервер передаёт cookie только доверенному API для текущего запроса; никогда не пересылает её произвольному routeUrl/гостевому host. Mutator не должен скрывать 401/409/422 как успех.

Publication retry использует тот же operation key; generic автоматический retry мутаций не должен создавать новый ключ/период. Ошибки полей отображаются по paths, конфликт ревизии не затирается retry. Будущий CI сверяет схему и generated diff, typecheck потребителей; hooks генерировать только по существующему контракту.

## Тесты и форматирование

Vitest: логика, схемы/преобразования, обработка ошибок, поведение клиентских компонентов (предложение Testing Library и MSW по потребности). Не проверять внутреннюю реализацию и не писать snapshot всего экрана. SSR/API/транзакции и браузерный сквозной путь не доказываются одним Vitest: реальные build/интеграционные проверки обязательны; Playwright для поздних E2E остаётся предложением, не установленной зависимостью.

Согласовано владельцем: **ESLint + стандартный Prettier**, без Biome/второго форматтера. Prettier default: 2 пробела, semicolons, стандартные кавычки/переносы; не дублировать stylistic rules в ESLint. ESLint — Next/React/hooks/TypeScript и границы импортов. TypeScript strict, избегать any/необоснованного non-null; unknown валидируется на границе. Исключения в generated-коде решаются схемой/генератором. Компоненты PascalCase, hooks useX, папки слайсов kebab-case. Команды/конфиги появятся после отдельных задач, сейчас не заявлены существующими.

## Источники и нерешённое

Проверено 11 ноября 2026: [FSD + Next](https://feature-sliced.design/docs/guides/tech/with-nextjs), [next-intl Server/Client](https://next-intl.dev/docs/environments/server-client-components), [TanStack SSR](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr), [Orval React Query](https://orval.dev/docs/guides/react-query/), [Orval fetch](https://orval.dev/docs/guides/fetch-client/), [Mantine Next](https://mantine.dev/guides/next/), [Mantine CSS Modules](https://mantine.dev/styles/css-modules/).

next-intl и Mantine согласованы. Нужны точные версии и проверка Orval outputs. Правила не означают установки всех библиотек в E1-01: каркас остаётся минимальным. Генерация API, i18n, темы/kit, тестовый runner добавляются отдельными малыми задачами с потребителями.
