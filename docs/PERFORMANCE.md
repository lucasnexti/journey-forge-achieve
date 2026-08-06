# Desempenho e Escalabilidade — LMA Universidade Nexti

Documento de diagnóstico, melhorias aplicadas, testes e procedimentos operacionais
para o alvo de **1.000 usuários simultâneos**.

## 1. Arquitetura observada

| Camada | Tecnologia |
| --- | --- |
| Frontend | React 18 + Vite 5 + TypeScript, Tailwind, shadcn/ui, React Query, Framer Motion, Recharts |
| Backend | Lovable Cloud (Postgres + PostgREST + Edge Functions Deno) |
| Regras críticas | RPCs `start_exam_attempt`, `submit_exam_attempt`, `validate_quiz_attempt`, `has_completed_all_lessons` (SECURITY DEFINER) |
| Vídeo | Vimeo (player embed + SDK) — **streaming adaptativo já fora do servidor da aplicação** |
| Autenticação | Supabase Auth (JWT no cliente, refresh automático) |

Premissa adotada: os vídeos permanecem no Vimeo, que já entrega HLS adaptativo por CDN
global. Portanto **nenhum byte de vídeo trafega pelo servidor da aplicação** — o item
"não usar o servidor principal para vídeo" já está atendido pela arquitetura atual.

## 2. Gargalos encontrados (por impacto)

| # | Prioridade | Gargalo | Evidência |
| --- | --- | --- | --- |
| 1 | Crítica | `lessons.track_id` sem índice | `pg_stat_user_tables`: **40.300 seq scans** vs 155 idx scans |
| 2 | Crítica | Envio de prova sem serialização | `submit_exam_attempt` fazia `SELECT` da sessão e só depois `UPDATE` — dois envios concorrentes podiam gravar duas tentativas |
| 3 | Alta | ~20 chaves estrangeiras sem índice (`lesson_progress.track_id`, `quiz_questions.quiz_id`, `certificates.user_id`, `forum_posts.track_id`, etc.) | `pg_indexes` + seq scans altos em `enrollments`, `quizzes`, `quiz_attempts` |
| 4 | Alta | Escrita de progresso a cada 15s de vídeo, sem deduplicação | 600 usuários ⇒ ~40 upserts/s; retentativas geravam writes redundantes |
| 5 | Média | `UPDATE profiles.last_active_at` bloqueante a cada aula concluída | write extra síncrona no caminho crítico |
| 6 | Média | Pré-carregamento baixava 1 MB do próximo vídeo | banda/custo de CDN desnecessários e concorrência com o vídeo em reprodução |
| 7 | Baixa | `getTrackProgressDB` consultava `quiz_attempts` sem uso na TrackPage | query extra por abertura de curso |

Já estavam corretos (verificados, sem alteração): code splitting por rota, React Query
com `staleTime` 5min/`gcTime` 30min, `manualChunks` no Vite, cronômetro de prova validado
no servidor, respostas corretas nunca expostas antes do envio, lock entre abas.

## 3. Melhorias implementadas

### Banco de dados (migration segura, apenas `CREATE INDEX IF NOT EXISTS` + `CREATE OR REPLACE FUNCTION`)
- **30 índices** criados cobrindo aulas, progresso, provas, quizzes, certificados, fórum,
  recompensas, treinamentos, auditoria e alertas.
- `submit_exam_attempt` agora é **idempotente e transacional**:
  - `pg_advisory_xact_lock(user, exam)` serializa envios concorrentes;
  - a sessão é reivindicada com `UPDATE ... WHERE submitted_at IS NULL RETURNING`,
    de modo que apenas um envio vence — o segundo recebe `no_active_session`;
  - o certificado usa `INSERT ... ON CONFLICT DO NOTHING` (sem duplicidade).
- Nenhum dado existente foi alterado ou removido.

### Frontend
- Intervalo de gravação de progresso: 15s → **30s** (metade das escritas), mantendo
  gravação imediata ao pausar, trocar de aba e sair.
- `savePartialProgressDB` com **coalescência**: ignora valores que não avançam,
  mantém no máximo 1 requisição em voo por aula e reenvia apenas o último valor pendente.
- `last_active_at` atualizado em segundo plano, no máximo 1x/minuto.
- Pré-carregamento de vídeo reduzido a `preconnect` (sem baixar bytes de vídeo não iniciado).
- Consulta redundante de `quiz_attempts` removida da abertura de curso.

## 4. Testes

- Testes unitários: `bunx vitest run` (inclui a coalescência de progresso).
- Teste de carga: `scripts/load-test.mjs` — 1.000 usuários virtuais, rampa gradual,
  carga sustentada, mix 60% vídeo / 25% navegação / 15% prova; reporta p50/p95/p99,
  throughput e taxa de erro por operação.

```bash
SUPABASE_URL=... SUPABASE_ANON_KEY=... TEST_JWT=<token de usuário de teste> \
  node scripts/load-test.mjs --users 1000 --duration 120 --ramp 60
```

> Não executado contra produção: exige autorização explícita. Recomenda-se rodar contra
> um ambiente de homologação com massa de dados representativa.

## 5. Comparativo esperado

Com a base atual (poucas linhas) o planejador ainda escolhe *seq scan* — correto para
tabelas pequenas. O ganho dos índices aparece com volume: em `lesson_progress` e
`exam_attempts` com centenas de milhares de linhas, as consultas por usuário/curso passam
de O(n) para busca indexada. As reduções de escrita são imediatas e mensuráveis:

| Métrica | Antes | Depois |
| --- | --- | --- |
| Upserts de progresso (600 usuários assistindo) | ~40/s | ~20/s (e sem writes redundantes) |
| Writes por aula concluída | 2 síncronos | 1 síncrono + 1 assíncrono limitado a 1/min |
| Bytes de vídeo pré-baixados por troca de aula | até 1 MB | 0 |
| Tentativas duplicadas em envio concorrente | possíveis | impossíveis (lock + claim atômico) |

## 6. Estimativa de infraestrutura para 1.000 simultâneos

- **Vídeo**: 100% via CDN Vimeo — sem custo de banda no servidor da aplicação.
- **Banco**: com o mix acima, ~25–40 writes/s e ~150–250 reads/s. Recomenda-se a instância
  de Cloud com ≥ 2 vCPU / 4 GB e pooler (PgBouncer) em modo transaction — já é o padrão do
  Lovable Cloud. Monitorar saturação de conexões antes de escalar.
- **Escala horizontal**: o frontend é estático (CDN) e o backend não guarda estado em
  memória, então o crescimento além de 1.000 usuários é feito aumentando o tamanho da
  instância de banco (Cloud → Advanced settings → Upgrade instance).

## 7. Monitoramento e rollback

- Monitoramento: painel Admin → Monitoramento (SLO, latência, erros) + alertas em
  `alert_rules`; consultas lentas via `slow_queries`; saúde do banco via `db_health`.
- Rollback de índices: `DROP INDEX IF EXISTS <nome>;` — operação segura, sem perda de dados.
- Rollback da função: reaplicar a versão anterior de `submit_exam_attempt` via nova migration
  (a assinatura e o contrato de retorno não mudaram).

## 8. Riscos remanescentes

- Questões dissertativas continuam sem correção automática (comportamento existente).
- `AdminMonitoramento`, `AdminTrilhasGestao` e relatórios carregam listas completas sem
  paginação: aceitável no volume atual, mas deve receber paginação quando as tabelas
  passarem de alguns milhares de linhas.
- Sem fila assíncrona: certificados e notificações são gravados na própria transação —
  barato hoje, candidato a fila caso o volume de aprovações simultâneas cresça muito.
