/** Build flag: when `VITE_RED_MUSICOS=true`, the musician network (Etapa 3) is visible to everyone. */
export const RED_MUSICOS_FLAG = import.meta.env.VITE_RED_MUSICOS === 'true'

/** The musician network is visible when the build flag is on, or to admins otherwise. */
export function redMusicosVisible({ flag, isAdmin }: { flag: boolean; isAdmin: boolean }): boolean {
  return flag || isAdmin
}
