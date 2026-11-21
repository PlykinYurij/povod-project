"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useGetProjects } from "@shared/api";
import { Alert, Button, Stack, Text, Title } from "@shared/ui";
import styles from "../account.module.css";

export function AccountProjects() {
  const t = useTranslations("Projects");
  const account = useTranslations("Account");
  const projects = useGetProjects();

  return (
    <Stack
      component="section"
      className={styles.empty}
      aria-labelledby="projects-title"
    >
      <Title id="projects-title" order={2}>
        {t("list")}
      </Title>
      {projects.isPending && <Text role="status">{t("loading")}</Text>}
      {projects.isError && (
        <Alert color="red" role="alert">
          <Stack align="start">
            <Text>{t("listError")}</Text>
            <Button variant="default" onClick={() => void projects.refetch()}>
              {t("retry")}
            </Button>
          </Stack>
        </Alert>
      )}
      {projects.isSuccess &&
        (projects.data.items.length === 0 ? (
          <Text>{account("empty")}</Text>
        ) : (
          <Stack component="ul" className={styles.projectList}>
            {projects.data.items.map((project) => (
              <li key={project.id}>
                <Text fw={600}>{project.title}</Text>
                {project.firstPublishedAt === null && (
                  <Text size="sm">{t("draft")}</Text>
                )}
              </li>
            ))}
          </Stack>
        ))}
      <Button
        component={Link}
        href="/templates"
        variant="light"
        w="fit-content"
      >
        {t("catalog")}
      </Button>
    </Stack>
  );
}
