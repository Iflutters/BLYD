// Aplica o tema salvo (light | dark | system) antes do React montar. Mantenha em sincronia com src/core/theme.
;(function () {
  var preference = 'system'
  try {
    var raw = window.localStorage.getItem('kamban.ui')
    var parsed = raw ? JSON.parse(raw) : null
    if (parsed && parsed.state && parsed.state.theme) preference = parsed.state.theme
  } catch (_) {
    // armazenamento indisponível: usa o tema do sistema
  }
  var dark = preference === 'dark' || (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
})()
