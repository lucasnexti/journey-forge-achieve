# Corrigir aulas sem duração

## Problema confirmado
As regras atuais exigem uma duração maior que zero para concluir uma aula. O cadastro aceita zero, e a duração identificada pelo player Vimeo não é salva no servidor. No JMVStream, o player incorporado não fornece eventos de duração ou fim ao aplicativo. Assim, aulas sem duração podem bloquear a prova e o certificado.

O Lovable Cloud está indisponível nas verificações atuais; ainda é necessário conferir as regras implantadas e listar os registros afetados antes de aplicar mudanças.

## Correção proposta
1. Recuperar o acesso ao Lovable Cloud e identificar aulas publicadas com duração vazia ou zero, sem alterar históricos.
2. Para Vimeo, obter e salvar a duração a partir dos metadados oficiais por uma função autenticada no servidor, com validação de acesso à aula. Resolver a duração antes de acompanhar a conclusão; não confiar em uma duração enviada pelo aluno.
3. Para JMVStream e vídeos sem metadados verificáveis, exigir que o administrador informe a duração real. Não inventar duração nem concluir automaticamente pelo simples fato de abrir o vídeo.
4. Impedir a publicação de aulas em vídeo sem duração válida nos dois editores. Permitir rascunhos incompletos, com indicação do dado pendente.
5. Nas aulas existentes sem duração, mostrar uma mensagem específica de configuração pendente, em vez de orientar o aluno a continuar assistindo indefinidamente. Quando a duração for corrigida, reaproveitar o tempo salvo e revalidar o progresso sem fogos ou moedas por mera restauração.

## Proteções preservadas
- Conclusão validada no servidor ao atingir 90% da duração real.
- Nenhum botão manual de conclusão ou liberação de prova/certificado sem cumprir as regras.
- Retomar, recarregar e corrigir metadados não geram celebrações nem recompensas duplicadas.
- A regra de aprovação em prova continua obrigatória nos cursos que têm avaliação.
- A limitação atual do JMVStream — tempo aberto/visível não comprova reprodução — não será tratada como um sinal confiável de fim de vídeo.

## Detalhes técnicos
- Adicionar resolução de metadados oficiais Vimeo com verificação da sessão, acesso server-side e URL do provedor, sem permitir URLs arbitrárias ou escrita genérica em aulas.
- Integrar a duração resolvida ao carregamento de `TrackPage` e preservar os gatilhos de progresso existentes.
- Aplicar as validações nos editores `CourseContentEditor` e `AdminTrilhasGestao` e uma proteção de publicação no servidor, considerando aulas já publicadas para não bloquear a implantação.
- Registrar as decisões estruturais em `AGENTS.md` e não editar migrações antigas.

## Verificação
- Testes de duração zero/nula, metadados inválidos, acesso negado, duração positiva e limite concreto de 90%.
- Verificar com sessão autorizada que assistir salva a conclusão, que recarregar mantém o progresso e que prova/certificado obedecem à elegibilidade.
- Confirmar que aulas JMVStream sem duração não são marcadas como concluídas indevidamente e que o administrador consegue corrigir o cadastro.

## Dependências
- Lovable Cloud disponível para inspecionar e aplicar a correção.
- Duração real informada pelo administrador nos vídeos em que o provedor não permite obtê-la com segurança.