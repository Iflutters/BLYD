import { useState } from 'react'
import { isAppError } from '@/core/errors/app-error'
import { fileIssue } from '@/domain/attachments'
import { useErrorMessage } from '@/presentation/common/use-error-message'
import { compressImage } from './image-compress'
import { useAttachmentMutations } from './queries'

export interface PendingUpload {
  key: string
  name: string
  /** Código de erro (validation.*) ou mensagem já traduzida; ausente = enviando. */
  error?: string
}

let uploadSeq = 0

/**
 * Envio de arquivos (anexos da tarefa, arquivos do elemento do quadro): pré-checagem no navegador,
 * compressão de fotos grandes e um arquivo por requisição. Os erros ficam por arquivo.
 */
export function useFileUploader<O>(upload: (file: File, options?: O) => Promise<unknown>) {
  const errorMessage = useErrorMessage()
  const [pending, setPending] = useState<PendingUpload[]>([])

  /** Envia e devolve quantos arquivos foram aceitos. */
  async function send(files: File[], options?: O): Promise<number> {
    let sent = 0
    for (const original of files) {
      const key = `u${++uploadSeq}`
      const issue = fileIssue(original)
      if (issue) {
        setPending((p) => [...p, { key, name: original.name, error: issue }])
        continue
      }
      setPending((p) => [...p, { key, name: original.name }])
      try {
        const file = original.type.startsWith('image/') ? await compressImage(original) : original
        await upload(file, options)
        sent++
        setPending((p) => p.filter((item) => item.key !== key))
      } catch (error) {
        const code = isAppError(error) && error.code === 'VALIDATION_ERROR' ? (error.fieldErrors().files ?? 'invalid_file') : errorMessage(error)
        setPending((p) => p.map((item) => (item.key === key ? { ...item, error: code } : item)))
      }
    }
    return sent
  }

  const dismiss = (key: string) => setPending((p) => p.filter((item) => item.key !== key))

  return { pending, send, dismiss, uploading: pending.some((p) => !p.error) }
}

/** Anexos da tarefa (aba Anexos e comentários). */
export function useAttachmentUploader(taskId: string) {
  const { upload } = useAttachmentMutations(taskId)
  return useFileUploader<{ commentId?: string; field?: string }>((file, options) => upload.mutateAsync({ file, ...options }))
}
