/*
  Configuração do site Nexti na Prática.

  Métricas: enquanto "provedor" for null, nenhuma coleta é feita e a administração
  mostra "Métricas ainda não configuradas".
    provedor: "umami" | "plausible" | "ga4"
    id:       Umami: ID do site (website id); Plausible: domínio cadastrado; GA4: ID de medição (G-XXXXXXX)
    script:   opcional, endereço do script do provedor (ex.: Umami próprio)
    painel:   opcional, link do painel de resultados para a equipe
*/
window.CONFIG = {
  metricas: {
    provedor: null,
    id: "",
    script: "",
    painel: ""
  }
};
