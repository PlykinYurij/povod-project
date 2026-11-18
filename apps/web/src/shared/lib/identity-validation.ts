/** D-28: spaces are permitted, but do not count as the required special character. */
export function validNewPassword(value: string): boolean {
  return (
    /^[\x20-\x7e]{8,128}$/.test(value) &&
    /[A-Z]/.test(value) &&
    /[0-9]/.test(value) &&
    /[^A-Za-z0-9 ]/.test(value)
  );
}

export function validEmailCode(value: string): boolean {
  return /^[0-9]{6}$/.test(value);
}
