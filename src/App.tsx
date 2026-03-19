import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/AdminRoute";
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

            {/* Admin routes — only accessible by admin role */}
            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin/trilhas" element={<AdminRoute><AdminTrilhas /></AdminRoute>} />
            <Route path="/admin/anotacoes" element={<AdminRoute><AdminAnotacoes /></AdminRoute>} />
            <Route path="/admin/foruns" element={<AdminRoute><AdminForuns /></AdminRoute>} />
            <Route path="/admin/cursos-ead" element={<AdminRoute><AdminCursosEad /></AdminRoute>} />
            <Route path="/admin/avaliacoes" element={<AdminRoute><AdminAvaliacoes /></AdminRoute>} />
            <Route path="/admin/matriculas" element={<AdminRoute><AdminMatriculas /></AdminRoute>} />
            <Route path="/admin/treinamentos" element={<AdminRoute><AdminTreinamentos /></AdminRoute>} />
            <Route path="/admin/trilhas-gestao" element={<AdminRoute><AdminTrilhasGestao /></AdminRoute>} />
            <Route path="/admin/relatorio-progresso" element={<AdminRoute><AdminRelatorioProgresso /></AdminRoute>} />
            <Route path="/admin/usuarios" element={<AdminRoute><AdminUsuarios /></AdminRoute>} />
            <Route path="/admin/logs" element={<AdminRoute><AdminLogs /></AdminRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
