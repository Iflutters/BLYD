/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Versão do produto, gravada no build (vite.config.ts). */
declare const __APP_VERSION__: string
