import { AlertTriangle, CheckCircle2, Info, OctagonAlert, type LucideIcon } from 'lucide-react'
import { CALLOUT_TONES, type CalloutTone } from '@/domain/docs'

export const CALLOUT_ICONS: Record<CalloutTone, LucideIcon> = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: OctagonAlert }

/** Tom válido do destaque (o servidor usa o mesmo padrão). */
export const toneOf = (value: unknown): CalloutTone => (CALLOUT_TONES.includes(value as CalloutTone) ? (value as CalloutTone) : 'info')
