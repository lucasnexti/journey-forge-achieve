

# Reformulacao do Menu Administrativo - Melhores Praticas LMS

## Problemas Atuais

1. **Lista plana com 18 itens** - sem agrupamento logico, dificil de navegar
2. **Sem top bar admin** - falta busca global, perfil do usuario, notificacoes e atalhos rapidos
3. **Grupos confusos** - "Dashboard" mistura itens pessoais (anotacoes, foruns) com visao geral; "Gerenciamento" eh uma lista gigante sem subcategorias
4. **Sem indicadores** - nao mostra contadores (ex: 5 matriculas pendentes) nem badges de alerta
5. **Mobile** - sidebar fixa nao funciona bem em telas menores

## Referencia de Mercado

Plataformas como **Moodle**, **Alura para Empresas**, **Docebo**, **TalentLMS** e **Tovuti** organizam o admin em:
- Top bar com busca, notificacoes e perfil do admin
- Sidebar com grupos colapsaveis (Content, People, Reports, Settings)
- Badges/contadores nos itens do menu
- Link rapido "Voltar ao modo aluno"

## Plano de Implementacao

### 1. Reestruturar AdminSidebar com grupos colapsaveis

Reorganizar os 18 links em 5 grupos logicos com Accordion/Collapsible:

```text
VISAO GERAL
  Dashboard (home admin)

CONTEUDO
  Cursos EAD
  Trilhas
  Quizzes
  Treinamentos Presenciais

PESSOAS
  Usuarios
  Matriculas
  Certificados

ENGAJAMENTO
  Gamificacao
  Forum / Mural
  Notificacoes
  Avaliacoes NPS/CSAT

CONFIGURACAO
  Personalizacao
  Relatorios
  Logs
```

- Cada grupo sera colapsavel (aberto por padrao se contem a rota ativa)
- Quando sidebar collapsed, mostra apenas icones com tooltip
- Adicionar badge/contador em itens chave (ex: matriculas pendentes, notificacoes nao lidas)

### 2. Adicionar Top Bar administrativa

Nova barra fixa no topo com:
- **Breadcrumb** da pagina atual (ex: Admin > Conteudo > Trilhas)
- **Busca global** - campo de busca que filtra itens do menu e conteudo
- **Botao "Modo Aluno"** - link para /dashboard (voltar a visao do aluno)
- **Notificacoes** - sino com contador
- **Avatar/perfil** do admin com dropdown (perfil, sair)

### 3. Melhorar responsividade

- Em telas < 1024px: sidebar vira drawer/overlay com backdrop
- Botao hamburger no top bar para abrir/fechar
- Em telas >= 1024px: sidebar fixa com collapse

### 4. Visual refinado

- Icone + label com transicao suave no collapse
- Hover states mais evidentes
- Indicador lateral colorido na rota ativa (barra lateral esquerda)
- Separadores visuais sutis entre grupos
- Footer da sidebar: avatar mini do admin + botao sair

### Arquivos modificados

| Arquivo | Acao |
|---|---|
| `src/components/admin/AdminSidebar.tsx` | Reescrever com grupos colapsaveis, badges, responsividade |
| `src/components/admin/AdminTopBar.tsx` | **Novo** - barra superior com busca, breadcrumb, perfil |
| `src/components/admin/AdminLayout.tsx` | Integrar top bar, ajustar layout responsivo |

### Detalhes Tecnicos

- Usar `Collapsible` do shadcn/ui para grupos do sidebar
- Usar `Sheet` do shadcn/ui para drawer mobile
- Breadcrumb gerado automaticamente a partir da rota atual
- Busca filtra os links do menu em tempo real (client-side)
- Contadores buscados via queries ao banco (notificacoes nao lidas, matriculas pendentes)
- Persistir estado collapsed no `localStorage`

