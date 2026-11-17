export const TEST_ORIGIN = "http://127.0.0.1:3000";
export function mergeCookies(previous: string, response: Response): string {
  const entries = new Map(
    previous
      .split(/;\s*/)
      .filter(Boolean)
      .map((pair) => {
        const split = pair.indexOf("=");
        return [pair.slice(0, split), pair.slice(split + 1)];
      }),
  );
  for (const line of response.headers.getSetCookie()) {
    const pair = line.split(";", 1)[0];
    const split = pair.indexOf("=");
    const name = pair.slice(0, split);
    if (/Max-Age=0(?:;|$)/i.test(line)) entries.delete(name);
    else entries.set(name, pair.slice(split + 1));
  }
  return [...entries].map(([key, value]) => `${key}=${value}`).join("; ");
}
export async function csrfHeaders(url: string, cookies = "") {
  const response = await fetch(`${url}/api/v1/auth/csrf`, {
    headers: { Cookie: cookies, Origin: TEST_ORIGIN },
  });
  if (!response.ok) throw new Error("CSRF fixture failed");
  const payload = (await response.json()) as { csrfToken: string };
  return {
    Cookie: mergeCookies(cookies, response),
    "X-CSRF-Token": payload.csrfToken,
  };
}
