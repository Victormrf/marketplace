# Etapa 6.1 — Logs estruturados e identificação HTTP

Implementação restrita ao Express: logger JSON centralizado nativo do Node, níveis por `LOG_LEVEL`, saída stdout/stderr e contexto por `AsyncLocalStorage`, sem novas dependências. Padrão `info`, sem arquivos de log próprios.

- Middleware antes do parser gera/valida UUID, devolve `X-Request-ID`, oferece `req.requestId` e contexto aos services. Um evento de conclusão por request registra template seguro, status/duração e finalização ou fechamento antecipado; antes dos headers, status null.
- Checkout registra criação, replay, conflito esperado e falha inesperada com o mesmo ID. Mensagens/stacks de erros não são serializadas; códigos fixos e allowlists protegem o contexto. Nenhuma regra, resposta de negócio, transação, lock ou idempotência alterada.
- Política de redação, exemplo sanitizado de correlação, configuração e cuidados de retenção em [REQUEST_LOGGING.md](nodejs-backend/docs/REQUEST_LOGGING.md).
- Validação inicial (26/10/2026): typecheck (`npx tsc --noEmit`), build e `npm run test:logging` **14/14 aprovados**. Testes usam HTTP real local com logger capturado e persistência substituída por doubles, sem banco/dataset de escala; o sandbox inicialmente bloqueou loopback com EACCES, e a execução com permissão local passou. A suíte integra `test:all`.
- Arquivos principais: `src/utils/logger.ts` seleciona/sanitiza campos e controla nível/sink; `src/utils/requestContext.ts` mantém contexto; `src/middlewares/requestLogging.ts` identifica e encerra chamadas; checkout service/controller emitem eventos seguros. `dist` foi gerado exclusivamente pelo build, mantendo a política de versionamento existente.

## Ajuste de classificação segura — 31/10/2026

- `CheckoutConflictError` ganhou código tipado opcional, padrão `BUSINESS_CONFLICT`. O repository atribui o código na condição detectada, e o service o registra sem comparar mensagens. Códigos: `CART_EMPTY`, `INSUFFICIENT_STOCK`, `PRODUCT_UNAVAILABLE`, `INVALID_QUANTITY`, `IDEMPOTENCY_PROCESSING`, `IDEMPOTENCY_FINGERPRINT_MISMATCH`, `IDEMPOTENCY_STATE_CONFLICT`, `PRODUCT_NOT_FOUND`, `SELLER_NOT_FOUND`, `INVENTORY_UNAVAILABLE`, `UNSUPPORTED_CURRENCY` e fallback `BUSINESS_CONFLICT`.
- Controller classifica somente instâncias reconhecidas do Prisma: P1001/P1017 → `DATABASE_UNAVAILABLE`; P1002/P1008/P2024 → `DATABASE_TIMEOUT`; demais falhas → `UNEXPECTED_CHECKOUT_ERROR`. Não usa mensagens, nomes textuais ou causas aninhadas para inferir a classificação. Um evento `checkout.failed` por ocorrência, além do resumo HTTP.
- Middleware continua responsável por HTTP/contexto e adiciona categorias de resultado: `HTTP_BAD_REQUEST`, `HTTP_UNAUTHENTICATED`, `HTTP_FORBIDDEN`, `HTTP_NOT_FOUND`, `HTTP_CONFLICT`, `HTTP_CLIENT_ERROR`, `HTTP_SERVER_ERROR` e `HTTP_CONNECTION_CLOSED`. Não são causas de negócio; fechamento antecipado tem precedência. Eventos info de sucesso continuam sem código.
- Logger aceita somente códigos enumerados; campos sensíveis, mensagens e objetos de erro continuam excluídos. Mensagens/status públicos, transações, locks, idempotência e regras de negócio preservados. Lista, limites e exemplo correlacionado em `REQUEST_LOGGING.md`.
- Validação atual: **20/20 logging e 15/15 checkout**, typecheck e build aprovados. A regressão de checkout usou somente fixtures da suíte em `localhost:5433/marketplace_dev`, removidas pelo teardown. `test:all` não foi repetido. Ajustes de testes no Prisma usaram doubles do módulo de persistência, sem alterar produção.
- O build limpo final detectou categorias HTTP presentes no compilado anterior, mas ausentes no fonte do middleware. A classificação foi restabelecida em `src`, sem mudar as demais funções; novo build e os 20 testes confirmaram o resultado, sem edição manual de `dist`.

Limites: correlação somente dentro da chamada Express, sem propagação implementada na ponte Next, métricas, tracing ou garantia de retenção. Logs legados fora do escopo não foram substituídos em massa. Perfil de escala e tickets inalterados; sem novas cargas, fixtures de escala, geração ou purge. A categoria técnica não comprova causa raiz; códigos não reconhecidos permanecem fallback.

Próxima etapa: **6.2 — métricas**, sem implementação nesta entrega. Pendências transversais preservadas.
