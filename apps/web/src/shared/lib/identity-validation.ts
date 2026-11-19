export function passwordRules(value: string) {
  return {
    length: value.length >= 8 && value.length <= 128,
    latin: value.length > 0 && /^[\x20-\x7e]+$/.test(value),
    uppercase: /[A-Z]/.test(value),
    digit: /[0-9]/.test(value),
    special: /[^A-Za-z0-9\s]/.test(value),
    noSpaces: value.length > 0 && !/\s/.test(value),
  };
}

/** New passwords only. Login deliberately accepts existing passwords unchanged. */
export function validNewPassword(value: string): boolean {
  return Object.values(passwordRules(value)).every(Boolean);
}

export function validEmailCode(value: string): boolean {
  return /^[0-9]{6}$/.test(value);
}

export function validEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function validDisplayName(value: string): boolean {
  const name = value.trim();
  return (
    name.length > 0 &&
    Array.from(name).length <= 80 &&
    !/[\x00-\x1f\x7f-\x9f\u2028\u2029]/.test(name)
  );
}

export function passwordsMatch(
  password: string,
  confirmation: string,
): boolean {
  return confirmation.length > 0 && password === confirmation;
}
