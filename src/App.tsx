import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
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
import { Comparar } from '@/pages/panel/Comparar'
import { Formacion } from '@/pages/panel/Formacion'
import { Repertorios } from '@/pages/panel/Repertorios'
import { ArmarRepertorio } from '@/pages/panel/ArmarRepertorio'
import { Shows } from '@/pages/panel/Shows'
import { Estadisticas } from '@/pages/panel/Estadisticas'
import { EditarShow } from '@/pages/panel/EditarShow'
import { GestionCola } from '@/pages/panel/GestionCola'
import { PerfilPublico } from '@/pages/PerfilPublico'
import { MusicaEnVivo } from '@/pages/MusicaEnVivo'
import { ShowPublico } from '@/pages/ShowPublico'
import { Rankings } from '@/pages/Rankings'
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
              <Route path="/shows" element={<MusicaEnVivo />} />
              <Route path="/shows/:id" element={<ShowPublico />} />
              <Route path="/rankings" element={<Rankings />} />

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
              <Route
                path="/panel/comparar"
                element={
                  <RequireMusico>
                    <Comparar />
                  </RequireMusico>
                }
              />
              <Route
                path="/panel/shows"
                element={
                  <RequireMusico>
                    <Shows />
                  </RequireMusico>
                }
              />
              <Route
                path="/panel/shows/nuevo"
                element={
                  <RequireMusico>
                    <EditarShow />
                  </RequireMusico>
                }
              />
              <Route
                path="/panel/shows/:id"
                element={
                  <RequireMusico>
                    <EditarShow />
                  </RequireMusico>
                }
              />
              {/* The old per-musician "toques" became shows */}
              <Route
                path="/panel/estadisticas"
                element={
                  <RequireMusico>
                    <Estadisticas />
                  </RequireMusico>
                }
              />
              <Route path="/panel/toques" element={<Navigate to="/panel/shows" replace />} />
              <Route path="/panel/toques/:id" element={<Navigate to="/panel/shows" replace />} />
              <Route
                path="/panel/cola"
                element={
                  <RequireMusico>
                    <GestionCola />
                  </RequireMusico>
                }
              />
              <Route
                path="/panel/formacion"
                element={
                  <RequireMusico>
                    <Formacion />
                  </RequireMusico>
                }
              />
              <Route
                path="/panel/repertorios"
                element={
                  <RequireMusico>
                    <Repertorios />
                  </RequireMusico>
                }
              />
              <Route
                path="/panel/repertorios/nuevo"
                element={
                  <RequireMusico>
                    <ArmarRepertorio />
                  </RequireMusico>
                }
              />
              <Route
                path="/panel/repertorios/:id"
                element={
                  <RequireMusico>
                    <ArmarRepertorio />
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
