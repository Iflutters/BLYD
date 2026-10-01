import { Avatar } from 'radix-ui'
import { cn } from '@/core/utils/cn'
import { initials } from '@/core/utils/format'

export interface AppAvatarProps {
  name: string
  src?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

const SIZES = { xs: 'size-5 text-[9px]', sm: 'size-7 text-[11px]', md: 'size-9 text-xs', lg: 'size-12 text-sm' }

/** Cor estável derivada do nome (mesma pessoa, mesma cor em qualquer tela). */
const HUES = [272, 305, 230, 190, 155, 25, 55, 340]
function hueFor(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return HUES[hash % HUES.length] ?? 272
}

export function AppAvatar({ name, src, size = 'md', className }: AppAvatarProps) {
  const hue = hueFor(name)
  return (
    <Avatar.Root className={cn('relative inline-flex shrink-0 overflow-hidden rounded-full select-none', SIZES[size], className)}>
      {src && <Avatar.Image src={src} alt={name} className="size-full object-cover" loading="lazy" />}
      <Avatar.Fallback
        className="flex size-full items-center justify-center font-semibold text-white"
        style={{ background: `linear-gradient(135deg, oklch(0.6 0.15 ${hue}), oklch(0.5 0.15 ${hue + 30}))` }}
        aria-label={name}
      >
        {initials(name)}
      </Avatar.Fallback>
    </Avatar.Root>
  )
}
