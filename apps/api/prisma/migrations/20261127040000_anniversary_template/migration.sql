INSERT INTO templates (id, category_id, title_ru, title_en)
VALUES ('anniversary', 'birthday', 'Письмо о юбилее', 'Anniversary Letter');

INSERT INTO template_versions (id, template_id, schema_version, renderer_key, defaults_version, available_for_new_projects)
VALUES ('birthday-anniversary-v1', 'anniversary', 1, 'anniversary-v1', 1, false);
