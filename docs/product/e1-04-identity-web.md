# E1-04/04c/04d · Регистрация и восстановление в web

Продолжение `feat/web-sign-in` после навигационных исправлений `68655de`, по прямому поручению владельца выполнить оба сценария на той же ветке. Статус **Review** после проверок; принятие владельцем и merge отмечаются отдельно. Не новый ID backlog. Источники: FR-02/03/04, NFR-01/06/07/09/14 [ТЗ](../povod-mvp-spec-v0.1.md), D-28–32 [решений](decisions.md), [контракт identity](../architecture/authentication.md), [макеты](../design/identity-flow.md).

Доработки по review владельца D-34: имя userName, повтор нового пароля, живые правила без пробелов, единые inline errors и компактные переключатели реализованы на этой же ветке; [QA](../qa/identity-review-report.md), OpenAPI 0.6.0.

Результат:

- `/register`: имя + email + новый пароль/повтор → код → автоматический вход, безопасный returnTo/default account. До кода нет нового аккаунта. Resend, смена email, истечение, 409, field errors и Retry-After. Новый пароль по D-28/D-34, обычный login сохраняет прежние правила.
- `/password-reset`: email → нейтральный экран кода/нового пароля → подтверждённый успех с сообщением об отзыве сеансов → ссылка на обычный login. Resend тем же request endpoint, без раскрытия существования аккаунта и без автоматического входа.
- Шаги в памяти одной страницы, без отдельных confirm routes. Reload начинает сначала; это объяснено в форме. Пароль и код не сохраняются в URL/storage; mutation cache освобождается через reset/gcTime=0.
- Orval hooks по существующему OpenAPI 0.6.0, без новых backend endpoints/зависимостей. Общие поля identity в entities, компоненты Mantine в shared/ui, CSS tokens и RU/EN.

Приёмка: реальные browser → API → PostgreSQL/test inbox сценарии обоих путей; неправильные/старые коды, resend, duplicate email, отсутствие User до confirm, отзыв сеансов, старый/новый пароль. Unit правил/ошибок, types/build/format, mobile 360, обе темы/языка, отсутствие hydration errors. Ошибки 422/429/503 и неопределённый confirm проверяются отдельно с явной маркировкой UI fixtures. Потерянный confirm не повторять автоматически, предложить login с выбранным паролем.

Доказательства и ограничения: [QA](../qa/e1-04-identity-web-report.md), [локальная приёмка](../operations/web-identity.md). Production mail, согласия/юридические тексты, legacy Q-22, проекты и полный аудит доступности не входят; D-33 по next-intl сохраняется.
