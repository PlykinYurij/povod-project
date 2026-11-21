BEGIN;

CREATE TABLE "template_categories" (
  "id" VARCHAR(64) PRIMARY KEY,
  "title_ru" VARCHAR(80) NOT NULL,
  "title_en" VARCHAR(80) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE "templates" (
  "id" VARCHAR(64) PRIMARY KEY,
  "category_id" VARCHAR(64) NOT NULL REFERENCES "template_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "title_ru" VARCHAR(80) NOT NULL,
  "title_en" VARCHAR(80) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "price_minor" INTEGER CHECK ("price_minor" >= 0),
  "currency" VARCHAR(3) NOT NULL DEFAULT 'RUB' CHECK ("currency" = 'RUB'),
  "price_version" INTEGER NOT NULL DEFAULT 1 CHECK ("price_version" > 0)
);
CREATE INDEX "templates_category_id_active_idx" ON "templates"("category_id", "active");

CREATE TABLE "template_versions" (
  "id" TEXT PRIMARY KEY,
  "template_id" VARCHAR(64) NOT NULL REFERENCES "templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "schema_version" INTEGER NOT NULL CHECK ("schema_version" > 0),
  "renderer_key" TEXT NOT NULL,
  "defaults_version" INTEGER NOT NULL CHECK ("defaults_version" > 0),
  "available_for_new_projects" BOOLEAN NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX "template_versions_template_id_schema_version_key" ON "template_versions"("template_id", "schema_version");
CREATE UNIQUE INDEX "template_versions_one_available_per_template" ON "template_versions"("template_id") WHERE "available_for_new_projects";

INSERT INTO "template_categories" ("id", "title_ru", "title_en") VALUES
  ('wedding', 'Свадьба', 'Wedding'),
  ('birthday', 'День рождения', 'Birthday'),
  ('gender-party', 'Гендер-пати', 'Gender reveal');

-- No approved commercial price yet. NULL means unconfigured, never free.
INSERT INTO "templates" ("id", "category_id", "title_ru", "title_en")
VALUES ('quiet-garden', 'wedding', 'Тихий сад', 'Quiet Garden');
INSERT INTO "template_versions" ("id", "template_id", "schema_version", "renderer_key", "defaults_version", "available_for_new_projects")
VALUES ('wedding-garden-v1', 'quiet-garden', 1, 'garden-v1', 1, true);

-- Preserve existing content, version identifiers, revisions and creation keys.
ALTER TABLE "projects" ADD CONSTRAINT "projects_template_version_id_fkey"
FOREIGN KEY ("template_version_id") REFERENCES "template_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
