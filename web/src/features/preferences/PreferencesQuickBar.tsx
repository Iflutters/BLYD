import { Monitor, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES, isSupportedLanguage } from '@/core/i18n'
import { AppIconButton, AppSelect } from '@/presentation/components'
import { useUiStore } from '@/presentation/state/ui-store'
import { usePreferences } from './use-preferences'

const NEXT_THEME = { light: 'dark', dark: 'system', system: 'light' } as const

/** Seletor compacto de idioma e tema (telas públicas, ex.: login). */
export function PreferencesQuickBar() {
  const { t, i18n } = useTranslation()
  const theme = useUiStore((s) => s.theme)
  const { changeTheme, changeLanguage } = usePreferences()
  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor

  return (
    <div className="flex items-center gap-1">
      <AppSelect
        size="sm"
        aria-label={t('language.label')}
        value={i18n.language}
        onValueChange={(value) => isSupportedLanguage(value) && changeLanguage(value)}
        options={SUPPORTED_LANGUAGES.map((lng) => ({ value: lng, label: t(`language.${lng}`) }))}
        triggerClassName="w-44 border-transparent bg-transparent shadow-none"
      />
      <AppIconButton
        label={`${t('theme.label')}: ${t(`theme.${theme}`)}`}
        icon={<Icon />}
        onClick={() => changeTheme(NEXT_THEME[theme])}
      />
    </div>
  )
}
