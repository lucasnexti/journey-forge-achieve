import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AchievementPopup } from "@/components/AchievementPopup";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/AdminRoute";

// Eagerly loaded (critical path)
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";

// Lazy loaded
const TrackPage = lazy(() => import("./pages/TrackPage"));
const ReportPage = lazy(() => import("./pages/ReportPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage"));
const QuizHistoryPage = lazy(() => import("./pages/QuizHistoryPage"));
const KnowledgeBasePage = lazy(() => import("./pages/KnowledgeBasePage"));
const QuizNextiPage = lazy(() => import("./pages/QuizNextiPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const RewardsStorePage = lazy(() => import("./pages/RewardsStorePage"));
const BadgesPage = lazy(() => import("./pages/BadgesPage"));
const TrainingPage = lazy(() => import("./pages/TrainingPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Admin pages — all lazy
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminTrilhas = lazy(() => import("./pages/admin/AdminTrilhas"));
const AdminAnotacoes = lazy(() => import("./pages/admin/AdminAnotacoes"));
const AdminForuns = lazy(() => import("./pages/admin/AdminForuns"));
const AdminCursosEad = lazy(() => import("./pages/admin/AdminCursosEad"));
const AdminAvaliacoes = lazy(() => import("./pages/admin/AdminAvaliacoes"));
const AdminMatriculas = lazy(() => import("./pages/admin/AdminMatriculas"));
const AdminTreinamentos = lazy(() => import("./pages/admin/AdminTreinamentoPresencial"));
const AdminTrilhasGestao = lazy(() => import("./pages/admin/AdminTrilhasGestao"));
const AdminRelatorioProgresso = lazy(() => import("./pages/admin/AdminRelatorioProgresso"));
const AdminUsuarios = lazy(() => import("./pages/admin/AdminUsuarios"));
const AdminLogs = lazy(() => import("./pages/admin/AdminLogs"));
const AdminQuizzes = lazy(() => import("./pages/admin/AdminQuizzes"));
const AdminCertificados = lazy(() => import("./pages/admin/AdminCertificados"));
const AdminGamificacao = lazy(() => import("./pages/admin/AdminGamificacao"));
const AdminNotificacoes = lazy(() => import("./pages/admin/AdminNotificacoes"));
const AdminForumGestao = lazy(() => import("./pages/admin/AdminForumGestao"));
const AdminPersonalizacao = lazy(() => import("./pages/admin/AdminPersonalizacao"));
const AdminQuizNexti = lazy(() => import("./pages/admin/AdminQuizNexti"));
const AdminRewards = lazy(() => import("./pages/admin/AdminRewards"));
const AdminMonitoramento = lazy(() => import("./pages/admin/AdminMonitoramento"));
const AdminProvas = lazy(() => import("./pages/admin/AdminProvas"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5 min — dados considerados frescos
      gcTime: 30 * 60 * 1000,         // 30 min — mantém cache em memória
      refetchOnWindowFocus: false,     // não refaz ao voltar para aba
      retry: 2,
    },
  },
});

const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AchievementPopup />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/trilha/:trackId" element={<ProtectedRoute><TrackPage /></ProtectedRoute>} />
              <Route path="/relatorios" element={<ProtectedRoute><ReportPage /></ProtectedRoute>} />
              <Route path="/perfil" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
              <Route path="/ranking" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
              <Route path="/historico-avaliacoes" element={<ProtectedRoute><QuizHistoryPage /></ProtectedRoute>} />
              <Route path="/base-conhecimento" element={<ProtectedRoute><KnowledgeBasePage /></ProtectedRoute>} />
              <Route path="/quiz-nexti" element={<ProtectedRoute><QuizNextiPage /></ProtectedRoute>} />
              <Route path="/loja" element={<ProtectedRoute><RewardsStorePage /></ProtectedRoute>} />
              <Route path="/insignias" element={<ProtectedRoute><BadgesPage /></ProtectedRoute>} />
              <Route path="/treinamento-presencial" element={<ProtectedRoute><TrainingPage /></ProtectedRoute>} />

              {/* Admin routes */}
              <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
              <Route path="/admin/trilhas" element={<AdminRoute><AdminTrilhas /></AdminRoute>} />
              <Route path="/admin/anotacoes" element={<AdminRoute><AdminAnotacoes /></AdminRoute>} />
              <Route path="/admin/foruns" element={<AdminRoute><AdminForuns /></AdminRoute>} />
              <Route path="/admin/cursos-ead" element={<AdminRoute><AdminCursosEad /></AdminRoute>} />
              <Route path="/admin/avaliacoes" element={<AdminRoute><AdminAvaliacoes /></AdminRoute>} />
              <Route path="/admin/matriculas" element={<AdminRoute><AdminMatriculas /></AdminRoute>} />
              <Route path="/admin/treinamentos" element={<AdminRoute><AdminTreinamentos /></AdminRoute>} />
              <Route path="/admin/trilhas-gestao" element={<AdminRoute><AdminTrilhasGestao /></AdminRoute>} />
              <Route path="/admin/quizzes" element={<AdminRoute><AdminQuizzes /></AdminRoute>} />
              <Route path="/admin/provas" element={<AdminRoute><AdminProvas /></AdminRoute>} />
              <Route path="/admin/certificados" element={<AdminRoute><AdminCertificados /></AdminRoute>} />
              <Route path="/admin/gamificacao" element={<AdminRoute><AdminGamificacao /></AdminRoute>} />
              <Route path="/admin/notificacoes" element={<AdminRoute><AdminNotificacoes /></AdminRoute>} />
              <Route path="/admin/forum-gestao" element={<AdminRoute><AdminForumGestao /></AdminRoute>} />
              <Route path="/admin/relatorio-progresso" element={<AdminRoute><AdminRelatorioProgresso /></AdminRoute>} />
              <Route path="/admin/usuarios" element={<AdminRoute><AdminUsuarios /></AdminRoute>} />
              <Route path="/admin/personalizacao" element={<AdminRoute><AdminPersonalizacao /></AdminRoute>} />
              <Route path="/admin/logs" element={<AdminRoute><AdminLogs /></AdminRoute>} />
              <Route path="/admin/quiz-nexti" element={<AdminRoute><AdminQuizNexti /></AdminRoute>} />
              <Route path="/admin/premios" element={<AdminRoute><AdminRewards /></AdminRoute>} />
              <Route path="/admin/monitoramento" element={<AdminRoute><AdminMonitoramento /></AdminRoute>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
