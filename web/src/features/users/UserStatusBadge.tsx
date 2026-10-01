import { useTranslation } from 'react-i18next'
import type { UserStatus } from '@/domain/entities'
import { AppBadge } from '@/presentation/components'

export function UserStatusBadge({ status }: { status: UserStatus }) {
  const { t } = useTranslation()
  return (
    <AppBadge tone={status === 'active' ? 'success' : 'neutral'} dot>
      {t(`users.status.${status}`)}
    </AppBadge>
  )
}
