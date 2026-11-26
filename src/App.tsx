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
import { useRedMusicos } from '@/hooks/useRedMusicos'
import { RequireRedMusicos } from '@/components/RequireRedMusicos'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
    },
  },
})

/** Old "toques" URLs: shows when the network is visible, the panel home otherwise. */
function RedirectToShows() {
  const visible = useRedMusicos()
  return <Navigate to={visible ? '/panel/shows' : '/panel'} replace />
}

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
              <Route
                path="/shows"
                element={
                  <RequireRedMusicos to="/">
                    <MusicaEnVivo />
                  </RequireRedMusicos>
                }
              />
              <Route
                path="/shows/:id"
                element={
                  <RequireRedMusicos to="/">
                    <ShowPublico />
                  </RequireRedMusicos>
                }
              />
              <Route
                path="/rankings"
                element={
                  <RequireRedMusicos to="/">
                    <Rankings />
                  </RequireRedMusicos>
                }
              />

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
                    <RequireRedMusicos to="/panel">
                      <Shows />
                    </RequireRedMusicos>
                  </RequireMusico>
                }
              />
              <Route
                path="/panel/shows/nuevo"
                element={
                  <RequireMusico>
                    <RequireRedMusicos to="/panel">
                      <EditarShow />
                    </RequireRedMusicos>
                  </RequireMusico>
                }
              />
              <Route
                path="/panel/shows/:id"
                element={
                  <RequireMusico>
                    <RequireRedMusicos to="/panel">
                      <EditarShow />
                    </RequireRedMusicos>
                  </RequireMusico>
                }
              />
              {/* The old per-musician "toques" became shows */}
              <Route
                path="/panel/estadisticas"
                element={
                  <RequireMusico>
                    <RequireRedMusicos to="/panel">
                      <Estadisticas />
                    </RequireRedMusicos>
                  </RequireMusico>
                }
              />
              <Route path="/panel/toques" element={<RedirectToShows />} />
              <Route path="/panel/toques/:id" element={<RedirectToShows />} />
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
                    <RequireRedMusicos to="/panel">
                      <Formacion />
                    </RequireRedMusicos>
                  </RequireMusico>
                }
              />
              <Route
                path="/panel/repertorios"
                element={
                  <RequireMusico>
                    <RequireRedMusicos to="/panel">
                      <Repertorios />
                    </RequireRedMusicos>
                  </RequireMusico>
                }
              />
              <Route
                path="/panel/repertorios/nuevo"
                element={
                  <RequireMusico>
                    <RequireRedMusicos to="/panel">
                      <ArmarRepertorio />
                    </RequireRedMusicos>
                  </RequireMusico>
                }
              />
              <Route
                path="/panel/repertorios/:id"
                element={
                  <RequireMusico>
                    <RequireRedMusicos to="/panel">
                      <ArmarRepertorio />
                    </RequireRedMusicos>
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
