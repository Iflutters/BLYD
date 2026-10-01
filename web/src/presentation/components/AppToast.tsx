import { Bounce, ToastContainer } from 'react-toastify'
import { useTranslation } from 'react-i18next'
import { useResolvedTheme } from '@/presentation/common/use-theme'

/**
 * Container global de toasts (React-Toastify), montado uma vez no App.
 * Para disparar mensagens use `notify` — nunca a biblioteca diretamente.
 */
export function AppToaster() {
  const { t } = useTranslation()
  const theme = useResolvedTheme()
  return (
    <ToastContainer
      position="top-right"
      // canto direito, logo abaixo do cabeçalho (não cobre busca/avatar)
      style={{ top: 64 }}
      theme={theme}
      transition={Bounce}
      autoClose={8000}
      // barra de tempo visível, diminuindo até o toast fechar (pausa com o mouse em cima)
      hideProgressBar={false}
      newestOnTop
      closeOnClick={false}
      pauseOnHover
      pauseOnFocusLoss
      draggable
      limit={5}
      aria-label={t('common.notifications')}
    />
  )
}
