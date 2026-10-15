# Etapa 4.1 — Perfis de dados sintéticos

Versionada configuração `small`/`medium`/`large` com contagens exatas, parâmetros relacionais, volumes derivados, seed/data-base fixas e limites conservadores. A documentação distingue seed dev, fixtures E2E e futuro banco exclusivo `marketplace_scale`; nenhum dado foi gerado e nenhum banco foi acessado.

Validação confirmada em 13/10/2026: `npm.cmd run test:scale-profiles` passou 5/5. Os testes derivam a contagem explicitamente pelos modelos físicos, conferem os totais 29.725, 406.150 e 2.150.650 e verificam que capturas, subconjunto de PaymentAttempts, não aumentam o total. Foram incluídos User, CustomerAddress, OrderAddress e IdempotencyKey; apenas adminUsers tem contagem zero, com justificativa. Os tamanhos previstos (0,1/0,75/2,5 GB) são hipóteses, não medições. A etapa 4.3 deve medir `small` antes de permitir `large`, com parada em 5 GiB como alvo, 10 GiB como limite rígido e 30 minutos como duração máxima.

Revisão na 4.2 (15/10/2026): entregas e históricos passaram a ser derivados dos cenários pagos e de seus caminhos de status. Totais atuais: 30.349 / 403.330 / 2.176.580; contagens principais e limites mantidos. A validação original acima é histórica. Ver `STEP_4_2_SCALE_DISTRIBUTIONS_SUMMARY.md` e `nodejs-backend/docs/SCALE_DATA_DISTRIBUTIONS.md`.

Não há gerador, carga, provisionamento, alteração do schema ou acesso a banco nesta entrega. Próxima implementação: 4.3, começando exclusivamente com small.
