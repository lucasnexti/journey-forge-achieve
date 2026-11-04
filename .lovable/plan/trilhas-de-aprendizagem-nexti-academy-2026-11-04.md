# Trilhas de aprendizagem — Nexti Academy

## Resultado
Criar uma área de trilhas que reúne os cursos já cadastrados, com acessos controlados, progressão e acompanhamento real, preservando cursos, usuários e históricos existentes.

## 1. Gestão administrativa
- Disponibilizar **Trilhas** no menu de conteúdo, separadamente da gestão dos cursos.
- Listar nome, status, quantidade de cursos e alunos com acesso; oferecer busca e filtros por empresa e status.
- Criar e editar nome e descrição obrigatórios, capa opcional e status rascunho, publicada ou arquivada.
- Selecionar cursos existentes por busca de nome e módulo/categoria disponível; organizar em categorias nomeadas e reordenar categorias e cursos.
- Impedir cursos repetidos na mesma trilha e publicação sem cursos.
- Permitir duplicar como rascunho, sem copiar acessos, arquivar e gerenciar autorizações.

## 2. Empresas e acessos
- Usar empresas identificadas por um código interno e vínculos aprovados pelo administrador.
- Reutilizar os nomes de empresas existentes como opções; **não transformar automaticamente o texto atual do cadastro em autorização validada**.
- Na gestão de acessos, permitir validar o vínculo dos alunos com a empresa e conceder/revogar acesso para empresas ou usuários em seleção múltipla.
- Autorizações de empresa incluirão novos alunos somente após aprovação do vínculo pelo administrador.
- Revogar acesso sem apagar progresso, tentativas ou certificados; manter acesso ao curso quando houver outra autorização válida que também o libere.

## 3. Cursos restritos e segurança
- Cursos incluídos em trilhas serão tratados como conteúdo restrito, com essa condição indicada ao administrador antes de salvar. Cursos que não participam de trilhas manterão o comportamento atual do catálogo.
- A restrição não desaparecerá automaticamente ao remover um curso de uma trilha: retirar a associação não deve publicar seu conteúdo por acidente.
- Aplicar autorização no servidor a trilhas, cursos, aulas, materiais, avaliações e operações de aprendizagem, não apenas aos botões da tela.
- Matrícula e progresso antigos não serão usados como autorização para contornar uma revogação.
- Acesso a materiais continuará por links temporários; links já emitidos expiram no prazo existente.
- Preservar a emissão de certificados pelo servidor e a página pública de validação de certificados.

## 4. Área do aluno
- Adicionar **Minhas trilhas**, mantendo o catálogo de cursos e os endereços atuais de reprodução.
- Mostrar apenas trilhas publicadas e autorizadas, com capa, nome, descrição, quantidade de cursos, progresso e ação Começar, Continuar ou Revisar.
- Exibir categorias, cursos ordenados e o motivo dos bloqueios.
- Progressão livre permite qualquer ordem; sequencial exige concluir os cursos anteriores. A mesma verificação será aplicada no servidor, inclusive em links diretos.
- Reaproveitar conclusões existentes em qualquer trilha. Progresso da trilha = cursos concluídos / total de cursos.
- Apresentar estados de carregamento, erro e ausência de trilhas.

## 5. Acompanhamento
- Mostrar totais de alunos autorizados, não iniciados, em andamento e concluídos, além da conclusão por curso.
- Listar aluno, empresa validada, progresso e situação; filtrar por empresa, aluno e situação.
- Exportar CSV com os mesmos filtros, sem inventar notas ou médias.

## 6. Visual
- Preservar laranja Nexti, fundo branco e os elementos atuais da plataforma.
- Usar Montserrat nas novas telas de trilhas, sem trocar a tipografia das demais telas.
- Adaptar formulários, listas e cards para computador e celular. Usar capas cadastradas e uma alternativa visual da marca quando não houver capa.
- O anexo recebido contém o texto dos requisitos; nenhuma imagem de referência adicional está disponível nesta mensagem.

## Detalhes técnicos
- Manter `tracks` como cursos e adicionar uma estrutura independente de trilhas, categorias, associações ordenadas, empresas, vínculos validados e concessões de acesso.
- Usar alterações aditivas, permissões explícitas e políticas de acesso no banco; centralizar verificações de autorização e sequência em funções do servidor.
- Revisar as permissões amplas atuais do catálogo e os caminhos de avaliações e arquivos para aplicar a mesma proteção a conteúdo restrito.
- Reutilizar layouts, controles, armazenamento privado, consultas em cache e progresso existente.

## Validação da entrega
- Testes das regras: obrigatoriedade, publicação, duplicidade, autorização por usuário/empresa validada, revogação, outras autorizações, sequência e reaproveitamento de progresso.
- Verificar criação, concessão, visualização e leitura do progresso com contas autenticadas de administrador e aluno.
- Confirmar que aluno não autorizado não lê trilha, aulas ou materiais por endereço direto.
- Conferir os filtros e CSV, além de telas em computador e celular.
- Usar registros temporários claramente identificados nos testes e removê-los ao terminar, sem alterar históricos reais.