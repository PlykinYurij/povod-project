# Комплект web/API · E1-07

Это подготовка переносимой версии сервиса по [карточке](../product/e1-07.md), не деплой и не сборка каждого пользовательского приглашения. [Фактические проверки](../qa/e1-07-report.md).

## Что создаётся

`artifacts/<commit>-<platform>-<arch>-<run>-<attempt>/` содержит ровно `web.tar.gz`, `api.tar.gz`, `manifest.json`. CI-цель — Ubuntu 24.04 / Linux x64, Node 26.13.0. Node binary в комплект не входит; native-зависимости относятся к платформе сборки. Windows-комплект не становится Linux-комплектом при копировании.

Web — Next standalone с traced dependencies и .next/static; public добавляется, когда появится. API — готовый dist и production node_modules, установленные по исходному lockfile. Dev-зависимости и workspace-link на build-машину API не нужны. Env-файлы и выходящие за границы компонента symlink запрещены. Это ограниченная проверка известных опасных файлов, не универсальный сканер секретов.

Standalone включается только builder через POVOD_BUILD_KIT=1. Обычные npm run build / start:web продолжают работать с полной локальной .next, без предупреждения Next о несовместимом next start. Флаг меняет упаковку, не тексты/публичную конфигурацию приложения; для продвижения dev → prod используются одни и те же готовые архивы, флаг на сервере не нужен.

Manifest связывает source SHA, ref, run/attempt, target, pin npm, hash lockfile, размеры/digests web/api и фактические typecheck/build/runtimeSmoke. Только push принятого main создаёт `channel=candidate`; feature/PR/локальный run — `preview`. Candidate ещё не означает принятие на dev или разрешение production.

## Сборка и проверка

Из чистой ветки с зафиксированными Node/npm и доступным tar:

```powershell
npm run artifact:create
```

Builder берёт `git archive` точного HEAD в новую `.artifact-work` папку, устанавливает по lockfile, проверяет типы и собирает оба приложения. Никакие старые локальные dist/.next или untracked env не используются. Затем выполняется runtime smoke из распакованных архивов вне репозитория: зависимости не могут случайно разрешиться из исходного node_modules. Ни установка, ни build на месте smoke не выполняются. Промежуточные папки игнорируются Git, предыдущие комплекты не перезаписываются.

```powershell
npm run artifact:verify -- <каталог-комплекта> <полный-SHA-коммита> <доверенный-SHA256-manifest>
```

Для осмотра preview явно добавить `--allow-preview`. Verifier проверяет целостность, не запускает архивы. Перед распаковкой скачанного ZIP сверить его внешний SHA-256 с artifact digest из GitHub API/summary (`Get-FileHash <файл.zip> -Algorithm SHA256`); после распаковки ZIP проверить manifest и компоненты командой выше, и только затем распаковывать runtime tar. Значение manifest digest брать из доверенного summary конкретного CI run, а не вычислять заново по недоверенной загрузке. Также сверять artifact ID. Контрольные суммы не являются подписью или аттестацией: доверие опирается на принятый код/Actions и конкретный run/ID.

После проверки каждый tar распаковывается в свой новый каталог. Запуск готового web из каталога web: `node apps/web/server.js`; API из каталога api: `node apps/api/dist/main.js`. Для web задаются PORT и HOSTNAME=127.0.0.1; API использует PORT/localhost. Оба запускаются с NODE_ENV=production и установленной версией Node из manifest. На локальном компьютере остановить обычные dev-серверы или выбрать другие порты. Эти команды относятся к уже распакованным runtime, не заменяют обычный dev из README.

## CI и продвижение

Существующие Verify jobs выполняются на Windows/Linux, включая `npm test`. После них отдельный `Build kit (linux-x64)` собирает один комплект из того же commit и проверяет готовые runtimes. PR тоже проверяет сборку комплекта, но ничего не загружает. Push загружает immutable artifact v4 с уникальным run/attempt в имени, `overwrite=false`, без production-секретов и deploy. Предварительные Verify-builds служат проверками; продвигаемый runtime создаётся builder ровно один раз для своей identity.

Все три jobs назначены required checks основной ветки. Проверка runtime-комплекта поэтому нужна и для PR; существующий административный обход остаётся доступным, новых требований к числу ревью нет.

В summary записываются manifest hash, artifact ID, artifact digest и URL. Повтор job создаёт новую attempt/identity и не заменяет принятый ранее комплект. Для dev → prod позже используются те же байты и ID/digests, без сборки с другой env. Срок хранения Actions определяется настройкой GitHub, он не равен 90 дням приглашения и не гарантирует бессрочный архив релизов; перед E1-03/релизом нужно принять хранение кандидатов/rollback-комплектов. Истёкший artifact нельзя восстановить пересборкой и назвать тем же артефактом.

При появлении migrations/worker в отдельной задаче расширяются manifest и smoke; сейчас их нет. Подпись/attestation и защищённый release-store — последующее решение, не уже включённая функция.

Текущие API production-зависимости устанавливаются с `--ignore-scripts`. При добавлении Prisma/Argon2 и других пакетов с native engines/postinstall нужно отдельно проверить разрешённые lifecycle scripts и smoke нового runtime. Это не обещание совместимости будущих зависимостей без проверки.

Источники проверены 11 ноября 2026: [Next standalone](https://nextjs.org/docs/app/api-reference/config/next-config-js/output), [upload-artifact](https://github.com/actions/upload-artifact), [хранение и digests Actions](https://docs.github.com/en/actions/tutorials/store-and-share-data). Action закреплён по полному SHA v4.
