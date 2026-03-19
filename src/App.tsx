import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import LandingPage from "./pages/LandingPage.tsx";
import AuthPage from "./pages/AuthPage.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import TrackPage from "./pages/TrackPage.tsx";
import ReportPage from "./pages/ReportPage.tsx";
import AdminDashboard from "./pages/admin/AdminDashboard.tsx";
import AdminTrilhas from "./pages/admin/AdminTrilhas.tsx";
import AdminAnotacoes from "./pages/admin/AdminAnotacoes.tsx";
import AdminForuns from "./pages/admin/AdminForuns.tsx";
import AdminCursosEad from "./pages/admin/AdminCursosEad.tsx";
import AdminAvaliacoes from "./pages/admin/AdminAvaliacoes.tsx";
import AdminMatriculas from "./pages/admin/AdminMatriculas.tsx";
import AdminTreinamentos from "./pages/admin/AdminTreinamentos.tsx";
import AdminTrilhasGestao from "./pages/admin/AdminTrilhasGestao.tsx";
import AdminRelatorioProgresso from "./pages/admin/AdminRelatorioProgresso.tsx";
import AdminUsuarios from "./pages/admin/AdminUsuarios.tsx";
import AdminLogs from "./pages/admin/AdminLogs.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/trilha/:trackId" element={<ProtectedRoute><TrackPage /></ProtectedRoute>} />
            <Route path="/relatorios" element={<ProtectedRoute><ReportPage /></ProtectedRoute>} />

            {/* Admin routes */}
            <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/trilhas" element={<ProtectedRoute><AdminTrilhas /></ProtectedRoute>} />
            <Route path="/admin/anotacoes" element={<ProtectedRoute><AdminAnotacoes /></ProtectedRoute>} />
            <Route path="/admin/foruns" element={<ProtectedRoute><AdminForuns /></ProtectedRoute>} />
            <Route path="/admin/cursos-ead" element={<ProtectedRoute><AdminCursosEad /></ProtectedRoute>} />
            <Route path="/admin/avaliacoes" element={<ProtectedRoute><AdminAvaliacoes /></ProtectedRoute>} />
            <Route path="/admin/matriculas" element={<ProtectedRoute><AdminMatriculas /></ProtectedRoute>} />
            <Route path="/admin/treinamentos" element={<ProtectedRoute><AdminTreinamentos /></ProtectedRoute>} />
            <Route path="/admin/trilhas-gestao" element={<ProtectedRoute><AdminTrilhasGestao /></ProtectedRoute>} />
            <Route path="/admin/relatorio-progresso" element={<ProtectedRoute><AdminRelatorioProgresso /></ProtectedRoute>} />
            <Route path="/admin/usuarios" element={<ProtectedRoute><AdminUsuarios /></ProtectedRoute>} />
            <Route path="/admin/logs" element={<ProtectedRoute><AdminLogs /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
