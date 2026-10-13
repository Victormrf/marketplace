# Etapa 4.1 — Perfis de dados sintéticos

Versionada configuração `small`/`medium`/`large` com contagens exatas, parâmetros relacionais, volumes derivados, seed/data-base fixas e limites conservadores. A documentação distingue seed dev, fixtures E2E e futuro banco exclusivo `marketplace_scale`; nenhum dado foi gerado e nenhum banco foi acessado.

Validação sem banco: `npm run test:scale-profiles` (5 testes). Contagem física corrigida: 29.725, 406.150 e 2.150.650 registros. Capturas são subconjunto de PaymentAttempts e não entram novamente no total. Foram incluídos User, CustomerAddress, OrderAddress e IdempotencyKey; apenas adminUsers tem contagem zero, com justificativa. Os tamanhos previstos (0,1/0,75/2,5 GB) são hipóteses, não medições. A etapa 4.3 deve medir `small` antes de permitir `large`, com parada em 5 GiB como alvo, 10 GiB como limite rígido e 30 minutos como duração máxima.

Próxima etapa: 4.2 — distribuição e cenários. Não há gerador, carga, provisionamento, alteração do schema ou acesso a banco nesta entrega.
