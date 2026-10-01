import { createContext, useContext } from 'react'
import type { Repositories } from '@/domain/repositories'

/**
 * Injeção de dependências dos repositórios. A UI depende só das interfaces de domínio;
 * o App fornece as implementações HTTP e os testes fornecem fakes
 * (<RepositoriesContext.Provider value={...}>).
 */
export const RepositoriesContext = createContext<Repositories | null>(null)

export function useRepositories(): Repositories {
  const repositories = useContext(RepositoriesContext)
  if (!repositories) throw new Error('useRepositories precisa de <RepositoriesContext.Provider>')
  return repositories
}
