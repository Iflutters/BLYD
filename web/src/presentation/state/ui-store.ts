import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { safeStorage } from '@/core/storage/safe-storage'
import type { ThemePreference } from '@/core/theme/theme'

/**
 * UI State (preferências locais de interface). Não guarda dados de domínio nem de servidor:
 * - Server state: TanStack Query;
 * - Session state: contexto de sessão (features/auth);
 * - Domain state: entidades vindas dos repositórios.
 *
 * A chave "kamban.ui" também é lida por public/theme-init.js (evita flash de tema).
 */
interface UiState {
  theme: ThemePreference
  sidebarCollapsed: boolean
  mobileNavOpen: boolean
  commandPaletteOpen: boolean
  setTheme: (theme: ThemePreference) => void
  toggleSidebar: () => void
  setMobileNavOpen: (open: boolean) => void
  setCommandPaletteOpen: (open: boolean) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'system',
      sidebarCollapsed: false,
      mobileNavOpen: false,
      commandPaletteOpen: false,
      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
      setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
    }),
    {
      name: 'kamban.ui',
      version: 1,
      storage: createJSONStorage(() => ({
        getItem: (key) => safeStorage.get(key),
        setItem: (key, value) => safeStorage.set(key, value),
        removeItem: (key) => safeStorage.remove(key),
      })),
      partialize: (s) => ({ theme: s.theme, sidebarCollapsed: s.sidebarCollapsed }),
    },
  ),
)
