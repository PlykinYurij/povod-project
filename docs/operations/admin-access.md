# Локальный доступ администратора

E2-02d: [карточка](../product/e2-02d-admin-access.md), [QA](../qa/e2-02d-admin-access-report.md). Это local dev/test, не production-инструкция.

Из корня PowerShell:

```powershell
npm run db:migrate:dev
npm run dev:api:database
# В другом терминале
npm run dev:web
```

Сначала зарегистрируйте собственный dev-аккаунт и подтвердите код из локального inbox по [регистрации](registration-confirmation.md). UUID берётся из собственного GET /api/v1/auth/session (поле user.id). Скрипт не регистрирует пользователя и не назначает права по email/env автоматически.

```powershell
node scripts/admin-role.mjs grant dev USER_UUID
node scripts/admin-role.mjs revoke dev USER_UUID
```

USER_UUID заменить на UUID этого аккаунта. Эти две команды реально проверены на отдельных синтетических аккаунтах с target test; права существующих dev-аккаунтов агентом не менялись. При grant повтор не создаёт пользователя и возвращает changed=false, при revoke следующий запрос с прежней сессией уже получает 403. Тело команды содержит только UUID/роль, без пароля/email/секретов. Не копировать cookies в Git/логи.

Проверка HTTP: в той же браузерной dev-сессии вызвать GET http://127.0.0.1:3001/api/v1/admin/access с credentials include. Обычный пользователь — 403, после grant — 200 и role ADMIN, после revoke — 403, без сессии — 401. Полноценной страницы /admin пока нет; этот endpoint — проверка входа в будущий приватный раздел, не обещание готовых заявок.

Скрипт допускает только loopback povod_dev/povod_test с соответствующей непривилегированной SQL-ролью; NODE_ENV=production отказывает. Не принимает произвольный database URL CLI-флагом. Для test используется существующий тестовый конфиг/явный test target. Ошибки выводятся без raw pg details, URL и секретов.

Перед production нужен отдельный защищённый процесс назначения первого администратора, проверки полномочий, устойчивый аудит выдачи/отзыва и восстановления доступа; локальный скрипт не распространяется на удалённую среду. HTTP mutation use cases должны проверять право повторно в транзакции и вести свой audit. Роль сама по себе не даёт обхода текущего owner check /projects.
