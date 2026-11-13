CREATE TABLE public.knowledge_base_content (
  id text PRIMARY KEY,
  dados jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.knowledge_base_content TO authenticated;
GRANT ALL ON public.knowledge_base_content TO service_role;
ALTER TABLE public.knowledge_base_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read knowledge base content" ON public.knowledge_base_content FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins insert knowledge base content" ON public.knowledge_base_content FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update knowledge base content" ON public.knowledge_base_content FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Signed-in users read the published content; drafts only reach admins.
CREATE FUNCTION public.get_knowledge_base(_id text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE _row knowledge_base_content%ROWTYPE; _admin boolean; _d jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login para acessar o conteúdo'; END IF;
  _admin := has_role(auth.uid(),'admin');
  SELECT * INTO _row FROM knowledge_base_content WHERE id=_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('dados',NULL,'updated_at',NULL,'can_edit',_admin); END IF;
  _d := _row.dados;
  IF NOT _admin THEN
    _d := jsonb_set(_d,'{orientacoes}',coalesce((SELECT jsonb_agg(o ORDER BY n) FROM jsonb_array_elements(_d->'orientacoes') WITH ORDINALITY AS t(o,n) WHERE o->>'status'='publicado'),'[]'::jsonb));
  END IF;
  RETURN jsonb_build_object('dados',_d,'updated_at',_row.updated_at,'can_edit',_admin);
END; $$;
REVOKE ALL ON FUNCTION public.get_knowledge_base(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_knowledge_base(text) TO authenticated, service_role;

-- Admin-only publish with a stale-edit check (_expected = updated_at the editor started from).
CREATE FUNCTION public.save_knowledge_base(_id text, _dados jsonb, _expected timestamptz) RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _cur timestamptz; _now timestamptz := clock_timestamp();
BEGIN
  IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso restrito a administradores'; END IF;
  IF _id !~ '^[a-z0-9-]{1,60}$' THEN RAISE EXCEPTION 'Identificador inválido'; END IF;
  IF jsonb_typeof(_dados) <> 'object' OR jsonb_typeof(_dados->'modulos') <> 'array' OR jsonb_typeof(_dados->'orientacoes') <> 'array' THEN
    RAISE EXCEPTION 'Conteúdo inválido';
  END IF;
  IF octet_length(_dados::text) > 5000000 THEN RAISE EXCEPTION 'Conteúdo muito grande'; END IF;
  SELECT updated_at INTO _cur FROM knowledge_base_content WHERE id=_id FOR UPDATE;
  IF FOUND THEN
    IF _expected IS DISTINCT FROM _cur THEN RAISE EXCEPTION 'CONFLITO: o conteúdo foi publicado por outra pessoa'; END IF;
    UPDATE knowledge_base_content SET dados=_dados, updated_at=_now, updated_by=auth.uid() WHERE id=_id;
  ELSE
    INSERT INTO knowledge_base_content(id,dados,updated_at,updated_by) VALUES (_id,_dados,_now,auth.uid());
  END IF;
  RETURN _now;
END; $$;
REVOKE ALL ON FUNCTION public.save_knowledge_base(text,jsonb,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_knowledge_base(text,jsonb,timestamptz) TO authenticated, service_role;