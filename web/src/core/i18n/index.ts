import i18n, { type BackendModule } from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import ptBR from './locales/pt-BR.json'

export const SUPPORTED_LANGUAGES = ['pt-BR', 'en', 'es'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]
export const DEFAULT_LANGUAGE: Language = 'pt-BR'
export const LANGUAGE_STORAGE_KEY = 'kamban.lang'

export function isSupportedLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
}

/**
 * pt-BR (padrão e idioma de reserva) vai no pacote inicial; os demais são carregados sob demanda
 * (cada um ~60 kB), só quando escolhidos.
 */
const LAZY_LOCALES: Record<string, () => Promise<{ default: Record<string, unknown> }>> = {
  en: () => import('./locales/en.json'),
  es: () => import('./locales/es.json'),
}

const lazyLocales: BackendModule = {
  type: 'backend',
  init: () => {},
  read: (language, _namespace, callback) => {
    const load = LAZY_LOCALES[language]
    if (!load) return callback(null, {})
    load()
      .then((module) => callback(null, module.default))
      .catch((error: unknown) => callback(error instanceof Error ? error : new Error(String(error)), false))
  },
}

/** Resolve quando o idioma inicial está carregado (a aplicação só desenha depois disso). */
export const i18nReady = i18n
  .use(lazyLocales)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { 'pt-BR': { translation: ptBR } },
    partialBundledLanguages: true,
    react: { useSuspense: false },
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    load: 'currentOnly',
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
      convertDetectedLanguage: (lng: string) => {
        if (isSupportedLanguage(lng)) return lng
        const base = lng.split('-')[0]
        if (base === 'pt') return 'pt-BR'
        return isSupportedLanguage(base) ? base : DEFAULT_LANGUAGE
      },
    },
    interpolation: { escapeValue: false }, // React já escapa
    returnNull: false,
  })

function syncDocumentLanguage(lng: string) {
  if (typeof document !== 'undefined') document.documentElement.lang = lng
}
syncDocumentLanguage(i18n.language)
i18n.on('languageChanged', syncDocumentLanguage)

export function currentLanguage(): Language {
  return isSupportedLanguage(i18n.language) ? i18n.language : DEFAULT_LANGUAGE
}

export default i18n
