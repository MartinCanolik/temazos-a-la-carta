import { useAuth } from '@/auth/authContext'
import { RED_MUSICOS_FLAG, redMusicosVisible } from '@/lib/features'

/** Whether the musician network (Etapa 3) is visible for the current viewer. */
export function useRedMusicos(): boolean {
  const { isAdmin } = useAuth()
  return redMusicosVisible({ flag: RED_MUSICOS_FLAG, isAdmin })
}
