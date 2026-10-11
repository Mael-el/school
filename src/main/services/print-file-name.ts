/** Safe, readable default name for a generated PDF. */
export function slugFilePart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function pdfFileName(
  ...parts: Array<string | number | null | undefined>
): string {
  const slug = parts
    .map((part) => (part == null ? '' : String(part).trim()))
    .filter(Boolean)
    .map(slugFilePart)
    .filter(Boolean)
    .join('_');
  return `${slug || 'document'}.pdf`;
}
