import {
  AlignLeft,
  AtSign,
  BookOpen,
  Bug,
  Calculator,
  Calendar,
  CalendarClock,
  CircleDot,
  Code2,
  FileText,
  Flag,
  FolderKanban,
  Hash,
  Image,
  Layers,
  LifeBuoy,
  Link,
  ListChecks,
  Paperclip,
  Phone,
  Plug,
  Rocket,
  Search,
  Settings,
  Shield,
  Sparkles,
  SquareCheck,
  SquarePlus,
  Target,
  ToggleLeft,
  Type,
  User,
  Users,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { FieldType, OptionColor, TaskTypeIcon } from '@/domain/task-config'

export const TASK_TYPE_ICON_COMPONENTS: Record<TaskTypeIcon, LucideIcon> = {
  bug: Bug,
  code: Code2,
  sparkles: Sparkles,
  wrench: Wrench,
  'plus-square': SquarePlus,
  plug: Plug,
  'life-buoy': LifeBuoy,
  book: BookOpen,
  'check-square': SquareCheck,
  flag: Flag,
  zap: Zap,
  shield: Shield,
  rocket: Rocket,
  target: Target,
  'file-text': FileText,
  layers: Layers,
  search: Search,
  settings: Settings,
}

export const FIELD_TYPE_ICONS: Record<FieldType, LucideIcon> = {
  text: Type,
  textarea: AlignLeft,
  number: Hash,
  decimal: Calculator,
  boolean: ToggleLeft,
  date: Calendar,
  datetime: CalendarClock,
  select: CircleDot,
  multiselect: ListChecks,
  user: User,
  users: Users,
  project: FolderKanban,
  url: Link,
  email: AtSign,
  phone: Phone,
  image: Image,
  file: Paperclip,
}

const HUES: Record<OptionColor, number> = {
  gray: 260,
  red: 25,
  orange: 55,
  amber: 80,
  green: 150,
  teal: 185,
  blue: 250,
  indigo: 272,
  violet: 300,
  pink: 350,
}

/** Cor sólida (legível em claro e escuro) para bolinhas, ícones e destaques. */
export function optionColor(color: OptionColor): string {
  return `oklch(0.64 ${color === 'gray' ? 0.02 : 0.16} ${HUES[color]})`
}

/**
 * Cor de TEXTO sobre o fundo suave (selos de status, prioridade e tags): mais escura no tema
 * claro e mais clara no escuro (tokens --kb-option-fg-*), com contraste AA.
 */
export function optionText(color: OptionColor): string {
  return `oklch(var(--kb-option-fg-l) ${color === 'gray' ? '0.02' : 'var(--kb-option-fg-c)'} ${HUES[color]})`
}

/** Fundo sólido para texto branco (blocos de status do quadro): escuro o bastante para contraste AA. */
export function optionSolid(color: OptionColor): string {
  return `oklch(0.5 ${color === 'gray' ? 0.02 : 0.15} ${HUES[color]})`
}

/** Fundo suave da cor (chips e ícones de tipo). */
export function optionTint(color: OptionColor): string {
  return `oklch(0.64 ${color === 'gray' ? 0.02 : 0.16} ${HUES[color]} / 0.16)`
}
