import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { FolderOpen, FolderPlus, Languages, LogOut, Monitor, Moon, Plus, Search, Sun, UserSearch } from 'lucide-react'
import { SUPPORTED_LANGUAGES } from '@/core/i18n'
import { AppCommandPalette, modKey, type CommandGroup } from '@/presentation/components'
import { useHotkey } from '@/presentation/common/use-hotkey'
import { useUiStore } from '@/presentation/state/ui-store'
import { useLogout, useSession } from '@/features/auth/session'
import { usePreferences } from '@/features/preferences/use-preferences'
import { useProjects } from '@/features/projects/queries'
import { useDebouncedValue } from '@/presentation/common/use-debounced-value'
import { NAV_ITEMS, visibleNavItems, type NavItem } from './nav-items'

function flatten(items: NavItem[]): NavItem[] {
  // Filhos herdam o ícone do grupo; itens com o mesmo destino aparecem uma vez só.
  return items
    .flatMap((item) => (item.children ? [item, ...item.children.map((child) => ({ ...child, icon: child.icon ?? item.icon }))] : [item]))
    .filter((item, i, all) => all.findIndex((x) => x.to === item.to) === i)
}

/** Command Palette global (Ctrl/⌘ + K): navegação, ações e preferências. */
export function CommandPalette() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const open = useUiStore((s) => s.commandPaletteOpen)
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen)
  const { current } = useSession()
  const logout = useLogout()
  const { changeTheme, changeLanguage } = usePreferences()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search.trim(), 250)
  const canViewProjects = !!current?.permissions.includes('projects.view')
  const projectResults = useProjects(
    { view: 'all', page: 1, perPage: 6, sort: { id: 'name', direction: 'asc' }, search: debouncedSearch, filters: {} },
    open && canViewProjects,
  )
  const projectItems = projectResults.data?.items

  useHotkey('k', () => setOpen(!useUiStore.getState().commandPaletteOpen), { mod: true, allowInInputs: true })

  const permissions = current?.permissions
  const groups = useMemo<CommandGroup[]>(() => {
    const nav = flatten(visibleNavItems(permissions ?? [], NAV_ITEMS))
    const canViewUsers = permissions?.includes('users.view')
    const canCreateTasks = permissions?.includes('tasks.create')
    const canCreateProjects = permissions?.includes('projects.create')
    const query = search.trim()

    return [
      {
        heading: t('commandPalette.actions'),
        items: [
          ...(canCreateProjects
            ? [{ id: 'create-project', label: t('commandPalette.createProject'), icon: <FolderPlus />, onSelect: () => navigate('/projects?new=1') }]
            : []),
          ...(canCreateTasks
            ? [{ id: 'create-task', label: t('commandPalette.createTask'), icon: <Plus />, hint: t('nav.soon'), disabled: true, onSelect: () => {} }]
            : []),
          { id: 'search-task', label: t('commandPalette.searchTask'), icon: <Search />, hint: t('nav.soon'), disabled: true, onSelect: () => {} },
          ...(canViewUsers
            ? [
                {
                  id: 'search-user',
                  label: query ? t('commandPalette.searchUserFor', { query }) : t('commandPalette.searchUser'),
                  icon: <UserSearch />,
                  keywords: ['usuário', 'user', 'usuario', query],
                  onSelect: () => navigate(query ? `/users?search=${encodeURIComponent(query)}` : '/users'),
                },
              ]
            : []),
        ],
      },
      {
        heading: t('commandPalette.projects'),
        items: (projectItems ?? []).map((project) => ({
          id: `project-${project.id}`,
          label: `${project.key} · ${project.name}`,
          icon: <FolderOpen />,
          keywords: [project.key, project.name, query],
          onSelect: () => navigate(`/projects/${project.id}`),
        })),
      },
      {
        heading: t('commandPalette.navigation'),
        items: nav.map((item) => ({
          id: `nav-${item.id}`,
          label: t(item.labelKey),
          icon: item.icon ? <item.icon /> : undefined,
          hint: item.phase ? t('nav.soon') : undefined,
          onSelect: () => navigate(item.to),
        })),
      },
      {
        heading: t('commandPalette.preferences'),
        items: [
          { id: 'theme-light', label: t('theme.setLight'), icon: <Sun />, onSelect: () => changeTheme('light') },
          { id: 'theme-dark', label: t('theme.setDark'), icon: <Moon />, onSelect: () => changeTheme('dark') },
          { id: 'theme-system', label: t('theme.setSystem'), icon: <Monitor />, onSelect: () => changeTheme('system') },
          ...SUPPORTED_LANGUAGES.map((lng) => ({
            id: `lang-${lng}`,
            label: `${t('language.label')}: ${t(`language.${lng}`)}`,
            icon: <Languages />,
            onSelect: () => changeLanguage(lng),
          })),
          { id: 'logout', label: t('auth.logout'), icon: <LogOut />, onSelect: () => logout.mutate() },
        ],
      },
    ]
  }, [permissions, search, projectItems, t, navigate, changeTheme, changeLanguage, logout])

  return (
    <AppCommandPalette
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (!value) setSearch('')
      }}
      groups={groups}
      search={search}
      onSearchChange={setSearch}
      placeholder={t('commandPalette.placeholderWithShortcut', { shortcut: `${modKey}+K` })}
    />
  )
}
