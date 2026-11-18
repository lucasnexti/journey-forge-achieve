ALTER TABLE public.research_settings ADD COLUMN sending_enabled boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.research_claim_email_jobs(_limit integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
     'subject',s.email_subject,'body',s.email_body,'deadline_at',s.deadline_at,'sender_email',st.sender_email,'sender_name',st.sender_name,'sending_enabled',st.sending_enabled)),'[]'::jsonb)
  INTO _out
  FROM upd u JOIN research_invitations i ON i.id=u.invitation_id JOIN research_invitation_tokens t ON t.invitation_id=i.id
    JOIN research_surveys s ON s.id=u.survey_id JOIN research_settings st ON st.audience=s.audience;
  UPDATE research_invitations i SET send_status='sending' FROM research_email_jobs j WHERE j.invitation_id=i.id AND j.kind='invite' AND j.status='processing' AND i.send_status IN ('queued','blocked_config','failed');
  RETURN _out;
END $$;
REVOKE ALL ON FUNCTION public.research_claim_email_jobs(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.research_claim_email_jobs(integer) TO service_role;