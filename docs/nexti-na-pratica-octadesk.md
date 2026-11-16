# Nexti na Prática — levantamento da base Octadesk

Fonte: base de conhecimento Nexti no Octadesk (https://nexti.octadesk.com/kb), 46 artigos listados na página inicial.
Os artigos têm apenas o título e um PDF; nenhum informa data de atualização. Quando o PDF tem data, ela aparece no campo `origem.dataArquivo` da orientação.
Consulta feita em 16/11/2026. Vídeos não são incluídos.

Regras usadas:
- Conteúdo já validado na Universidade é mantido. Quando o PDF da fonte é igual ou equivalente, não há nova orientação.
- Telas com nomes, logins, e-mails, códigos de ativação ou fotos de pessoas são publicadas com esses dados ocultados (também no PDF disponibilizado).
- Novas orientações seguem o padrão da orientação de Escala e Horário e guardam a procedência em `origem` (artigos, arquivo, data do arquivo, data de importação).
- Dentro da Universidade o conteúdo vem do banco (knowledge_base_content); `dados.js` é a cópia de reserva. Os dois foram atualizados juntos.

## Situação por artigo

| Módulo | Orientação | Fonte no Octadesk | Situação | Pendências |
|---|---|---|---|---|
| Cadastros | Como cadastrar uma escala e um horário? (ori-0001) | Cadastro Horário e Escala Completo | Já existia — conferido, mesmas telas | — |
| Cadastros | Como cadastrar um feriado? (ori-0002) | Cadastro de feriado | Já existia — PDF idêntico | — |
| Cadastros | Como cadastrar biometria e senha no terminal? (ori-0003) | Cadastro Biometria e Senha Completo; Guia Cadastro Terminal e Vincular Biometria | Já existia — mesmo conteúdo; o guia de terminal repete o mesmo processo | — |
| Cadastros | Como cadastrar uma sanção disciplinar? (ori-0004) | Cadastro Sanção Disciplinar | Já existia — mesmas páginas | — |
| Cadastros | Quais são os tipos de usuário? (ori-0005) | Tipos de usuário | Já existia — mesmas páginas | — |
| Cadastros | Como configurar o Quiosque Facial e cadastrar a face dos colaboradores? (ori-0016) | Reconhecimento Facial; Cadastro de Facial | Importado nesta etapa | O artigo "Cadastro de Facial" só repete 2 telas do Quiosque Facial |
| Dashboard | Como configurar o Dashboard? / Widgets (ori-0006, ori-0007) | Guia Dashboard Completo | Já existia — mesmas páginas | — |
| Mesa de operações | Requisição, Mesa completa, Trocas e coberturas, Inconsistências, Ajuste em lote, Ausência em lote, Troca de horário em lote (ori-0008, 0009, 0011 a 0015) | Requisição de operação; Mesa de operação completo; Gestão de Trocas e Coberturas; Inconsistências; Ajuste de inconsistências em lote; Módulo de Ausência em lote; Módulo Troca de Horário em Lote | Já existiam — PDFs idênticos | Guias ainda em formato página a página |
| Mesa de operações | Como cadastrar e lançar uma ausência? (ori-0010) | Cadastro e lançamento de ausência | Já existia (PDF enviado pela equipe) | Artigo indisponível no Octadesk ("Artigo não encontrado") |
| RH Digital | Como enviar um aviso ou uma convocação? (ori-0017) | Guia Avisos e Convocações; Guia RH Digital Completo | Importado nesta etapa | — |
| RH Digital | Como criar e enviar um checklist? (ori-0018) | Guia Checklist; Guia RH Digital Completo | Importado nesta etapa | — |
| Nexti Direct | Como configurar e atender pelo Nexti Direct? (ori-0019) | Guia Rápido Nexti Direct; Guia RH Digital Completo | Importado nesta etapa | — |
| Nexti Docs | Como controlar o vencimento de documentos no Nexti Docs? (ori-0020) | Nexti Docs | Importado nesta etapa | — |
| Nexti Control | Como criar roteiros de visita no Nexti Control? (ori-0021) | Manual Control V1 | Importado nesta etapa | — |
| Nexti Control 2.0 | Como programar visitas de supervisão no Nexti Control 2.0? (ori-0022) | Nexti Control 2.0 - Supervisor | Importado nesta etapa | — |
| Nexti Control 2.0 | Como programar rondas operacionais no Nexti Control 2.0? (ori-0023) | Nexti Control 2.0 - Operacional | Importado nesta etapa | — |
| Nexti Time | — | Guia Nexti Time Completo (84 páginas) | Pendente — próxima etapa | — |
| Nexti Plus | — | Guia Nexti Plus Completo (70 páginas); Vale Transporte; VR VA VC; Vale Combustível; Gratificação | Pendente — próxima etapa | Conferir se os guias de benefício repetem o guia completo |
| (a definir) | — | Perfil de apuração completo e 4 guias de Perfil de apuração | Pendente | Não há módulo de apuração; definir onde ficam |
| Talent (módulo novo) | ori-0030 a ori-0046 | Guia de uso - Nexti Talent (157 páginas; sem data no arquivo) | Importado em 16/11/2026 | 17 orientações em 6 assuntos; 93 telas e PDF resumido com nomes, e-mails, telefones, CNPJ e dados de candidatos ocultados |
| (a definir) | — | Guia Aplicativo Colaborador; Solicitação Ajuste ponto Colaborador | Pendente | Não há módulo de aplicativo; definir onde ficam |
| Cadastros > Terminais | ori-0024 a ori-0027 | Manual Configuração APN; Manual Configuração WIFI; Manual de Fixação dos Terminais; Manual Sincronização via Bluetooth; Resolvendo Problemas nos Terminais | Importado em 16/11/2026 | Decisão da Aline: terminais em Cadastros |
| RH Digital > Aplicativo do colaborador | ori-0028, ori-0029 | Guia Aplicativo Colaborador; Solicitação Ajuste ponto Colaborador | Importado em 16/11/2026 | Decisão da Aline: aplicativo em RH Digital |
| (a definir) | — | Escopo Inicial de Integração | Pendente | Definir se entra na base |
| — | — | Apresentação Nexti | Não incluído | É um vídeo |

## Assistente dos manuais (IA) — uso da base Octadesk

Em 16/11/2026 os 46 artigos da base foram preparados para o assistente: 45 PDFs lidos pelo texto (sem ler imagens, para não captar dados pessoais das telas) e, quando existe, a orientação publicada do Nexti na Prática feita a partir do artigo. "Apresentação Nexti" é vídeo e ficou de fora; "Cadastro de Facial" e "Requisição de operação" têm PDF só com imagens (a Requisição é respondida pela orientação do Nexti na Prática).
Os artigos entram aprovados para clientes (base pública); o administrador pode excluir ou mudar público/módulo em Admin → Assistente IA.
Para atualizar: rodar `scripts/assistant-octadesk/crawl.py` e `build.py` (em /tmp/octa), enviar o índice para `assistant-knowledge/octadesk/index.json` e executar a ação `import_octadesk` da função `notion-knowledge` como administrador. A atualização não é automática.
