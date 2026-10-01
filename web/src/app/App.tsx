import { useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router/dom'
import { RepositoriesContext } from '@/presentation/common/repositories-context'
import { AppToaster, AppTooltipProvider } from '@/presentation/components'
import { useThemeSync } from '@/presentation/common/use-theme'
import { PlatformHead } from '@/presentation/common/use-platform'
import { queryClient, realtimeClient, repositories } from './container'
import { RealtimeContext } from '@/presentation/common/realtime-context'
import { createAppRouter } from './router'

export function App() {
  const [router] = useState(createAppRouter)
  useThemeSync()

  return (
    <QueryClientProvider client={queryClient}>
      <RepositoriesContext.Provider value={repositories}>
        <RealtimeContext.Provider value={realtimeClient}>
          <AppTooltipProvider>
            <PlatformHead />
            <RouterProvider router={router} />
            <AppToaster />
          </AppTooltipProvider>
        </RealtimeContext.Provider>
      </RepositoriesContext.Provider>
    </QueryClientProvider>
  )
}
