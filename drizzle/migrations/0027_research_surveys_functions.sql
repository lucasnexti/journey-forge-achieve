CREATE FUNCTION public.research_email_ok(_e text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT _e IS NOT NULL AND length(_e) <= 254 AND _e ~* '^[A-Z0-9._%+''-]+@[A-Z0-9-]+(\.[A-Z0-9-]+)*\.[A-Z]{2,}$' AND _e !~ '\.\.';
$$;
CREATE FUNCTION public.research_day_end(_d date) RETURNS timestamptz LANGUAGE sql IMMUTABLE AS $$
  SELECT ((_d + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo') - interval '1 second';
$$;

CREATE FUNCTION public.research_import_list(_p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _aud text := _p->>'audience'; _purpose text := _p->>'purpose';
  _training text := nullif(btrim(_p->>'training_name'),''); _date date := nullif(_p->>'training_date','')::date;
  _company text := nullif(btrim(_p->>'company_name'),''); _class text := nullif(btrim(_p->>'class_name'),'');
  _track uuid := nullif(_p->>'track_id','')::uuid;
  _list uuid; _r jsonb; _email text; _name text; _rt text; _rd date; _rejected int := 0; _dups int := 0; _members int := 0; _att_new int := 0; _att_existing int := 0; _n int;
BEGIN
  IF NOT research_can('lists_import') THEN RAISE EXCEPTION 'Sem permissão para importar listas' USING ERRCODE='42501'; END IF;
  IF _aud NOT IN ('interno','clientes') THEN RAISE EXCEPTION 'Selecione o público da lista'; END IF;
  IF _purpose NOT IN ('attendance','recipients') THEN RAISE EXCEPTION 'Finalidade da lista inválida'; END IF;
  IF jsonb_typeof(_p->'rows') <> 'array' OR jsonb_array_length(_p->'rows') = 0 THEN RAISE EXCEPTION 'A lista não tem registros válidos'; END IF;
  IF jsonb_array_length(_p->'rows') > 20000 THEN RAISE EXCEPTION 'Limite de 20.000 registros por importação'; END IF;
  IF nullif(btrim(_p->>'name'),'') IS NULL THEN RAISE EXCEPTION 'Informe um nome para a lista'; END IF;

  INSERT INTO research_lists(audience, purpose, name, company_name, training_name, training_date, class_name, track_id, source_file_name, source_sheet, created_by)
  VALUES (_aud, _purpose, left(btrim(_p->>'name'),200), _company, _training, _date, _class, _track, left(_p->>'source_file_name',255), left(_p->>'source_sheet',120), auth.uid())
  RETURNING id INTO _list;

  FOR _r IN SELECT * FROM jsonb_array_elements(_p->'rows') LOOP
    _email := lower(btrim(_r->>'email')); _name := left(btrim(coalesce(_r->>'name','')),200);
    _rt := coalesce(nullif(btrim(_r->>'training_name'),''), _training);
    _rd := CASE WHEN (_r->>'training_date') ~ '^\d{4}-\d{2}-\d{2}$' THEN (_r->>'training_date')::date ELSE _date END;
    IF NOT research_email_ok(_email) OR _name = '' OR (_purpose = 'attendance' AND (_rt IS NULL OR _rd IS NULL)) THEN _rejected := _rejected + 1; CONTINUE; END IF;
    INSERT INTO research_list_members(list_id, name, email, area, company, training_name, training_date, class_name)
    VALUES (_list, _name, _email, left(nullif(btrim(_r->>'area'),''),120), left(coalesce(nullif(btrim(_r->>'company'),''), _company),200), left(_rt,200), _rd, _class)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS _n = ROW_COUNT;
    IF _n = 0 THEN _dups := _dups + 1; CONTINUE; END IF;
    _members := _members + 1;
    IF _purpose = 'attendance' THEN
      INSERT INTO research_attendance(audience, email, name, area, company, training_name, training_date, class_name, track_id, list_id)
      VALUES (_aud, _email, _name, left(nullif(btrim(_r->>'area'),''),120), left(coalesce(nullif(btrim(_r->>'company'),''), _company),200), left(_rt,200), _rd, _class, _track, _list)
      ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS _n = ROW_COUNT;
      IF _n = 1 THEN _att_new := _att_new + 1; ELSE _att_existing := _att_existing + 1; END IF;
    END IF;
  END LOOP;
  IF _members = 0 THEN RAISE EXCEPTION 'Nenhum registro válido para importar'; END IF;
  UPDATE research_lists SET member_count = _members,
    summary = coalesce(_p->'client_summary','{}'::jsonb) || jsonb_build_object('members',_members,'server_rejected',_rejected,'server_duplicates',_dups,'attendance_new',_att_new,'attendance_existing',_att_existing)
  WHERE id = _list;
  INSERT INTO audit_logs(user_id, action, entity_type, entity_id, details) VALUES (auth.uid(),'research_import_list','research_lists',_list::text, jsonb_build_object('members',_members,'purpose',_purpose,'audience',_aud));
  RETURN jsonb_build_object('list_id',_list,'members',_members,'rejected',_rejected,'duplicates',_dups,'attendance_new',_att_new,'attendance_existing',_att_existing);
END $$;

CREATE FUNCTION public.research_send_preview(_survey uuid, _list uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE _s research_surveys%ROWTYPE; _l research_lists%ROWTYPE; _unique int; _existing int;
BEGIN
  IF NOT research_can('surveys_send') THEN RAISE EXCEPTION 'Sem permissão para enviar pesquisas' USING ERRCODE='42501'; END IF;
  SELECT * INTO _s FROM research_surveys WHERE id=_survey; IF NOT FOUND THEN RAISE EXCEPTION 'Pesquisa não encontrada'; END IF;
  SELECT * INTO _l FROM research_lists WHERE id=_list; IF NOT FOUND THEN RAISE EXCEPTION 'Lista não encontrada'; END IF;
  SELECT count(DISTINCT email) INTO _unique FROM research_list_members WHERE list_id=_list;
  SELECT count(DISTINCT m.email) INTO _existing FROM research_list_members m JOIN research_invitations i ON i.survey_id=_survey AND i.email=m.email WHERE m.list_id=_list;
  RETURN jsonb_build_object('unique_recipients',_unique,'already_invited',_existing,'new_recipients',_unique-_existing,
    'audience_match', _s.audience = _l.audience, 'list_summary', _l.summary,
    'sender', (SELECT jsonb_build_object('email',sender_email,'name',sender_name) FROM research_settings WHERE audience=_s.audience),
    'deadline_at', _s.deadline_at, 'status', _s.status);
END $$;

CREATE FUNCTION public.research_send_survey(_survey uuid, _list uuid, _deadline_days integer, _reminder_enabled boolean, _reminder_after_days integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _s research_surveys%ROWTYPE; _l research_lists%ROWTYPE; _dispatch uuid; _created int := 0; _skipped int := 0; _total int; _sender text;
BEGIN
  IF NOT research_can('surveys_send') THEN RAISE EXCEPTION 'Sem permissão para enviar pesquisas' USING ERRCODE='42501'; END IF;
  SELECT * INTO _s FROM research_surveys WHERE id=_survey FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Pesquisa não encontrada'; END IF;
  SELECT * INTO _l FROM research_lists WHERE id=_list; IF NOT FOUND THEN RAISE EXCEPTION 'Lista não encontrada'; END IF;
  IF _s.audience <> _l.audience THEN RAISE EXCEPTION 'A lista pertence a outro público. Selecione uma lista do mesmo público da pesquisa'; END IF;
  IF _s.status = 'closed' THEN RAISE EXCEPTION 'Pesquisa encerrada. Prorrogue o prazo antes de enviar para novos destinatários'; END IF;
  IF NOT EXISTS(SELECT 1 FROM research_questions WHERE survey_id=_survey) THEN RAISE EXCEPTION 'Adicione ao menos uma pergunta'; END IF;
  IF btrim(_s.email_subject) = '' OR btrim(_s.email_body) = '' THEN RAISE EXCEPTION 'Preencha o assunto e a mensagem do e-mail'; END IF;
  IF _s.track_id IS NULL AND nullif(btrim(_s.training_name),'') IS NULL AND nullif(btrim(_s.class_name),'') IS NULL AND nullif(btrim(_s.standalone_reason),'') IS NULL THEN
    RAISE EXCEPTION 'Pesquisa avulsa: informe o motivo antes de enviar'; END IF;
  SELECT sender_email INTO _sender FROM research_settings WHERE audience=_s.audience;
  IF _sender IS NULL THEN RAISE EXCEPTION 'Remetente do público não configurado'; END IF;

  IF _s.first_sent_at IS NULL THEN
    IF _deadline_days IS NULL OR _deadline_days NOT BETWEEN 1 AND 90 THEN RAISE EXCEPTION 'Prazo deve ficar entre 1 e 90 dias'; END IF;
    IF _reminder_after_days IS NULL OR _reminder_after_days NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION 'Lembrete deve ficar entre 1 e 60 dias'; END IF;
    IF coalesce(_reminder_enabled,false) AND _reminder_after_days >= _deadline_days THEN RAISE EXCEPTION 'O lembrete precisa acontecer antes do fim do prazo'; END IF;
    UPDATE research_surveys SET status='active', first_sent_at=now(), deadline_days=_deadline_days,
      deadline_at = research_day_end((now() AT TIME ZONE 'America/Sao_Paulo')::date + _deadline_days),
      reminder_enabled=coalesce(_reminder_enabled,false), reminder_after_days=_reminder_after_days, updated_at=now()
    WHERE id=_survey;
  ELSIF _s.deadline_at <= now() THEN RAISE EXCEPTION 'O prazo desta pesquisa terminou. Prorrogue antes de enviar';
  END IF;

  INSERT INTO research_dispatches(survey_id, list_id, kind, created_by) VALUES (_survey, _list, 'invite', auth.uid()) RETURNING id INTO _dispatch;
  SELECT count(DISTINCT email) INTO _total FROM research_list_members WHERE list_id=_list;
  WITH src AS (
    SELECT DISTINCT ON (email) email, name, area, company, training_name, training_date FROM research_list_members WHERE list_id=_list ORDER BY email, created_at
  ), ins AS (
    INSERT INTO research_invitations(survey_id, list_id, dispatch_id, email, name, area, company, training_name, training_date)
    SELECT _survey, _list, _dispatch, email, name, area, company, coalesce(training_name, _s.training_name), training_date FROM src
    ON CONFLICT (survey_id, email) DO NOTHING RETURNING id
  ), tok AS (
    INSERT INTO research_invitation_tokens(invitation_id, token) SELECT id, encode(extensions.gen_random_bytes(32),'hex') FROM ins RETURNING invitation_id
  )
  INSERT INTO research_email_jobs(invitation_id, survey_id, dispatch_id, kind, dedupe_key, sender_email)
  SELECT invitation_id, _survey, _dispatch, 'invite', 'invite', _sender FROM tok;
  GET DIAGNOSTICS _created = ROW_COUNT;
  _skipped := _total - _created;
  UPDATE research_dispatches SET recipients=_created, skipped_existing=_skipped WHERE id=_dispatch;
  INSERT INTO audit_logs(user_id, action, entity_type, entity_id, details) VALUES (auth.uid(),'research_send_survey','research_surveys',_survey::text, jsonb_build_object('list',_list,'created',_created,'skipped',_skipped));
  RETURN jsonb_build_object('dispatch_id',_dispatch,'created',_created,'skipped_existing',_skipped);
END $$;

CREATE FUNCTION public.research_close_survey(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT research_can('surveys_send') THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
  UPDATE research_surveys SET status='closed', closed_at=now(), updated_at=now() WHERE id=_id AND status='active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Somente pesquisas em andamento podem ser encerradas'; END IF;
  UPDATE research_email_jobs SET status='skipped', last_error='Pesquisa encerrada', updated_at=now() WHERE survey_id=_id AND kind<>'invite' AND status IN ('queued','blocked_config');
  INSERT INTO audit_logs(user_id, action, entity_type, entity_id) VALUES (auth.uid(),'research_close_survey','research_surveys',_id::text);
END $$;

CREATE FUNCTION public.research_extend_deadline(_id uuid, _new_date date, _reason text) RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _s research_surveys%ROWTYPE; _new timestamptz;
BEGIN
  IF NOT research_can('surveys_send') THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
  SELECT * INTO _s FROM research_surveys WHERE id=_id FOR UPDATE;
  IF NOT FOUND OR _s.first_sent_at IS NULL THEN RAISE EXCEPTION 'Somente pesquisas já enviadas podem ser prorrogadas'; END IF;
  IF _new_date IS NULL THEN RAISE EXCEPTION 'Informe a nova data'; END IF;
  _new := research_day_end(_new_date);
  IF _new <= now() THEN RAISE EXCEPTION 'A nova data precisa ser futura'; END IF;
  IF _s.deadline_at IS NOT NULL AND _new <= _s.deadline_at THEN RAISE EXCEPTION 'A nova data precisa ser posterior ao prazo atual'; END IF;
  INSERT INTO research_deadline_changes(survey_id, previous_deadline, new_deadline, reason, changed_by) VALUES (_id, _s.deadline_at, _new, left(nullif(btrim(_reason),''),500), auth.uid());
  UPDATE research_surveys SET deadline_at=_new, status='active', closed_at=NULL, updated_at=now() WHERE id=_id;
  INSERT INTO audit_logs(user_id, action, entity_type, entity_id, details) VALUES (auth.uid(),'research_extend_deadline','research_surveys',_id::text, jsonb_build_object('from',_s.deadline_at,'to',_new));
  RETURN _new;
END $$;

CREATE FUNCTION public.research_notify_extension(_id uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _s research_surveys%ROWTYPE; _d uuid; _n int; _sender text;
BEGIN
  IF NOT research_can('surveys_send') THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
  SELECT * INTO _s FROM research_surveys WHERE id=_id;
  IF NOT FOUND OR _s.status <> 'active' OR _s.deadline_at <= now() THEN RAISE EXCEPTION 'A pesquisa precisa estar em andamento'; END IF;
  IF NOT EXISTS(SELECT 1 FROM research_deadline_changes WHERE survey_id=_id) THEN RAISE EXCEPTION 'Esta pesquisa ainda não foi prorrogada'; END IF;
  SELECT sender_email INTO _sender FROM research_settings WHERE audience=_s.audience;
  INSERT INTO research_dispatches(survey_id, kind, created_by) VALUES (_id,'extension_notice',auth.uid()) RETURNING id INTO _d;
  INSERT INTO research_email_jobs(invitation_id, survey_id, dispatch_id, kind, dedupe_key, sender_email)
  SELECT i.id, _id, _d, 'extension_notice', to_char(_s.deadline_at AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD'), _sender
  FROM research_invitations i WHERE i.survey_id=_id AND i.responded_at IS NULL AND i.send_status IN ('sent','delivered')
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS _n = ROW_COUNT;
  UPDATE research_dispatches SET recipients=_n WHERE id=_d;
  RETURN _n;
END $$;

CREATE FUNCTION public.research_duplicate_survey(_id uuid, _new_version boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _s research_surveys%ROWTYPE; _new uuid; _ver int;
BEGIN
  IF NOT research_can('surveys_edit') THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
  SELECT * INTO _s FROM research_surveys WHERE id=_id; IF NOT FOUND THEN RAISE EXCEPTION 'Pesquisa não encontrada'; END IF;
  IF _new_version THEN
    _ver := coalesce((SELECT max(version) FROM research_surveys WHERE id=_id OR source_survey_id=_id OR (_s.source_survey_id IS NOT NULL AND (id=_s.source_survey_id OR source_survey_id=_s.source_survey_id))),_s.version) + 1;
  ELSE _ver := 1; END IF;
  INSERT INTO research_surveys(audience, kind, title, description, track_id, training_name, class_name, standalone_reason, email_subject, email_body, deadline_days, reminder_enabled, reminder_after_days, version, source_survey_id, created_by)
  VALUES (_s.audience, _s.kind, CASE WHEN _new_version THEN left(regexp_replace(_s.title,' \(v\d+\)$','') || ' (v' || _ver || ')',200) ELSE left('Cópia de ' || _s.title,200) END,
    _s.description, _s.track_id, _s.training_name, _s.class_name, _s.standalone_reason, _s.email_subject, _s.email_body, _s.deadline_days, _s.reminder_enabled, _s.reminder_after_days, _ver, _id, auth.uid())
  RETURNING id INTO _new;
  INSERT INTO research_questions(survey_id, position, type, indicator, prompt, required, options, scale_min, scale_max, min_label, max_label)
  SELECT _new, position, type, indicator, prompt, required, options, scale_min, scale_max, min_label, max_label FROM research_questions WHERE survey_id=_id;
  RETURN _new;
END $$;

CREATE FUNCTION public.research_requeue_blocked(_survey uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _n int;
BEGIN
  IF NOT research_can('surveys_send') THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
  UPDATE research_email_jobs j SET status='queued', next_attempt_at=now(), last_error=NULL, attempts=CASE WHEN j.status='failed' THEN 0 ELSE j.attempts END, updated_at=now()
  FROM research_surveys s WHERE s.id=j.survey_id AND j.status IN ('blocked_config','failed') AND (_survey IS NULL OR j.survey_id=_survey)
    AND s.status='active' AND s.deadline_at > now();
  GET DIAGNOSTICS _n = ROW_COUNT;
  UPDATE research_invitations i SET send_status='queued', last_error=NULL WHERE send_status IN ('blocked_config','failed') AND (_survey IS NULL OR survey_id=_survey)
    AND EXISTS(SELECT 1 FROM research_email_jobs j WHERE j.invitation_id=i.id AND j.kind='invite' AND j.status='queued');
  RETURN _n;
END $$;

CREATE FUNCTION public.research_get_form(_token text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE _inv research_invitations%ROWTYPE; _s research_surveys%ROWTYPE;
BEGIN
  IF _token IS NULL OR _token !~ '^[0-9a-f]{64}$' THEN RETURN jsonb_build_object('state','invalid'); END IF;
  SELECT i.* INTO _inv FROM research_invitation_tokens t JOIN research_invitations i ON i.id=t.invitation_id WHERE t.token=_token;
  IF NOT FOUND THEN RETURN jsonb_build_object('state','invalid'); END IF;
  SELECT * INTO _s FROM research_surveys WHERE id=_inv.survey_id;
  IF _s.status = 'draft' THEN RETURN jsonb_build_object('state','invalid'); END IF;
  IF _inv.responded_at IS NOT NULL THEN RETURN jsonb_build_object('state','answered','title',_s.title); END IF;
  IF _s.status <> 'active' OR _s.deadline_at <= now() THEN RETURN jsonb_build_object('state','closed','title',_s.title,'deadline_at',_s.deadline_at); END IF;
  RETURN jsonb_build_object('state','open','title',_s.title,'description',_s.description,'audience',_s.audience,'deadline_at',_s.deadline_at,
    'questions', coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'type',type,'indicator',indicator,'prompt',prompt,'required',required,'options',options,'scale_min',scale_min,'scale_max',scale_max,'min_label',min_label,'max_label',max_label) ORDER BY position, created_at) FROM research_questions WHERE survey_id=_s.id),'[]'::jsonb));
END $$;

CREATE FUNCTION public.research_submit_response(_token text, _answers jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _inv research_invitations%ROWTYPE; _s research_surveys%ROWTYPE; _q record; _v jsonb; _rows jsonb := '[]'::jsonb; _resp uuid; _num numeric; _txt text;
BEGIN
  IF _token IS NULL OR _token !~ '^[0-9a-f]{64}$' THEN RETURN jsonb_build_object('state','invalid'); END IF;
  IF _answers IS NULL OR jsonb_typeof(_answers) <> 'object' THEN RETURN jsonb_build_object('state','error','message','Respostas inválidas'); END IF;
  SELECT i.* INTO _inv FROM research_invitation_tokens t JOIN research_invitations i ON i.id=t.invitation_id WHERE t.token=_token FOR UPDATE OF i;
  IF NOT FOUND THEN RETURN jsonb_build_object('state','invalid'); END IF;
  SELECT * INTO _s FROM research_surveys WHERE id=_inv.survey_id;
  IF _s.status = 'draft' THEN RETURN jsonb_build_object('state','invalid'); END IF;
  IF _inv.responded_at IS NOT NULL THEN RETURN jsonb_build_object('state','answered'); END IF;
  IF _s.status <> 'active' OR _s.deadline_at <= now() THEN RETURN jsonb_build_object('state','closed'); END IF;

  FOR _q IN SELECT * FROM research_questions WHERE survey_id=_s.id ORDER BY position, created_at LOOP
    _v := _answers -> (_q.id::text);
    IF _v IS NULL OR _v = 'null'::jsonb OR (jsonb_typeof(_v)='string' AND btrim(_v #>> '{}') = '') OR (jsonb_typeof(_v)='array' AND jsonb_array_length(_v)=0) THEN
      IF _q.required THEN RETURN jsonb_build_object('state','error','message','Responda às perguntas obrigatórias','question_id',_q.id); END IF;
      CONTINUE;
    END IF;
    IF _q.type = 'scale' THEN
      IF jsonb_typeof(_v) <> 'number' THEN RETURN jsonb_build_object('state','error','message','Nota inválida','question_id',_q.id); END IF;
      _num := (_v #>> '{}')::numeric;
      IF _num <> trunc(_num) OR _num < _q.scale_min OR _num > _q.scale_max THEN RETURN jsonb_build_object('state','error','message','Nota fora da escala','question_id',_q.id); END IF;
      _rows := _rows || jsonb_build_array(jsonb_build_object('q',_q.id,'ind',_q.indicator,'n',_num::int));
    ELSIF _q.type = 'single' THEN
      IF jsonb_typeof(_v) <> 'string' OR NOT (_q.options ? (_v #>> '{}')) THEN RETURN jsonb_build_object('state','error','message','Opção inválida','question_id',_q.id); END IF;
      _rows := _rows || jsonb_build_array(jsonb_build_object('q',_q.id,'c',jsonb_build_array(_v #>> '{}')));
    ELSIF _q.type = 'multiple' THEN
      IF jsonb_typeof(_v) <> 'array' OR EXISTS(SELECT 1 FROM jsonb_array_elements(_v) e WHERE jsonb_typeof(e) <> 'string' OR NOT (_q.options ? (e #>> '{}'))) THEN
        RETURN jsonb_build_object('state','error','message','Opção inválida','question_id',_q.id); END IF;
      _rows := _rows || jsonb_build_array(jsonb_build_object('q',_q.id,'c',(SELECT jsonb_agg(DISTINCT e) FROM jsonb_array_elements_text(_v) e)));
    ELSE
      IF jsonb_typeof(_v) <> 'string' THEN RETURN jsonb_build_object('state','error','message','Texto inválido','question_id',_q.id); END IF;
      _txt := btrim(_v #>> '{}');
      IF length(_txt) > 2000 THEN RETURN jsonb_build_object('state','error','message','Texto muito longo (máximo 2.000 caracteres)','question_id',_q.id); END IF;
      _rows := _rows || jsonb_build_array(jsonb_build_object('q',_q.id,'t',_txt));
    END IF;
  END LOOP;
  IF jsonb_array_length(_rows) = 0 THEN RETURN jsonb_build_object('state','error','message','Responda ao menos uma pergunta'); END IF;

  INSERT INTO research_responses(invitation_id, survey_id) VALUES (_inv.id, _s.id) ON CONFLICT (invitation_id) DO NOTHING RETURNING id INTO _resp;
  IF _resp IS NULL THEN RETURN jsonb_build_object('state','answered'); END IF;
  INSERT INTO research_answers(response_id, survey_id, question_id, indicator, numeric_value, choice_values, text_value)
  SELECT _resp, _s.id, (r->>'q')::uuid, r->>'ind', (r->>'n')::int,
    CASE WHEN r ? 'c' THEN ARRAY(SELECT jsonb_array_elements_text(r->'c')) END, r->>'t'
  FROM jsonb_array_elements(_rows) r;
  UPDATE research_invitations SET responded_at=now() WHERE id=_inv.id;
  UPDATE research_email_jobs SET status='skipped', last_error='Já respondeu', updated_at=now() WHERE invitation_id=_inv.id AND kind<>'invite' AND status IN ('queued','blocked_config');
  RETURN jsonb_build_object('state','submitted');
END $$;

CREATE FUNCTION public.research_scheduler_tick() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _closed int; _rem int;
BEGIN
  UPDATE research_surveys SET status='closed', closed_at=now(), updated_at=now() WHERE status='active' AND deadline_at <= now();
  GET DIAGNOSTICS _closed = ROW_COUNT;
  INSERT INTO research_email_jobs(invitation_id, survey_id, kind, dedupe_key, sender_email)
  SELECT i.id, s.id, 'reminder', 'r1', st.sender_email
  FROM research_invitations i JOIN research_surveys s ON s.id=i.survey_id JOIN research_settings st ON st.audience=s.audience
  WHERE s.status='active' AND s.reminder_enabled AND s.deadline_at > now() AND i.responded_at IS NULL
    AND i.send_status IN ('sent','delivered') AND i.sent_at + make_interval(days => s.reminder_after_days) <= now()
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS _rem = ROW_COUNT;
  RETURN jsonb_build_object('closed',_closed,'reminders_queued',_rem);
END $$;

CREATE FUNCTION public.research_claim_email_jobs(_limit integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _out jsonb;
BEGIN
  UPDATE research_email_jobs j SET status='skipped', last_error=CASE WHEN i.responded_at IS NOT NULL THEN 'Já respondeu' ELSE 'Pesquisa fechada' END, updated_at=now()
  FROM research_invitations i, research_surveys s
  WHERE i.id=j.invitation_id AND s.id=j.survey_id AND j.status='queued' AND j.kind<>'invite'
    AND (i.responded_at IS NOT NULL OR s.status<>'active' OR s.deadline_at <= now());
  UPDATE research_email_jobs j SET status='skipped', last_error='Pesquisa fechada', updated_at=now()
  FROM research_surveys s WHERE s.id=j.survey_id AND j.status='queued' AND j.kind='invite' AND (s.status<>'active' OR s.deadline_at <= now());
  WITH picked AS (
    SELECT id FROM research_email_jobs WHERE status='queued' AND next_attempt_at <= now() ORDER BY created_at LIMIT greatest(1, least(coalesce(_limit,50),200)) FOR UPDATE SKIP LOCKED
  ), upd AS (
    UPDATE research_email_jobs j SET status='processing', attempts=j.attempts+1, updated_at=now() FROM picked WHERE j.id=picked.id RETURNING j.*
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('job_id',u.id,'kind',u.kind,'attempts',u.attempts,'max_attempts',u.max_attempts,
     'invitation_id',i.id,'email',i.email,'name',i.name,'token',t.token,'survey_id',s.id,'title',s.title,'audience',s.audience,
     'subject',s.email_subject,'body',s.email_body,'deadline_at',s.deadline_at,'sender_email',st.sender_email,'sender_name',st.sender_name)),'[]'::jsonb)
  INTO _out
  FROM upd u JOIN research_invitations i ON i.id=u.invitation_id JOIN research_invitation_tokens t ON t.invitation_id=i.id
    JOIN research_surveys s ON s.id=u.survey_id JOIN research_settings st ON st.audience=s.audience;
  UPDATE research_invitations i SET send_status='sending' FROM research_email_jobs j WHERE j.invitation_id=i.id AND j.kind='invite' AND j.status='processing' AND i.send_status IN ('queued','blocked_config','failed');
  RETURN _out;
END $$;

CREATE FUNCTION public.research_complete_email_job(_job uuid, _outcome text, _provider_id text, _error text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _j research_email_jobs%ROWTYPE;
BEGIN
  SELECT * INTO _j FROM research_email_jobs WHERE id=_job FOR UPDATE; IF NOT FOUND THEN RETURN; END IF;
  IF _outcome = 'sent' THEN
    UPDATE research_email_jobs SET status='sent', provider_message_id=_provider_id, last_error=NULL, processed_at=now(), updated_at=now() WHERE id=_job;
    IF _j.kind='invite' THEN
      UPDATE research_invitations SET send_status='sent', sent_at=coalesce(sent_at,now()), provider_message_id=_provider_id, send_attempts=_j.attempts, last_error=NULL WHERE id=_j.invitation_id;
    ELSIF _j.kind='reminder' THEN
      UPDATE research_invitations SET last_reminder_at=now(), reminder_count=reminder_count+1 WHERE id=_j.invitation_id;
    END IF;
  ELSIF _outcome = 'blocked_config' THEN
    UPDATE research_email_jobs SET status='blocked_config', attempts=greatest(attempts-1,0), last_error=left(_error,500), updated_at=now() WHERE id=_job;
    IF _j.kind='invite' THEN UPDATE research_invitations SET send_status='blocked_config', last_error=left(_error,500) WHERE id=_j.invitation_id; END IF;
  ELSE
    IF _j.attempts < _j.max_attempts THEN
      UPDATE research_email_jobs SET status='queued', next_attempt_at=now() + make_interval(mins => (power(2,_j.attempts))::int * 5), last_error=left(_error,500), updated_at=now() WHERE id=_job;
      IF _j.kind='invite' THEN UPDATE research_invitations SET send_status='queued', send_attempts=_j.attempts, last_error=left(_error,500) WHERE id=_j.invitation_id; END IF;
    ELSE
      UPDATE research_email_jobs SET status='failed', last_error=left(_error,500), processed_at=now(), updated_at=now() WHERE id=_job;
      IF _j.kind='invite' THEN UPDATE research_invitations SET send_status='failed', send_attempts=_j.attempts, last_error=left(_error,500) WHERE id=_j.invitation_id; END IF;
    END IF;
  END IF;
END $$;

CREATE FUNCTION public.research_mark_delivered(_provider_id text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  UPDATE research_invitations SET send_status='delivered', delivered_at=now() WHERE provider_message_id=_provider_id AND send_status='sent';
  UPDATE research_email_jobs SET status='delivered', updated_at=now() WHERE provider_message_id=_provider_id AND status='sent';
$$;

CREATE FUNCTION public.research_filtered_invitations(_f jsonb) RETURNS SETOF public.research_invitations LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT i.* FROM research_invitations i JOIN research_surveys s ON s.id=i.survey_id
  WHERE s.audience = _f->>'audience'
    AND (nullif(_f->>'survey_id','') IS NULL OR s.id = (_f->>'survey_id')::uuid)
    AND (nullif(_f->>'track_id','') IS NULL OR s.track_id = (_f->>'track_id')::uuid)
    AND (nullif(_f->>'training','') IS NULL OR lower(coalesce(i.training_name, s.training_name)) = lower(_f->>'training'))
    AND (nullif(_f->>'class_name','') IS NULL OR lower(s.class_name) = lower(_f->>'class_name'))
    AND (nullif(_f->>'company','') IS NULL OR lower(i.company) = lower(_f->>'company'))
    AND (nullif(_f->>'area','') IS NULL OR lower(i.area) = lower(_f->>'area'))
    AND (coalesce(_f->>'responded','all') = 'all' OR (_f->>'responded' = 'yes' AND i.responded_at IS NOT NULL) OR (_f->>'responded' = 'no' AND i.responded_at IS NULL))
    AND (nullif(_f->>'send_status','') IS NULL OR i.send_status = _f->>'send_status')
    AND (
      (nullif(_f->>'from','') IS NULL AND nullif(_f->>'to','') IS NULL) OR
      (CASE coalesce(_f->>'date_basis','sent')
         WHEN 'training' THEN i.training_date
         WHEN 'response' THEN (i.responded_at AT TIME ZONE 'America/Sao_Paulo')::date
         ELSE (coalesce(i.sent_at, i.created_at) AT TIME ZONE 'America/Sao_Paulo')::date END)
       BETWEEN coalesce(nullif(_f->>'from','')::date, DATE '1900-01-01') AND coalesce(nullif(_f->>'to','')::date, DATE '2999-12-31'));
$$;

CREATE FUNCTION public.research_dashboard(_f jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE _ident boolean; _out jsonb;
BEGIN
  IF NOT research_can('indicators_view') THEN RAISE EXCEPTION 'Sem permissão para indicadores' USING ERRCODE='42501'; END IF;
  IF coalesce(_f->>'audience','') NOT IN ('interno','clientes') THEN RAISE EXCEPTION 'Selecione o público'; END IF;
  _ident := research_can('responses_identified');
  WITH inv AS (SELECT * FROM research_filtered_invitations(_f)),
  ans AS (SELECT a.*, r.submitted_at, r.invitation_id FROM research_answers a JOIN research_responses r ON r.id=a.response_id JOIN inv ON inv.id=r.invitation_id),
  nps AS (SELECT numeric_value v FROM ans WHERE indicator='nps' AND numeric_value IS NOT NULL),
  csat AS (SELECT numeric_value v FROM ans WHERE indicator='csat' AND numeric_value IS NOT NULL)
  SELECT jsonb_build_object(
    'counts', (SELECT jsonb_build_object('invited',count(*),
       'sent_ok',count(*) FILTER (WHERE send_status IN ('sent','delivered')),
       'delivered',count(*) FILTER (WHERE send_status='delivered'),
       'failed',count(*) FILTER (WHERE send_status='failed'),
       'blocked_config',count(*) FILTER (WHERE send_status='blocked_config'),
       'pending',count(*) FILTER (WHERE send_status IN ('queued','sending')),
       'responded',count(*) FILTER (WHERE responded_at IS NOT NULL),
       'responded_of_sent',count(*) FILTER (WHERE responded_at IS NOT NULL AND send_status IN ('sent','delivered')),
       'non_responded',count(*) FILTER (WHERE responded_at IS NULL AND send_status IN ('sent','delivered'))) FROM inv),
    'nps', (SELECT jsonb_build_object('n',count(*),'promoters',count(*) FILTER (WHERE v>=9),'passives',count(*) FILTER (WHERE v BETWEEN 7 AND 8),'detractors',count(*) FILTER (WHERE v<=6),'avg',round(avg(v),2),
       'dist',(SELECT jsonb_agg(jsonb_build_object('score',g,'count',(SELECT count(*) FROM nps WHERE v=g)) ORDER BY g) FROM generate_series(0,10) g)) FROM nps),
    'csat', (SELECT jsonb_build_object('n',count(*),'satisfied',count(*) FILTER (WHERE v>=4),'avg',round(avg(v),2),
       'dist',(SELECT jsonb_agg(jsonb_build_object('score',g,'count',(SELECT count(*) FROM csat WHERE v=g)) ORDER BY g) FROM generate_series(1,5) g)) FROM csat),
    'scales', (SELECT coalesce(jsonb_agg(x ORDER BY x->>'survey', (x->>'position')::int),'[]'::jsonb) FROM (
       SELECT jsonb_build_object('question_id',q.id,'prompt',q.prompt,'survey',s.title,'position',q.position,'min',q.scale_min,'max',q.scale_max,'n',count(a.id),'avg',round(avg(a.numeric_value),2)) x
       FROM research_questions q JOIN research_surveys s ON s.id=q.survey_id JOIN ans a ON a.question_id=q.id
       WHERE q.type='scale' AND q.indicator IS NULL AND a.numeric_value IS NOT NULL GROUP BY q.id, s.title) z),
    'choices', (SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (
       SELECT jsonb_build_object('question_id',q.id,'prompt',q.prompt,'survey',s.title,'n',count(DISTINCT a.response_id),
         'options',(SELECT jsonb_agg(jsonb_build_object('label',o,'count',(SELECT count(*) FROM ans a2 WHERE a2.question_id=q.id AND o = ANY(a2.choice_values)))) FROM jsonb_array_elements_text(q.options) o)) x
       FROM research_questions q JOIN research_surveys s ON s.id=q.survey_id JOIN ans a ON a.question_id=q.id
       WHERE q.type IN ('single','multiple') GROUP BY q.id, s.title) z),
    'comments', (SELECT coalesce(jsonb_agg(c),'[]'::jsonb) FROM (
       SELECT jsonb_build_object('text',a.text_value,'question',q.prompt,'survey',s.title,'submitted_at',a.submitted_at,'company',i.company,'area',i.area,
         'name',CASE WHEN _ident THEN i.name END,'email',CASE WHEN _ident THEN i.email END) c
       FROM ans a JOIN research_questions q ON q.id=a.question_id JOIN research_surveys s ON s.id=a.survey_id JOIN inv i ON i.id=a.invitation_id
       WHERE a.text_value IS NOT NULL AND btrim(a.text_value) <> '' ORDER BY a.submitted_at DESC LIMIT 300) z),
    'timeline', (SELECT coalesce(jsonb_agg(jsonb_build_object('period',period,'responses',responses,'nps_n',nps_n,'nps_p',nps_p,'nps_d',nps_d,'csat_n',csat_n,'csat_s',csat_s) ORDER BY period),'[]'::jsonb) FROM (
       SELECT to_char(date_trunc('month', submitted_at AT TIME ZONE 'America/Sao_Paulo'),'YYYY-MM') AS period,
         count(DISTINCT response_id) AS responses,
         count(*) FILTER (WHERE indicator='nps') AS nps_n, count(*) FILTER (WHERE indicator='nps' AND numeric_value>=9) AS nps_p, count(*) FILTER (WHERE indicator='nps' AND numeric_value<=6) AS nps_d,
         count(*) FILTER (WHERE indicator='csat') AS csat_n, count(*) FILTER (WHERE indicator='csat' AND numeric_value>=4) AS csat_s
       FROM ans GROUP BY 1) z),
    'identified', _ident
  ) INTO _out;
  RETURN _out;
END $$;

CREATE FUNCTION public.research_export(_f jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE _ident boolean;
BEGIN
  IF NOT research_can('indicators_view') THEN RAISE EXCEPTION 'Sem permissão para exportar' USING ERRCODE='42501'; END IF;
  IF coalesce(_f->>'audience','') NOT IN ('interno','clientes') THEN RAISE EXCEPTION 'Selecione o público'; END IF;
  _ident := research_can('responses_identified');
  RETURN jsonb_build_object('identified',_ident,
    'invitations', (SELECT coalesce(jsonb_agg(jsonb_build_object('survey',s.title,'version',s.version,'audience',s.audience,'training',coalesce(i.training_name,s.training_name),'training_date',i.training_date,
        'class_name',s.class_name,'course',t.title,'company',i.company,'area',i.area,'send_status',i.send_status,'sent_at',i.sent_at,'delivered_at',i.delivered_at,'responded_at',i.responded_at,
        'reminders',i.reminder_count,'name',CASE WHEN _ident THEN i.name END,'email',CASE WHEN _ident THEN i.email END) ORDER BY s.title, i.created_at),'[]'::jsonb)
      FROM research_filtered_invitations(_f) i JOIN research_surveys s ON s.id=i.survey_id LEFT JOIN tracks t ON t.id=s.track_id),
    'answers', (SELECT coalesce(jsonb_agg(jsonb_build_object('survey',s.title,'question',q.prompt,'indicator',a.indicator,'value',a.numeric_value,'choices',array_to_string(a.choice_values,'; '),'text',a.text_value,
        'submitted_at',r.submitted_at,'company',i.company,'area',i.area,'training',coalesce(i.training_name,s.training_name),'name',CASE WHEN _ident THEN i.name END,'email',CASE WHEN _ident THEN i.email END) ORDER BY r.submitted_at, q.position),'[]'::jsonb)
      FROM research_filtered_invitations(_f) i JOIN research_responses r ON r.invitation_id=i.id JOIN research_answers a ON a.response_id=r.id
        JOIN research_questions q ON q.id=a.question_id JOIN research_surveys s ON s.id=i.survey_id));
END $$;

CREATE FUNCTION public.research_filter_options(_audience text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT research_has_any() THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object(
    'trainings', (SELECT coalesce(jsonb_agg(DISTINCT x ORDER BY x),'[]') FROM (SELECT coalesce(i.training_name,s.training_name) x FROM research_invitations i JOIN research_surveys s ON s.id=i.survey_id WHERE s.audience=_audience UNION SELECT training_name FROM research_attendance WHERE audience=_audience UNION SELECT training_name FROM research_surveys WHERE audience=_audience) z WHERE x IS NOT NULL),
    'companies', (SELECT coalesce(jsonb_agg(DISTINCT x ORDER BY x),'[]') FROM (SELECT i.company x FROM research_invitations i JOIN research_surveys s ON s.id=i.survey_id WHERE s.audience=_audience UNION SELECT company FROM research_attendance WHERE audience=_audience UNION SELECT company_name FROM research_employee_bases WHERE audience=_audience) z WHERE x IS NOT NULL),
    'areas', (SELECT coalesce(jsonb_agg(DISTINCT x ORDER BY x),'[]') FROM (SELECT i.area x FROM research_invitations i JOIN research_surveys s ON s.id=i.survey_id WHERE s.audience=_audience UNION SELECT area FROM research_attendance WHERE audience=_audience UNION SELECT e.area FROM research_employees e JOIN research_employee_bases b ON b.id=e.base_id WHERE b.audience=_audience) z WHERE x IS NOT NULL),
    'classes', (SELECT coalesce(jsonb_agg(DISTINCT class_name ORDER BY class_name),'[]') FROM research_surveys WHERE audience=_audience AND class_name IS NOT NULL),
    'courses', (SELECT coalesce(jsonb_agg(DISTINCT jsonb_build_object('id',t.id,'title',t.title)),'[]') FROM research_surveys s JOIN tracks t ON t.id=s.track_id WHERE s.audience=_audience));
END $$;

CREATE FUNCTION public.research_import_employee_base(_p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _aud text := _p->>'audience'; _company text := nullif(btrim(_p->>'company_name'),''); _ref date := nullif(_p->>'reference_date','')::date;
  _policy text := _p->>'absent_policy'; _prev research_employee_bases%ROWTYPE; _base uuid; _ver int; _r jsonb; _email text; _ext text; _name text;
  _imported int := 0; _rejected int := 0; _dups int := 0; _carried int := 0; _inactivated int := 0; _removed int := 0; _n int;
BEGIN
  IF NOT research_can('lists_import') THEN RAISE EXCEPTION 'Sem permissão para importar bases' USING ERRCODE='42501'; END IF;
  IF _aud NOT IN ('interno','clientes') THEN RAISE EXCEPTION 'Selecione o público'; END IF;
  IF _company IS NULL THEN RAISE EXCEPTION 'Informe a empresa da base'; END IF;
  IF _ref IS NULL THEN RAISE EXCEPTION 'Informe a data de referência da base'; END IF;
  IF _policy NOT IN ('keep','inactivate','remove') THEN RAISE EXCEPTION 'Escolha o que fazer com pessoas ausentes da nova planilha'; END IF;
  IF jsonb_typeof(_p->'rows') <> 'array' OR jsonb_array_length(_p->'rows') = 0 THEN RAISE EXCEPTION 'A planilha não tem registros'; END IF;
  IF jsonb_array_length(_p->'rows') > 50000 THEN RAISE EXCEPTION 'Limite de 50.000 registros por base'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('research_base:'||_aud||':'||lower(_company)));
  SELECT * INTO _prev FROM research_employee_bases WHERE audience=_aud AND lower(btrim(company_name))=lower(_company) ORDER BY version DESC LIMIT 1;
  _ver := coalesce(_prev.version,0) + 1;
  INSERT INTO research_employee_bases(audience, company_name, reference_date, version, previous_base_id, absent_policy, source_file_name, created_by)
  VALUES (_aud, _company, _ref, _ver, _prev.id, _policy, left(_p->>'source_file_name',255), auth.uid()) RETURNING id INTO _base;
  FOR _r IN SELECT * FROM jsonb_array_elements(_p->'rows') LOOP
    _email := nullif(lower(btrim(_r->>'email')),''); _ext := nullif(btrim(_r->>'external_id'),''); _name := left(btrim(coalesce(_r->>'name','')),200);
    IF _name = '' OR (_email IS NULL AND _ext IS NULL) OR (_email IS NOT NULL AND NOT research_email_ok(_email)) THEN _rejected := _rejected + 1; CONTINUE; END IF;
    IF EXISTS(SELECT 1 FROM research_employees WHERE base_id=_base AND ((_email IS NOT NULL AND email=_email) OR (_ext IS NOT NULL AND external_id=left(_ext,120)))) THEN _dups := _dups + 1; CONTINUE; END IF;
    INSERT INTO research_employees(base_id, external_id, name, email, area, company, active, origin)
    VALUES (_base, left(_ext,120), _name, _email, left(nullif(btrim(_r->>'area'),''),120), left(coalesce(nullif(btrim(_r->>'company'),''),_company),200),
      CASE WHEN lower(coalesce(_r->>'active','true')) IN ('false','0','inativo','inactive','não','nao') THEN false ELSE true END, 'imported');
    _imported := _imported + 1;
  END LOOP;
  IF _imported = 0 THEN RAISE EXCEPTION 'Nenhum registro válido na planilha'; END IF;
  IF _prev.id IS NOT NULL THEN
    SELECT count(*) INTO _n FROM research_employees e WHERE e.base_id=_prev.id
      AND NOT EXISTS(SELECT 1 FROM research_employees x WHERE x.base_id=_base AND ((e.email IS NOT NULL AND x.email=e.email) OR (e.external_id IS NOT NULL AND x.external_id=e.external_id)));
    IF _policy = 'remove' THEN _removed := _n;
    ELSE
      INSERT INTO research_employees(base_id, external_id, name, email, area, company, active, origin)
      SELECT _base, e.external_id, e.name, e.email, e.area, e.company, CASE WHEN _policy='inactivate' THEN false ELSE e.active END, 'carried'
      FROM research_employees e WHERE e.base_id=_prev.id
        AND NOT EXISTS(SELECT 1 FROM research_employees x WHERE x.base_id=_base AND ((e.email IS NOT NULL AND x.email=e.email) OR (e.external_id IS NOT NULL AND x.external_id=e.external_id)))
      ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS _carried = ROW_COUNT;
      IF _policy = 'inactivate' THEN _inactivated := _carried; END IF;
    END IF;
  END IF;
  UPDATE research_employee_bases SET summary = coalesce(_p->'client_summary','{}'::jsonb) || jsonb_build_object('imported',_imported,'rejected',_rejected,'duplicates',_dups,'carried',_carried,'inactivated',_inactivated,'removed',_removed,
     'active',(SELECT count(*) FROM research_employees WHERE base_id=_base AND active),'total',(SELECT count(*) FROM research_employees WHERE base_id=_base)) WHERE id=_base;
  INSERT INTO audit_logs(user_id, action, entity_type, entity_id, details) VALUES (auth.uid(),'research_import_employee_base','research_employee_bases',_base::text, jsonb_build_object('version',_ver,'imported',_imported,'policy',_policy));
  RETURN jsonb_build_object('base_id',_base,'version',_ver,'imported',_imported,'rejected',_rejected,'duplicates',_dups,'carried',_carried,'inactivated',_inactivated,'removed',_removed);
END $$;

CREATE FUNCTION public.research_reach(_f jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE _b research_employee_bases%ROWTYPE; _from date := nullif(_f->>'from','')::date; _to date := nullif(_f->>'to','')::date;
  _area text := nullif(_f->>'area',''); _den int; _num int; _num_att int; _num_ead int; _unmatched int; _noemail int; _binfo jsonb;
BEGIN
  IF NOT research_can('indicators_view') THEN RAISE EXCEPTION 'Sem permissão para indicadores' USING ERRCODE='42501'; END IF;
  SELECT * INTO _b FROM research_employee_bases WHERE id = nullif(_f->>'base_id','')::uuid AND audience = _f->>'audience';
  IF NOT FOUND THEN RETURN jsonb_build_object('status','insufficient','reason','Nenhuma base válida selecionada'); END IF;
  _binfo := jsonb_build_object('id',_b.id,'company',_b.company_name,'reference_date',_b.reference_date,'version',_b.version);
  IF _from IS NULL OR _to IS NULL OR _to < _from THEN RETURN jsonb_build_object('status','insufficient','reason','Informe o período','base',_binfo); END IF;
  SELECT count(*), count(*) FILTER (WHERE email IS NULL) INTO _den, _noemail FROM research_employees WHERE base_id=_b.id AND active AND (_area IS NULL OR lower(area)=lower(_area));
  IF _den = 0 THEN RETURN jsonb_build_object('status','insufficient','reason','A base não tem pessoas ativas para os filtros','base',_binfo); END IF;
  WITH den AS (SELECT DISTINCT email FROM research_employees WHERE base_id=_b.id AND active AND email IS NOT NULL AND (_area IS NULL OR lower(area)=lower(_area))),
  att AS (SELECT DISTINCT email FROM research_attendance WHERE audience=_b.audience AND training_date BETWEEN _from AND _to),
  ead AS (SELECT DISTINCT lower(coalesce(p.email, u.email)) AS email FROM enrollments e JOIN profiles p ON p.user_id=e.user_id LEFT JOIN auth.users u ON u.id=e.user_id
          WHERE e.status='completed' AND e.completed_at IS NOT NULL AND (e.completed_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN _from AND _to)
  SELECT count(*) FILTER (WHERE d.email IN (SELECT email FROM att) OR d.email IN (SELECT email FROM ead WHERE email IS NOT NULL)),
         count(*) FILTER (WHERE d.email IN (SELECT email FROM att)),
         count(*) FILTER (WHERE d.email IN (SELECT email FROM ead WHERE email IS NOT NULL))
    INTO _num, _num_att, _num_ead FROM den d;
  SELECT count(DISTINCT a.email) INTO _unmatched FROM research_attendance a
   WHERE a.audience=_b.audience AND a.training_date BETWEEN _from AND _to AND lower(coalesce(a.company,_b.company_name))=lower(_b.company_name)
     AND (_area IS NULL OR lower(a.area)=lower(_area))
     AND NOT EXISTS(SELECT 1 FROM research_employees e WHERE e.base_id=_b.id AND e.email=a.email);
  RETURN jsonb_build_object('status','ok','denominator',_den,'numerator',_num,'from_attendance',_num_att,'from_courses',_num_ead,
    'unmatched_participants',_unmatched,'without_email',_noemail,'base',_binfo);
END $$;

REVOKE ALL ON FUNCTION public.research_import_list(jsonb), public.research_send_preview(uuid,uuid), public.research_send_survey(uuid,uuid,integer,boolean,integer),
  public.research_close_survey(uuid), public.research_extend_deadline(uuid,date,text), public.research_notify_extension(uuid), public.research_duplicate_survey(uuid,boolean),
  public.research_requeue_blocked(uuid), public.research_dashboard(jsonb), public.research_export(jsonb), public.research_filter_options(text),
  public.research_import_employee_base(jsonb), public.research_reach(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.research_import_list(jsonb), public.research_send_preview(uuid,uuid), public.research_send_survey(uuid,uuid,integer,boolean,integer),
  public.research_close_survey(uuid), public.research_extend_deadline(uuid,date,text), public.research_notify_extension(uuid), public.research_duplicate_survey(uuid,boolean),
  public.research_requeue_blocked(uuid), public.research_dashboard(jsonb), public.research_export(jsonb), public.research_filter_options(text),
  public.research_import_employee_base(jsonb), public.research_reach(jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.research_get_form(text), public.research_submit_response(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.research_get_form(text), public.research_submit_response(text,jsonb) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.research_scheduler_tick(), public.research_claim_email_jobs(integer), public.research_complete_email_job(uuid,text,text,text),
  public.research_mark_delivered(text), public.research_filtered_invitations(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.research_scheduler_tick(), public.research_claim_email_jobs(integer), public.research_complete_email_job(uuid,text,text,text),
  public.research_mark_delivered(text), public.research_filtered_invitations(jsonb) TO service_role;