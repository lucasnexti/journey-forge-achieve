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
- `AdminMonitoramento` e `AdminTrilhasGestao` ainda carregam listas completas sem paginação:
  aceitável no volume atual, mas deve receber paginação quando as tabelas passarem de alguns
  milhares de linhas. O relatório de progresso já agrega no banco via
  `admin_enrollment_report(_track_id)` (RPC `SECURITY DEFINER` restrita a administradores),
  eliminando o download de todas as matrículas para o navegador.

- Sem fila assíncrona: certificados e notificações são gravados na própria transação —
  barato hoje, candidato a fila caso o volume de aprovações simultâneas cresça muito.

---

## 9. Rodada 2 — diagnóstico com evidências (medido em produção, leitura apenas)

Linha de base coletada de `pg_stat_statements`, `pg_stat_user_tables`, `pg_indexes` e `db_health`.

| Problema | Evidência | Localização | Impacto | Severidade | Solução | Esforço | Risco | Validação |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dois escritores independentes de presença (`profiles.last_active_at`) | `pg_stat_statements`: 1.189 chamadas, média **44ms**, pico **3.514ms** — operação mais lenta por chamada | `usePresenceHeartbeat.ts` + `progressDB.touchLastActive` | Até 2 writes/min/usuário (~33 writes/s com 1.000 usuários) numa tabela com trigger `updated_at` | Alta (P1) | Escritor único, janela de 2min, pausa com aba oculta | Baixo | Baixo (só reduz frequência) | Teste unitário `presence.test.ts` |
| Upsert de progresso é a operação de maior custo total | 76.375 chamadas, **539.974ms** totais, pico 1.684ms | `progressDB.savePartialProgressDB` | Domina o custo de escrita do banco | Alta (P1) | Já mitigado (intervalo 30s + coalescência); mantido sob observação | — | — | `progressDB.test.ts` |
| Busca global usa `ilike '%termo%'` sem índice | Plano `Seq Scan on lessons ... Filter: (title ~~* '%gest%')` | `GlobalSearch.tsx` (tracks/lessons/lesson_materials) | Varredura completa a cada busca; degrada linearmente com o catálogo | Média (P2) | Índices GIN `pg_trgm` nas colunas `title` | Baixo | Baixo (`CREATE INDEX IF NOT EXISTS`) | `EXPLAIN` com volume real |
| Contagem exata desnecessária no sino de notificações | `count: "exact"` gera segunda varredura (`pgrst_source_count`), 6.499 chamadas | `NotificationBell.tsx` | 2 queries por carga sem uso do total | Baixa (P3) | Remover `count` + índice parcial de não lidas | Baixo | Nenhum | Slow queries |
| Teste de carga sem fases de pico/recuperação | `scripts/load-test.mjs` só tinha rampa + sustentação | script | Não comprova comportamento em pico | Média (P2) | Fases aquecimento → rampa → sustentação → pico → recuperação com percentis por fase | Baixo | Nenhum | Execução do script |

Saúde atual do banco (`db_health`): banco e PgBouncer no ar, memória 34%, disco 4%,
conexões 7/60, pool 1/200, 0 reinícios. **Não há saturação de pool nem de memória hoje** —
o limite prático virá de writes de progresso, não de conexões.

### Implementado nesta rodada
- Migration (somente `CREATE EXTENSION/INDEX IF NOT EXISTS`, sem alterar dados):
  `idx_tracks_title_trgm`, `idx_lessons_title_trgm`, `idx_lesson_materials_title_trgm`,
  `idx_notifications_user_unread` (parcial, `read = false`).
- `src/lib/presence.ts`: escritor único de presença (janela 2min, pausa com aba oculta,
  sem chamadas concorrentes, retry suavizado em erro).
- `usePresenceHeartbeat` e `markLessonCompleteDB` passam a usar esse escritor.
- `NotificationBell`: sem `count: "exact"`.
- `scripts/load-test.mjs`: fases de aquecimento, pico e recuperação + percentis por fase.
- Testes: `src/lib/presence.test.ts` (3 casos). Suíte: **7/7 passando**.

### Comparativo (analítico, derivado das métricas acima)

| Métrica | Antes | Depois |
| --- | --- | --- |
| Writes de presença por usuário/hora | até 60 (2 emissores × 1/min) | ≤ 30, e 0 com a aba em segundo plano |
| Queries por abertura do sino | 2 (dados + count) | 1 |
| Busca global por título | seq scan por tabela | índice GIN trigram (a partir de volume relevante) |
| Fases cobertas pelo teste de carga | 2 | 5 |

Observação honesta: com o volume atual (8 aulas, 3 perfis) o planejador continua
escolhendo *seq scan* — é o plano correto para tabelas mínimas. O ganho dos índices
trigram só é mensurável com catálogo real; o ganho de redução de writes é imediato.

### Critérios de aceitação — status
Atendidos por evidência: ausência de saturação de pool/memória; ausência de duplicidade
em provas (lock + claim atômico, rodada 1); nenhuma regressão funcional (suíte verde).
**Não comprovados**: p95 < 500ms sob 1.000 usuários e estabilidade em carga sustentada —
exigem execução do `scripts/load-test.mjs` contra homologação com massa representativa,
o que não foi executado por não haver autorização para gerar carga em produção.

### Próximos passos recomendados (não executados — exigem autorização/escopo maior)
1. Rodar o teste de carga em homologação e anexar os percentis reais.
2. Paginação em `AdminMonitoramento` e `AdminTrilhasGestao` (hoje carregam listas completas).
3. Fila assíncrona para certificados/notificações se o volume de aprovações simultâneas crescer.
4. Substituir o heartbeat de presença por Realtime Presence (zero writes no Postgres).
