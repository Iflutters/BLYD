import { useTranslation } from 'react-i18next'
import { KeyRound } from 'lucide-react'
import { cn } from '@/core/utils/cn'

/** "Esqueci minha senha" sem envio de e-mail configurado: quem troca a senha é o administrador. */
export function ContactAdminNotice({ className }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <div className={cn('flex gap-2.5 rounded-lg border border-border bg-warning-soft px-3 py-2.5 text-sm text-warning-soft-fg', className)}>
      <KeyRound className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        <p className="font-semibold">{t('auth.noEmail.title')}</p>
        <p className="mt-0.5">{t('auth.noEmail.description')}</p>
      </div>
    </div>
  )
}
