/** Rola até o n-ésimo título (h1–h4) dentro de `container` (o "Nesta página"). */
export function scrollToHeading(container: HTMLElement | null, index: number) {
  const target = container?.querySelectorAll('.kb-rich h1, .kb-rich h2, .kb-rich h3, .kb-rich h4')[index]
  if (!(target instanceof HTMLElement)) return
  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  target.setAttribute('tabindex', '-1')
  target.focus({ preventScroll: true })
}
