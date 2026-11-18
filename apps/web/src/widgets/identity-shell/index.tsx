"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import tokens from "../../shared/ui/identity-tokens.module.css";
import { Preferences } from "./preferences";
import styles from "./identity-shell.module.css";

export function IdentityShell({
  children,
  account = false,
}: {
  children: ReactNode;
  account?: boolean;
}) {
  const t = useTranslations("Common");
  return (
    <main className={`${tokens.scope} ${styles.root}`}>
      <Preferences />
      {account ? (
        <section className={styles.dashboard}>{children}</section>
      ) : (
        <div className={styles.shell}>
          <aside className={styles.story}>
            <Link href="/" className={styles.brand}>
              {t("brand")}
            </Link>
            <div>
              <svg
                viewBox="0 0 220 200"
                className={styles.bloom}
                aria-hidden="true"
              >
                <g fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M110 190V75M110 142Q40 143 45 90Q110 97 110 142M110 165Q180 159 179 107Q112 118 110 165" />
                  <ellipse cx="110" cy="42" rx="23" ry="35" />
                  <ellipse
                    cx="110"
                    cy="42"
                    rx="23"
                    ry="35"
                    transform="rotate(60 110 72)"
                  />
                  <ellipse
                    cx="110"
                    cy="42"
                    rx="23"
                    ry="35"
                    transform="rotate(-60 110 72)"
                  />
                </g>
              </svg>
              <h2 className={styles.storyTitle}>{t("story")}</h2>
              <p className={styles.muted}>{t("storyText")}</p>
            </div>
            <span className={styles.caption}>{t("caption")}</span>
          </aside>
          <section className={styles.content}>
            <div className={styles.topbar}>
              <Link href="/" className={styles.brand}>
                {t("brand")}
              </Link>
              <span className={styles.muted}>{t("account")}</span>
            </div>
            {children}
          </section>
        </div>
      )}
    </main>
  );
}
