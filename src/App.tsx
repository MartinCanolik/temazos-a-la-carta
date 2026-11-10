import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from '@/components/Layout'
import { Home } from '@/pages/Home'
import { Donaciones } from '@/pages/Donaciones'
import { Repertorio } from '@/pages/Repertorio'
import { Pedidos } from '@/pages/Pedidos'
import { Login } from '@/pages/Login'
import { PanelHome } from '@/pages/panel/PanelHome'
import { EditarPerfil } from '@/pages/panel/EditarPerfil'
import { MiRepertorio } from '@/pages/panel/MiRepertorio'
import { PerfilPublico } from '@/pages/PerfilPublico'
import { AuthProvider } from '@/auth/AuthProvider'
import { RequireMusico } from '@/auth/RequireMusico'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/donaciones" element={<Donaciones />} />
              <Route path="/repertorio" element={<Repertorio />} />
              <Route path="/pedidos" element={<Pedidos />} />

              {/* Área de músicos */}
              <Route path="/login" element={<Login />} />
              <Route
                path="/panel"
                element={
                  <RequireMusico>
                    <PanelHome />
                  </RequireMusico>
                }
              />
              <Route
                path="/panel/perfil"
                element={
                  <RequireMusico>
                    <EditarPerfil />
                  </RequireMusico>
                }
              />
              <Route
                path="/panel/repertorio"
                element={
                  <RequireMusico>
                    <MiRepertorio />
                  </RequireMusico>
                }
              />
              <Route path="/m/:slug" element={<PerfilPublico />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
