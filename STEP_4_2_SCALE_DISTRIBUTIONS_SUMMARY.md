# Etapa 4.2 — Distribuições e relacionamentos

Em 15/10/2026, regras compartilhadas foram adicionadas a `nodejs-backend/config/scale-profiles.json`: concentração de sellers/produtos, compras repetidas, carrinhos, cenários pagos/não pagos, retries, estoque, entrega, refunds e reviews. Bases explícitas, quotas finais separadas de eventos e arredondamento por maiores restos preservam o planejamento determinístico.

Entregas e históricos agora derivam dos cenários e caminhos de status, corrigindo médias independentes da 4.1. Totais físicos: small 30.349, medium 403.330, large 2.176.580; todos abaixo dos limites existentes. Contagens principais, seed/data-base e orçamento foram preservados. Indicadores de capturas e SellerOrders pagas/entregues não são somados como linhas.

Validação observada: `npm.cmd run test:scale-profiles` 5/5 e `npm.cmd run test:scale-distributions` 7/7. Testes executam somente leitura de arquivos e aritmética, sem bancos ou geração de registros. `git diff --check` passou.

Limite explícito: SellerOrders SHIPPED/DELIVERED/RETURNED serão snapshots históricos sintéticos, não transições públicas atualmente habilitadas. Delivery não sincroniza o seller e captura não confirma/libera reservas: a configuração conserva ACTIVE e documenta essa condição. O futuro gerador deverá validar pares únicos de review e conciliar quotas com ownership/capacidade, falhando de forma clara se forem inviáveis.

Requisitos obrigatórios da 4.3 e dois exemplos estão em `nodejs-backend/docs/SCALE_DATA_DISTRIBUTIONS.md`: primeiras cargas só small; medium/large dependem de autorização posterior; banco exclusivo marketplace_scale; controle de registros, tempo e orçamento total de 5–10 GB; relatório por tabela e armazenamento antes/depois; identificação de container/volume/caminhos; limpeza restrita à escala. Nenhum container foi provisionado ou banco acessado nesta etapa.
