import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { AppButton } from '@/presentation/components'
import { PageHeader } from '@/presentation/layouts/PageHeader'
import { useDocumentTitle } from '@/presentation/common/use-document-title'
import { useCan } from '@/features/auth/session'
import { TaskFormDialog } from './TaskFormDialog'
import { TasksTable } from './TasksTable'

export function TasksPage() {
  const { t } = useTranslation()
  const canCreate = useCan('tasks.create')
  const [creating, setCreating] = useState(false)
  useDocumentTitle(t('tasks.title'))

  return (
    <>
      <PageHeader
        title={t('tasks.title')}
        description={t('tasks.description')}
        actions={
          canCreate && (
            <AppButton leftIcon={<Plus />} onClick={() => setCreating(true)}>
              {t('tasks.create')}
            </AppButton>
          )
        }
      />
      <TasksTable tableId="tasks" />
      <TaskFormDialog open={creating} onOpenChange={setCreating} />
    </>
  )
}
