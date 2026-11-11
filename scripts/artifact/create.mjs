import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  appendFile,
  cp,
  mkdir,
  readFile,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkRuntimeFiles, sha256, verifyBundle } from "./integrity.mjs";
import { smokeRuntime } from "./runtime-smoke.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const git = (...args) =>
  execFileSync(
    "git",
    [
      "-c",
      `safe.directory=${root.replaceAll("\\", "/").replace(/\/$/, "")}`,
      ...args,
    ],
    { cwd: root, encoding: "utf8" },
  ).trim();
function npm(args, cwd, environment = {}) {
  if (!process.env.npm_execpath)
    throw new Error("Run via npm run artifact:create");
  const result = spawnSync(
    process.execPath,
    [process.env.npm_execpath, ...args],
    {
      cwd,
      stdio: "inherit",
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", ...environment },
    },
  );
  if (result.error || result.status !== 0)
    throw new Error(`npm ${args.join(" ")} failed`);
}

async function main() {
  if (git("status", "--porcelain"))
    throw new Error(
      "Commit changes first: artifact source must be a clean commit",
    );
  const sha = git("rev-parse", "HEAD");
  if (process.env.GITHUB_SHA && process.env.GITHUB_SHA !== sha)
    throw new Error("Checkout SHA differs from workflow SHA");
  const project = JSON.parse(
    await readFile(path.join(root, "package.json"), "utf8"),
  );
  if (process.versions.node !== project.engines.node)
    throw new Error("Build Node version differs from project pin");
  const run = process.env.GITHUB_RUN_ID ?? `local-${randomUUID()}`;
  const attempt = process.env.GITHUB_RUN_ATTEMPT ?? "1";
  if (!/^(\d+|local-[a-f0-9-]+)$/.test(run) || !/^\d+$/.test(attempt))
    throw new Error("Invalid build identity");
  const identity = `${sha}-${process.platform}-${process.arch}-${run}-${attempt}`;
  const working = path.join(root, ".artifact-work", identity);
  const output = path.join(root, "artifacts", identity);
  await mkdir(path.dirname(working), { recursive: true });
  await mkdir(path.dirname(output), { recursive: true });
  await mkdir(working); // Exclusive identity: never overwrite a previous kit.
  await mkdir(output);
  const source = path.join(working, "source");
  await mkdir(source);
  const sourceTar = path.join(working, "source.tar");
  execFileSync(
    "git",
    [
      "-c",
      `safe.directory=${root.replaceAll("\\", "/").replace(/\/$/, "")}`,
      "archive",
      "--format=tar",
      `--output=${sourceTar}`,
      sha,
    ],
    { cwd: root },
  );
  execFileSync("tar", ["-xf", sourceTar, "-C", source]);
  npm(["ci", "--no-fund"], source);
  npm(["run", "typecheck"], source);
  npm(["run", "build"], source, { POVOD_BUILD_KIT: "1" });

  const web = path.join(working, "web");
  await cp(path.join(source, "apps/web/.next/standalone"), web, {
    recursive: true,
    verbatimSymlinks: true,
  });
  await cp(
    path.join(source, "apps/web/.next/static"),
    path.join(web, "apps/web/.next/static"),
    { recursive: true },
  );
  if (existsSync(path.join(source, "apps/web/public"))) {
    await cp(
      path.join(source, "apps/web/public"),
      path.join(web, "apps/web/public"),
      { recursive: true },
    );
  }
  const api = path.join(working, "api");
  for (const file of [
    "package.json",
    "package-lock.json",
    ".npmrc",
    "apps/api/package.json",
    "apps/web/package.json",
  ]) {
    await mkdir(path.dirname(path.join(api, file)), { recursive: true });
    await cp(path.join(source, file), path.join(api, file));
  }
  npm(
    [
      "ci",
      "--omit=dev",
      "--ignore-scripts",
      "--workspace=@povod/api",
      "--include-workspace-root=false",
      "--no-fund",
    ],
    api,
  );
  await unlink(path.join(api, ".npmrc"));
  // The runtime starts via its entry file, so the build-machine workspace link is unnecessary.
  await unlink(path.join(api, "node_modules/@povod/api"));
  await cp(
    path.join(source, "apps/api/dist"),
    path.join(api, "apps/api/dist"),
    { recursive: true },
  );
  const components = {};
  for (const [component, directory] of Object.entries({ web, api })) {
    await checkRuntimeFiles(directory);
    const file = `${component}.tar.gz`;
    execFileSync("tar", [
      "-czf",
      path.join(output, file),
      "-C",
      directory,
      ".",
    ]);
    components[component] = {
      file,
      sha256: await sha256(path.join(output, file)),
      bytes: (await stat(path.join(output, file))).size,
    };
  }
  const smoke = await smokeRuntime(output);
  const manifest = {
    schemaVersion: 1,
    source: {
      sha,
      ref: process.env.GITHUB_REF ?? git("branch", "--show-current"),
      runId: run,
      runAttempt: attempt,
    },
    channel:
      process.env.GITHUB_ACTIONS === "true" &&
      process.env.GITHUB_REF === "refs/heads/main"
        ? "candidate"
        : "preview",
    target: {
      platform: process.platform,
      arch: process.arch,
      node: process.versions.node,
    },
    toolchain: { npm: project.packageManager },
    lockfileSha256: await sha256(path.join(source, "package-lock.json")),
    checks: { typecheck: "passed", build: "passed", runtimeSmoke: "passed" },
    smoke,
    components,
  };
  const manifestFile = path.join(output, "manifest.json");
  await writeFile(manifestFile, JSON.stringify(manifest, null, 2) + "\n");
  const digest = await sha256(manifestFile);
  await verifyBundle(output, sha, digest, { allowPreview: true });
  if (process.env.GITHUB_OUTPUT)
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `path=artifacts/${identity}\nname=povod-${identity}\nmanifest-sha256=${digest}\n`,
    );
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `## Build kit\n\nSource: \`${sha}\`\n\nTarget: ${process.platform}/${process.arch}, Node ${process.versions.node}\n\nChannel: ${manifest.channel}\n\nManifest SHA-256: \`${digest}\`\n\nTypecheck, build, isolated runtime HTTP/static smoke: passed.\n`,
    );
  }
  console.log(
    JSON.stringify(
      { output, sha, manifestSha256: digest, channel: manifest.channel, smoke },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
