/** True only when the GoTrue public settings report the Google provider as enabled. */
export function googleHabilitado(settings: unknown): boolean {
  if (typeof settings !== 'object' || settings === null) return false
  const external = (settings as { external?: unknown }).external
  if (typeof external !== 'object' || external === null) return false
  return (external as { google?: unknown }).google === true
}
