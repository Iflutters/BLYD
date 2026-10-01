import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { logoFor } from '@/domain/platform'
import { usePlatformInfo } from '@/presentation/common/use-platform'
import { BrandMark } from '@/presentation/navigation/Sidebar'
import { PreferencesQuickBar } from '@/features/preferences/PreferencesQuickBar'
import { AuthHero } from './AuthHero'

/** Moldura das telas sem sessão (login, esqueci minha senha, nova senha): painel da marca + conteúdo. */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  const { t } = useTranslation()
  const platform = usePlatformInfo()
  // o painel lateral tem fundo da marca (escuro): usa a versão escura do logo
  const heroLogo = logoFor(platform, 'dark')

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.15fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-brand-gradient px-10 py-8 text-on-cover lg:flex lg:flex-col lg:justify-between lg:gap-8 xl:px-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,var(--kb-on-cover)_1px,transparent_1px)] [background-size:28px_28px]"
        />
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 size-96 rounded-full bg-on-cover/10 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-24 size-[28rem] rounded-full bg-on-cover/10 blur-3xl" />
        <div className="relative flex items-center gap-2.5">
          <img src={heroLogo} alt="" className="size-10 object-contain" />
          <span className="text-lg font-semibold tracking-tight">{platform.name}</span>
        </div>
        <AuthHero />
        <p className="relative text-sm text-on-cover-muted">
          © {new Date().getFullYear()} {platform.name}
        </p>
      </aside>

      <main className="relative flex flex-col items-center justify-center px-4 py-10 sm:px-6">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-subtle-gradient" />
        <div className="absolute right-4 top-4">
          <PreferencesQuickBar />
        </div>
        <div className="relative w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <BrandMark />
            <p className="mt-3 text-sm text-muted">{t('auth.heroTitle')}</p>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
          {children}
        </div>
      </main>
    </div>
  )
}
