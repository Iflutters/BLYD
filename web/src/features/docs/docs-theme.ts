import { BookOpen, Briefcase, Code2, Database, FileText, Globe, Layers, Rocket, Settings, Shield, Target, Users, type LucideIcon } from 'lucide-react'
import type { SpaceIcon } from '@/domain/docs'

export const SPACE_ICON_COMPONENTS: Record<SpaceIcon, LucideIcon> = {
  book: BookOpen,
  'file-text': FileText,
  layers: Layers,
  settings: Settings,
  shield: Shield,
  users: Users,
  rocket: Rocket,
  target: Target,
  code: Code2,
  database: Database,
  globe: Globe,
  briefcase: Briefcase,
}
