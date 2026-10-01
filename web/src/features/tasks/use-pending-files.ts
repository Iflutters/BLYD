import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fileIssue, namePastedFile } from '@/domain/attachments'
import { notify } from '@/presentation/components'

export type PendingFileSource = 'paste' | 'drop' | 'pick'

/**
 * Arquivos que seguem com o texto (comentário da tarefa, atualização do quadro): colados (Ctrl+V),
 * soltos no campo ou escolhidos. Imagem colada ganha nome legível; o que a pré-checagem recusa
 * aparece num aviso com o motivo e não entra na lista.
 */
export function usePendingFiles() {
  const { t } = useTranslation()
  const [files, setFiles] = useState<File[]>([])

  function add(list: File[] | FileList | null, source: PendingFileSource = 'pick') {
    const now = new Date()
    const chosen = Array.from(list ?? []).map((file, index) => (source === 'paste' ? namePastedFile(file, t('attachments.pastedName'), now, index) : file))
    const accepted = chosen.filter((file) => {
      const issue = fileIssue(file)
      if (issue) notify.error(t('attachments.rejected', { name: file.name, reason: t(`validation.${issue}`) }))
      return !issue
    })
    if (accepted.length > 0) setFiles((current) => [...current, ...accepted])
  }

  return {
    files,
    add,
    remove: (index: number) => setFiles((current) => current.filter((_, i) => i !== index)),
    clear: () => setFiles([]),
  }
}
