# Ambientes por cliente com usuário Master, Admin da empresa e Usuário comum

## O que existe hoje
- Há 5 usuários: 4 da Nexti e 1 sem empresa informada. Os 4 da Nexti são administradores, e esse admin enxerga e altera tudo de todos.
- A empresa do usuário fica só como texto no perfil. O cadastro de empresas já existe (usado nas trilhas de aprendizagem), mas está vazio.
- Cursos e trilhas formam um catálogo único, sem dono: não dá para dizer "este vídeo é só do cliente X".

## Como vai ficar

```text
Master (Robson Vieira, Aline Rodriguez)
  └─ vê e gerencia TODOS os ambientes, troca de ambiente, relatórios consolidados
Ambiente = Cliente (ex.: Nexti, Cliente A, Cliente B)
  ├─ Admin do ambiente: inclui vídeos/cursos/trilhas do ambiente, cadastra colaboradores,
  │   define quem é admin ou comum, vê relatórios só do seu ambiente
  └─ Usuário comum: Loja, Minha Trilha, Base de Conhecimento, Nexti na Prática,
      Quiz Nexti, Insígnias (nada da área administrativa)
```

### 1. Ambientes
- Nova tela **Ambientes**, só para o Master: criar, renomear, ativar ou desativar um cliente e ver quantos usuários e cursos cada um tem.
- Cada usuário pertence a um ambiente. Os usuários atuais vão para o ambiente **Nexti**.

### 2. Papéis
- **Master**: um novo papel guardado à parte, nunca no perfil. É dado só ao Robson e à Aline.
- **Admin do ambiente**: vale apenas dentro do seu ambiente.
- **Usuário comum**: o padrão de quem entra.
- Os 4 admins atuais da Nexti passam a ser admins do ambiente Nexti. Robson e Aline também viram Master.

### 3. Conteúdo por ambiente
- Cursos, trilhas e vídeos ganham um dono: **Global (Nexti, visível a todos)** ou **um ambiente específico**.
- O conteúdo que já existe fica como Global, então nada some para ninguém.
- O admin do ambiente cria e edita apenas o conteúdo do seu ambiente. O Global só pode ser alterado pelo Master.
- O aluno vê o conteúdo Global mais o do seu ambiente.

### 4. Colaboradores
- Em **Usuários**, o admin vê somente as pessoas do seu ambiente. Ele pode convidar ou cadastrar colaboradores (por e-mail ou planilha), escolher entre Admin e Comum, e desativar alguém.
- O admin não consegue mover ninguém para outro ambiente nem criar um Master.

### 5. Navegação do Master
- No topo da área administrativa, um seletor **Ambiente: Todos / Nexti / Cliente A…** filtra todas as telas administrativas.
- Em **Relatórios**, um novo tipo **Visão consolidada dos ambientes** mostra, por ambiente: usuários ativos, matrículas, conclusões, certificados, provas aprovadas e moedas. O filtro de período fica disponível.
- Os admins comuns continuam vendo só o próprio ambiente, sem o seletor.

### 6. Menu do usuário comum
- O menu fica limitado a Loja, Minha Trilha, Base de Conhecimento, Nexti na Prática, Quiz Nexti e Insígnias. Os outros itens e endereços ficam bloqueados também pelo endereço direto, não só escondidos.

## Ordem de construção
1. Ambientes e papel Master, com a migração dos usuários atuais para Nexti.
2. Regras de acesso no servidor para usuários, conteúdo, progresso e relatórios.
3. Dono do conteúdo (Global/ambiente) nas telas de cursos e trilhas.
4. Gestão de colaboradores pelo admin do ambiente.
5. Seletor de ambiente e relatório consolidado do Master.
6. Menu do usuário comum, e testes com um usuário de cada papel.

## Detalhes técnicos
- Reaproveitar `learning_companies` como ambiente (adicionar `slug`, `is_active`). Usar `learning_company_memberships` com uma nova coluna `role` ('admin' | 'member') como vínculo ambiente↔usuário, um ativo por usuário.
- `app_role` ganha 'master'. `has_role(uid,'master')` fica em `user_roles`. Novas funções SECURITY DEFINER: `is_master()`, `current_company_id()`, `is_company_admin(_company)`.
- `tracks` (e o que herda dele: módulos, aulas, materiais, provas) ganha `company_id uuid NULL` (NULL = Global). As políticas RLS passam a liberar a leitura quando `company_id IS NULL OR company_id = current_company_id() OR is_master()`, e a escrita para o admin do ambiente dono ou o Master.
- Ajustar as políticas que hoje usam `has_role(...,'admin')` global para `is_master() OR is_company_admin(alvo)`. Isso vale para profiles, enrollments, progresso, certificados, resgates e relatórios (`admin_td_report`, `admin_enrollment_report` recebem `_company` opcional, permitido só ao Master quando for diferente do próprio).
- Nova RPC `master_environments_report(_start,_end)`, restrita ao Master.
- Cadastro de colaborador por edge function admin-only (convite por e-mail via auth admin), validando que o ambiente alvo é o do chamador.
- `AdminRoute` passa a aceitar Master ou admin de ambiente. O seletor de ambiente fica num contexto React que envia `_company` às consultas.
- Pesquisas, Assistente IA, Monitoramento e edição do Nexti na Prática ficam só para o Master.
- O `empresa` em texto no perfil continua existindo, mas não dá acesso a nada (regra já registrada).

## Optional ideas
- Logo e cor por ambiente.
- Loja e prêmios específicos por ambiente.
