const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/

/** Máscara HH:mm (insere ":" automaticamente). */
export function maskTime(text: string): string {
  const digits = text.replace(/[^0-9]/g, '').slice(0, 4)
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits
}

export function isValidTime(value: string): boolean {
  return TIME.test(value)
}
