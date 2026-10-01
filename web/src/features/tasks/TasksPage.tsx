import { useState } from 'react'
import { useSearchParams } from 'react-router'
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
  // vindo da command palette: /tasks?new=1 abre o formulário; /tasks?search=… já busca
  const [params, setParams] = useSearchParams()
  const creatingFromUrl = canCreate && params.get('new') === '1'
  const search = params.get('search')
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
      <TasksTable tableId="tasks" search={search} onSearchApplied={() => setParams({}, { replace: true })} />
      <TaskFormDialog
        open={creating || creatingFromUrl}
        onOpenChange={(open) => {
          setCreating(open)
          if (!open && params.has('new')) setParams({}, { replace: true })
        }}
      />
    </>
  )
}
