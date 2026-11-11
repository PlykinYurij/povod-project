import { spawn } from "node:child_process";
import { mkdir, mkdtemp } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

const exec = promisify(execFile);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Cannot allocate smoke port");
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

async function responseAt(url, child) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.spawnError) throw child.spawnError;
    if (child.exitCode !== null)
      throw new Error(`Runtime exited before HTTP smoke: ${child.exitCode}`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return response;
    } catch {}
    await delay(200);
  }
  throw new Error("Runtime HTTP smoke timed out");
}

export async function smokeRuntime(directory) {
  // Outside the repository: missing runtime dependencies cannot resolve from its node_modules.
  const extracted = await mkdtemp(path.join(os.tmpdir(), "povod-kit-smoke-"));
  for (const component of ["web", "api"]) {
    const destination = path.join(extracted, component);
    await mkdir(destination);
    await exec("tar", [
      "-xzf",
      path.join(directory, `${component}.tar.gz`),
      "-C",
      destination,
    ]);
  }
  const children = [];
  try {
    const ports = { web: await freePort(), api: await freePort() };
    while (ports.api === ports.web) ports.api = await freePort();
    for (const component of ["web", "api"]) {
      const root = path.join(extracted, component);
      const entry =
        component === "web" ? "apps/web/server.js" : "apps/api/dist/main.js";
      const child = spawn(process.execPath, [entry], {
        cwd: root,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          NODE_ENV: "production",
          NODE_PATH: "",
          PORT: String(ports[component]),
          HOSTNAME: "127.0.0.1",
        },
      });
      child.once("error", (error) => {
        child.spawnError = error;
      });
      child.stdout.resume();
      child.stderr.pipe(process.stderr);
      children.push(child);
    }
    const webUrl = `http://127.0.0.1:${ports.web}`;
    const health = await responseAt(
      `http://127.0.0.1:${ports.api}/health`,
      children[1],
    );
    if (
      !health.headers.get("content-type")?.includes("application/json") ||
      (await health.text()) !== '{"status":"ok"}'
    ) {
      throw new Error("Unexpected health response from artifact");
    }
    const web = await responseAt(webUrl, children[0]);
    const html = await web.text();
    if (!html.includes("Повод"))
      throw new Error("Web artifact did not render the page");
    const css = html.match(/href="([^\"]+\.css[^\"]*)"/);
    if (!css) throw new Error("Web artifact stylesheet missing");
    const stylesheet = new URL(css[1], webUrl);
    if (stylesheet.origin !== webUrl || !(await fetch(stylesheet)).ok)
      throw new Error("Web artifact static asset missing");
    return { web: 200, health: 200, staticAsset: 200 };
  } finally {
    await Promise.all(
      children.map(
        (child) =>
          new Promise((resolve) => {
            if (!child.pid || child.exitCode !== null) return resolve();
            const timeout = setTimeout(() => child.kill("SIGKILL"), 5000);
            child.once("exit", () => {
              clearTimeout(timeout);
              resolve();
            });
            child.kill();
          }),
      ),
    );
  }
}
