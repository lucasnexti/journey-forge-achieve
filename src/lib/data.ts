export interface Question {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
}

export interface Quiz {
  passingScore: number;
  questions: Question[];
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  duration: number; // seconds
  order: number;
}

export interface Track {
  id: string;
  title: string;
  description: string;
  category: string;
  totalLessons: number;
  estimatedHours: number;
  lessons: Lesson[];
  quiz: Quiz;
  nextTrackId?: string;
}

export const tracks: Track[] = [
  {
    id: "cooperativismo-101",
    title: "Fundamentos do Cooperativismo",
    description: "Entenda os princípios, valores e a história do movimento cooperativista. Uma base sólida para todos os cooperados.",
    category: "Fundamentos",
    totalLessons: 3,
    estimatedHours: 2,
    nextTrackId: "gestao-cooperativa",
    lessons: [
      { id: "l1-1", title: "O que é uma Cooperativa?", description: "Definição, tipos e estrutura de uma cooperativa.", videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4", duration: 600, order: 1 },
      { id: "l1-2", title: "Os 7 Princípios Cooperativistas", description: "Os pilares que guiam o movimento cooperativo mundial.", videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4", duration: 480, order: 2 },
      { id: "l1-3", title: "História do Cooperativismo no Brasil", description: "De Rochdale ao cenário brasileiro contemporâneo.", videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4", duration: 720, order: 3 },
    ],
    quiz: {
      passingScore: 70,
      questions: [
        { id: "q1-1", text: "Qual é o principal objetivo de uma cooperativa?", options: ["Maximizar lucros para acionistas", "Atender às necessidades dos cooperados", "Competir com empresas privadas", "Substituir o governo"], correctIndex: 1 },
        { id: "q1-2", text: "Quantos princípios cooperativistas existem?", options: ["5", "6", "7", "8"], correctIndex: 2 },
        { id: "q1-3", text: "Onde surgiu o movimento cooperativista moderno?", options: ["Paris, França", "Rochdale, Inglaterra", "Berlim, Alemanha", "São Paulo, Brasil"], correctIndex: 1 },
      ],
    },
  },
  {
    id: "gestao-cooperativa",
    title: "Gestão e Governança Cooperativa",
    description: "Aprenda sobre estrutura organizacional, tomada de decisão democrática e boas práticas de governança.",
    category: "Gestão",
    totalLessons: 3,
    estimatedHours: 3,
    nextTrackId: "financeiro-cooperativa",
    lessons: [
      { id: "l2-1", title: "Estrutura Organizacional", description: "Assembleia, conselhos e diretoria.", videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4", duration: 540, order: 1 },
      { id: "l2-2", title: "Processo Decisório Democrático", description: "Como funciona a votação e participação.", videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4", duration: 600, order: 2 },
      { id: "l2-3", title: "Compliance e Transparência", description: "Boas práticas de governança corporativa.", videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4", duration: 660, order: 3 },
    ],
    quiz: {
      passingScore: 70,
      questions: [
        { id: "q2-1", text: "Qual é o órgão máximo de decisão em uma cooperativa?", options: ["Diretoria", "Conselho Fiscal", "Assembleia Geral", "Presidência"], correctIndex: 2 },
        { id: "q2-2", text: "O princípio de 'um membro, um voto' se refere a:", options: ["Gestão democrática", "Autonomia", "Educação", "Intercooperação"], correctIndex: 0 },
        { id: "q2-3", text: "Qual a função do Conselho Fiscal?", options: ["Aprovar orçamento", "Fiscalizar a gestão", "Contratar funcionários", "Definir estratégia"], correctIndex: 1 },
      ],
    },
  },
  {
    id: "financeiro-cooperativa",
    title: "Gestão Financeira para Cooperativas",
    description: "Domine os conceitos financeiros essenciais para a sustentabilidade da cooperativa.",
    category: "Finanças",
    totalLessons: 3,
    estimatedHours: 4,
    lessons: [
      { id: "l3-1", title: "Demonstrações Financeiras", description: "Balanço patrimonial e DRE.", videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4", duration: 720, order: 1 },
      { id: "l3-2", title: "Sobras e Distribuição", description: "Como funcionam as sobras líquidas.", videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4", duration: 600, order: 2 },
      { id: "l3-3", title: "Planejamento Orçamentário", description: "Construindo um orçamento cooperativo.", videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4", duration: 660, order: 3 },
    ],
    quiz: {
      passingScore: 70,
      questions: [
        { id: "q3-1", text: "O que são 'sobras' em uma cooperativa?", options: ["Prejuízos acumulados", "Lucro distribuído a acionistas", "Resultado positivo distribuído aos cooperados", "Reserva obrigatória"], correctIndex: 2 },
        { id: "q3-2", text: "Qual demonstração mostra a posição patrimonial?", options: ["DRE", "Balanço Patrimonial", "Fluxo de Caixa", "DMPL"], correctIndex: 1 },
        { id: "q3-3", text: "O FATES é destinado a:", options: ["Pagamento de impostos", "Assistência técnica e educacional", "Reserva de capital", "Investimentos imobiliários"], correctIndex: 1 },
      ],
    },
  },
];
