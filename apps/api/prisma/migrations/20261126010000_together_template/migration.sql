INSERT INTO templates (id, category_id, title_ru, title_en)
VALUES ('vdvoem', 'wedding', 'Вдвоём', 'Together');

INSERT INTO template_versions (id, template_id, schema_version, renderer_key, defaults_version, available_for_new_projects)
VALUES ('wedding-together-v1', 'vdvoem', 1, 'together-v1', 1, false);
