# Etapa 6.2 — Métricas básicas locais

Concluída em 31/10/2026. Operação e catálogo das métricas em [METRICS.md](nodejs-backend/docs/METRICS.md).

- `prom-client` 15.1.3, registry privado por processo, endpoint `/metrics` opt-in (`METRICS_ENABLED=true`), desabilitado por padrão e restrito a socket loopback. Sem Prometheus/Grafana ou outra stack. Não publicar via proxy externo.
- HTTP: respostas concluídas, duração, in-flight e abortos separados, usando os mesmos templates da 6.1. Uma finalização, decremento no aborto e scrapes excluídos. Labels sem IDs, URLs concretas ou dados sensíveis. Métricas nativas do processo para CPU/memória e runtime, sem labels de ambiente.
- Checkout: criação após sucesso da transação, replay separado, conflitos e falhas técnicas com as mesmas classificações dos logs. Falhas de instrumentação não alteram respostas. Sem mudanças de contratos, regras, locks ou idempotência.
- Prisma 6.11.1: listener query lê só duração, sem SQL/parâmetros; não foi ativado preview nem alterado schema. Contagem inclui eventos do cliente singleton/monitor/controle transacional quando emitidos, não equivale a transações nem todas as tentativas falhas.
- PostgreSQL: agregação READ ONLY em pg_stat_activity, sem outro pool/engine. Coleta inicial e a cada 30 s após a anterior, timeout/configurações limitadas, sem sobreposição, com stop antes de disconnect. Falha gera up=0 e NaN para sessões, além de erro/duração/último sucesso; não apresenta zero como medição válida.
- **Validações:** typecheck, build, métricas **15/15** e logging **20/20**. Testes sem banco, incluindo indisponibilidade/recuperação, timeout e falha de contador sem mudar resposta de checkout.
- **Smoke real somente leitura:** marketplace_dev:5433, duas respostas da aplicação (200/404), dois scrapes 200 excluídos dos contadores e in-flight zero ao final. Coleta inicial 246,3 ms, uma conexão/zero outras sessões ativas; seis eventos Prisma, zero falhas. Scrapes 12,2/7,8 ms, aproximadamente 18,5 kB. API efêmera, collector e conexões próprios encerrados; sem escrita de negócio ou fixtures em banco.

Não é teste de carga nem medição do custo exclusivo da instrumentação. Os dados são voláteis, dependem da plataforma e não explicam causa raiz/spans. Métricas não substituem logs ou a futura correlação distribuída. Pacote solicitado fixado no lockfile; aviso de descontinuação registrado na documentação, sem substituir biblioteca nesta etapa. Instalação preservou verificação TLS usando CA do Windows somente no processo npm, sem configuração global.

Sem alterações em schema/migrations/frontend, dataset de escala, perfis/tickets, cargas, gerador ou purge. `dist` somente gerado pelo build, mantendo versionamento existente. **Próxima 6.3**, ainda não iniciada. Métricas de filas/workers ficam para fase 7; pendências transversais preservadas.
