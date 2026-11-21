export function trimContact(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

export function normalizePhone(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const phone = value.trim().replace(/[\p{Zs}()-]/gu, "");
  return /^[78]\d{10}$/.test(phone) ? `+7${phone.slice(1)}` : phone;
}
