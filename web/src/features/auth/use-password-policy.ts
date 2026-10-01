import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { DEFAULT_PASSWORD_POLICY, passwordRuleKeys, type PasswordPolicy } from '@/domain/platform'
import { useRepositories } from '@/presentation/common/repositories-context'

export const PASSWORD_POLICY_QUERY_KEY = ['auth', 'password-policy'] as const

/** Exigências vigentes para senhas (Configurador geral); enquanto carrega, a regra padrão. */
export function usePasswordPolicy(): PasswordPolicy {
  const { auth } = useRepositories()
  const { data } = useQuery({ queryKey: PASSWORD_POLICY_QUERY_KEY, queryFn: () => auth.passwordPolicy(), staleTime: 60_000 })
  return data ?? DEFAULT_PASSWORD_POLICY
}

/** Dica do campo de senha: "Mínimo de 12 caracteres, com letras e números, maiúsculas e minúsculas e um símbolo". */
export function usePasswordHint(policy: PasswordPolicy): string {
  const { t, i18n } = useTranslation()
  const rules = passwordRuleKeys(policy).map((key) => t(`password.rules.${key}`))
  const list = new Intl.ListFormat(i18n.language, { style: 'long', type: 'conjunction' }).format(rules)
  return rules.length > 0 ? t('password.hint', { count: policy.minLength, rules: list }) : t('password.hintLength', { count: policy.minLength })
}
