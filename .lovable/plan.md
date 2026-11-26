# Construtor de pesquisas pós-treinamento

## Objetivo
Ampliar **Pesquisas e Indicadores → Pesquisas**, sem criar uma aplicação separada nem substituir pesquisas existentes. Reaproveitar modelos NPS/CSAT, públicos Interno Nexti e Clientes, permissões, importação de listas, convites individuais, prazos e lembretes.

## 1. Construção de perguntas
- Preservar adição, edição, exclusão, ordem e obrigatoriedade por pergunta.
- Oferecer escolha única, várias respostas, escala 0–10, estrelas 1–5, satisfação com os cinco rótulos e texto livre.
- Adicionar **Permitir comentário adicional?** independentemente em cada pergunta. O comentário é opcional, separado da resposta principal e identificado pela pergunta nos resultados.
- Seguir o exemplo enviado: enunciado, formato, alternativas com exclusão individual, adicionar alternativa, controles de obrigatoriedade/comentário e prévia interativa da pergunta.
- Manter a identidade visual Nexti e os controles existentes, com organização clara no computador e celular.
- Não impor um limite arbitrário de perguntas; manter validação de alternativas, textos e escalas para evitar dados inválidos.

## 2. Personalização e prévia
- Configurar título, descrição, mensagem de apresentação, nome do treinamento/reunião, data de realização e agradecimento após o envio da resposta.
- Permitir **Identificada** ou **Anônima**, com aviso correspondente para o participante.
- Usar o mesmo formulário na prévia e na página do participante. A prévia permite responder localmente, limpar respostas e conferir os comentários; não grava respostas nem dispara e-mails.

## 3. Rascunho, publicação e envio
- Disponibilizar **Visualizar**, **Salvar rascunho** e **Publicar pesquisa**.
- Publicar valida e disponibiliza a pesquisa; não equivale a disparar e-mails. O envio continua pela seleção/importação da lista de destinatários e confirmação existente.
- Preservar o início do prazo no primeiro envio e o bloqueio de alterações nas perguntas após distribuição. Alterações posteriores exigem nova versão, incluindo as novas configurações.
- Salvar pesquisa e perguntas de forma indivisível: um erro não pode apagar as perguntas ou deixar um cadastro parcialmente salvo.
- Manter os envios reais desativados. Configurar domínio e liberar envio não faz parte desta entrega.

## 4. Anonimato e permissões
Esta parte precisa de mudanças coordenadas: atualmente cada resposta é vinculada diretamente ao convite, que contém nome e e-mail. Apenas esconder o nome na tela não tornaria a pesquisa anônima.

- Pesquisas existentes continuam identificadas; não converter respostas antigas.
- Para novas pesquisas anônimas, separar o controle de convite respondido das respostas armazenadas, sem vínculo recuperável de identidade no conjunto de respostas.
- Manter resposta única por convite e suprimir lembretes para quem respondeu, sem expor qual resposta pertence a essa pessoa.
- Não mostrar nome, e-mail, horário individual exato ou recortes de área/empresa capazes de reidentificar respostas anônimas. Avisar que o texto livre não deve conter dados pessoais.
- Fixar o modo de identificação antes da distribuição; não permitir alternância depois de enviados convites ou recebidas respostas.
- Proteger anonimato também nas consultas, relatórios e exportações, não apenas na interface. Respostas identificadas continuam restritas às permissões existentes.

## 5. Resultados
- Adicionar **Resultados** nos detalhes de cada pesquisa, reaproveitando o Dashboard existente.
- Mostrar convidados, respondentes únicos e respostas válidas de cada pergunta, sem confundir falta de resposta com nota zero.
- Escolha única/várias respostas: contagem e percentual por alternativa, usando como denominador os participantes que responderam à pergunta. Em múltipla escolha, os percentuais podem somar mais de 100%.
- Escalas: média e distribuição das notas; preservar as fórmulas oficiais de NPS e CSAT.
- Texto e comentários adicionais: consulta individual por pergunta, respeitando identificação/anonimato.
- Gráficos de barras por pergunta, com alternativa textual e estados de ausência de dados.
- Exportar **Excel** com resumo e resultados por pergunta e **PDF** com resultados legíveis. Identidades aparecem somente em pesquisas identificadas e para quem tem permissão.
- Preservar o agrupamento por público e não misturar Interno Nexti com Clientes.

## Detalhes técnicos
- Mudanças aditivas no armazenamento: apresentação, agradecimento, data, modo de identificação, publicação, apresentação da escala e comentário por pergunta/resposta. Preservar registros e histórico existentes.
- Criar salvamento/publicação transacional, com validações no servidor e no formulário.
- Atualizar leitura do formulário, envio de respostas, duplicação/versionamento, apuração e exportação para as novas configurações.
- Separar armazenamento de respostas anônimas quando necessário, sem afrouxar restrições das respostas identificadas ou alterar tabelas gerenciadas de autenticação.
- Usar a mesma renderização para prévia, resposta pública e apresentação das escalas; comentários nunca alteram o cálculo da nota.
- Não substituir as regras atuais de prazos, remetentes, participação, presença ou alcance.

## Verificação antes da entrega
- Testar obrigatória/opcional, escolha única/múltipla, valores 0 e 10, estrelas 1 e 5, satisfação, texto, comentários independentes e ordem das perguntas.
- Testar salvamento completo, reabertura, publicação sem envio, nova versão e prévia sem gravação.
- Conferir um fluxo real com dados de teste isolados: criar → publicar → convite de teste sem envio externo → responder → consultar resultados → exportar Excel/PDF; remover somente os dados de teste.
- Verificar resposta única, prazo e acesso não autorizado; comprovar que respostas anônimas não revelam identidade por consultas ou exportações.
- Conferir computador e celular e preservar pesquisas já existentes.

## Fora do escopo
Disparo real de e-mails, integrações com Feedz/Google Agenda, alterações em cursos/provas e conversão de pesquisas antigas para anônimas.