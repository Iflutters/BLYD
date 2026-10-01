import { Ban, CheckCircle2, Circle, CircleDashed, CircleDot, type LucideIcon } from 'lucide-react'
import type { StatusCategory } from '@/domain/workflow'

export const CATEGORY_ICONS: Record<StatusCategory, LucideIcon> = {
  backlog: CircleDashed,
  todo: Circle,
  in_progress: CircleDot,
  done: CheckCircle2,
  cancelled: Ban,
}
