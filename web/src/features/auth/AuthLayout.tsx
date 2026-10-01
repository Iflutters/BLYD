import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { logoFor } from '@/domain/platform'
import { usePlatformInfo } from '@/presentation/common/use-platform'
import { BrandMark } from '@/presentation/navigation/Sidebar'
import { PreferencesQuickBar } from '@/features/preferences/PreferencesQuickBar'

/** Moldura das telas sem sessão (login, esqueci minha senha, nova senha): painel da marca + conteúdo. */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  const { t } = useTranslation()
  const platform = usePlatformInfo()
  // o painel lateral tem fundo da marca (escuro): usa a versão escura do logo
  const heroLogo = logoFor(platform, 'dark')

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-brand-gradient p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,white_1px,transparent_1px)] [background-size:28px_28px]"
        />
        <div className="relative flex items-center gap-2.5">
          <img src={heroLogo} alt="" className="size-10 object-contain" />
          <span className="text-lg font-semibold tracking-tight">{platform.name}</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">{t('auth.heroTitle')}</h2>
          <p className="mt-3 text-base text-white/80">{t('auth.heroSubtitle')}</p>
        </div>
        <p className="relative text-sm text-white/60">
          © {new Date().getFullYear()} {platform.name}
        </p>
      </aside>

      <main className="relative flex flex-col items-center justify-center px-4 py-10 sm:px-6">
        <div className="absolute right-4 top-4">
          <PreferencesQuickBar />
        </div>
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <BrandMark />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
          {children}
        </div>
      </main>
    </div>
  )
}
