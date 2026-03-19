-- Tracks table (customizable by admin)
CREATE TABLE public.tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  estimated_hours NUMERIC DEFAULT 0,
  order_index INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can view active tracks" ON public.tracks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage tracks" ON public.tracks FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Lessons table
CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID REFERENCES public.tracks(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  duration INT DEFAULT 0,
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can view lessons" ON public.lessons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage lessons" ON public.lessons FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Enrollments (matrículas)
CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  track_id UUID REFERENCES public.tracks(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, track_id)
);

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own enrollments" ON public.enrollments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all enrollments" ON public.enrollments FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Seed initial tracks from hardcoded data
INSERT INTO public.tracks (id, title, description, category, estimated_hours, order_index) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Fundamentos do Cooperativismo', 'Entenda os princípios, valores e a história do movimento cooperativista.', 'Fundamentos', 2, 1),
  ('a1000000-0000-0000-0000-000000000002', 'Gestão e Governança Cooperativa', 'Aprenda sobre estrutura organizacional e tomada de decisão democrática.', 'Gestão', 3, 2),
  ('a1000000-0000-0000-0000-000000000003', 'Gestão Financeira para Cooperativas', 'Domine os conceitos financeiros essenciais para a sustentabilidade.', 'Finanças', 4, 3);

-- Seed lessons
INSERT INTO public.lessons (track_id, title, description, video_url, duration, order_index) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'O que é uma Cooperativa?', 'Definição, tipos e estrutura.', 'https://www.w3schools.com/html/mov_bbb.mp4', 600, 1),
  ('a1000000-0000-0000-0000-000000000001', 'Os 7 Princípios Cooperativistas', 'Os pilares do movimento cooperativo.', 'https://www.w3schools.com/html/mov_bbb.mp4', 480, 2),
  ('a1000000-0000-0000-0000-000000000001', 'História do Cooperativismo no Brasil', 'De Rochdale ao cenário brasileiro.', 'https://www.w3schools.com/html/mov_bbb.mp4', 720, 3),
  ('a1000000-0000-0000-0000-000000000002', 'Estrutura Organizacional', 'Assembleia, conselhos e diretoria.', 'https://www.w3schools.com/html/mov_bbb.mp4', 540, 1),
  ('a1000000-0000-0000-0000-000000000002', 'Processo Decisório Democrático', 'Como funciona a votação e participação.', 'https://www.w3schools.com/html/mov_bbb.mp4', 600, 2),
  ('a1000000-0000-0000-0000-000000000002', 'Compliance e Transparência', 'Boas práticas de governança.', 'https://www.w3schools.com/html/mov_bbb.mp4', 660, 3),
  ('a1000000-0000-0000-0000-000000000003', 'Demonstrações Financeiras', 'Balanço patrimonial e DRE.', 'https://www.w3schools.com/html/mov_bbb.mp4', 720, 1),
  ('a1000000-0000-0000-0000-000000000003', 'Sobras e Distribuição', 'Como funcionam as sobras líquidas.', 'https://www.w3schools.com/html/mov_bbb.mp4', 600, 2),
  ('a1000000-0000-0000-0000-000000000003', 'Planejamento Orçamentário', 'Construindo um orçamento cooperativo.', 'https://www.w3schools.com/html/mov_bbb.mp4', 660, 3);

-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger for tracks
CREATE TRIGGER update_tracks_updated_at BEFORE UPDATE ON public.tracks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();