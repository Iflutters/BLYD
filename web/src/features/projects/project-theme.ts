import type { CSSProperties } from 'react'
import {
  BarChart3,
  BookOpen,
  Box,
  Briefcase,
  Building2,
  Code2,
  Cpu,
  Database,
  Folder,
  Globe,
  Headphones,
  Layers,
  Rocket,
  Settings,
  Shield,
  Star,
  Target,
  Truck,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { ProjectCover, ProjectIcon } from '@/domain/projects'

/** Identidade visual dos projetos: ícones e capas (gradientes) disponíveis. */
export const PROJECT_ICON_COMPONENTS: Record<ProjectIcon, LucideIcon> = {
  folder: Folder,
  rocket: Rocket,
  briefcase: Briefcase,
  code: Code2,
  database: Database,
  globe: Globe,
  shield: Shield,
  users: Users,
  chart: BarChart3,
  settings: Settings,
  layers: Layers,
  zap: Zap,
  star: Star,
  box: Box,
  truck: Truck,
  building: Building2,
  cpu: Cpu,
  headphones: Headphones,
  book: BookOpen,
  target: Target,
}

/** Matiz (OKLCH) de cada capa. "slate" usa baixa saturação. */
const COVER_HUE: Record<ProjectCover, number> = {
  violet: 295,
  indigo: 272,
  blue: 250,
  cyan: 215,
  teal: 185,
  green: 150,
  amber: 80,
  orange: 55,
  red: 25,
  pink: 350,
  slate: 260,
}

export function coverGradient(cover: ProjectCover): string {
  const hue = COVER_HUE[cover]
  const chroma = cover === 'slate' ? 0.03 : 0.16
  return `linear-gradient(135deg, oklch(0.6 ${chroma} ${hue}), oklch(0.5 ${chroma} ${hue + 25}))`
}

export function coverStyle(cover: ProjectCover): CSSProperties {
  return { backgroundImage: coverGradient(cover) }
}
