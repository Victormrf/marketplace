# Etapa 6.1 — Logs estruturados e identificação HTTP

Implementação restrita ao Express: logger JSON centralizado nativo do Node, níveis por `LOG_LEVEL`, saída stdout/stderr e contexto por `AsyncLocalStorage`, sem novas dependências. Padrão `info`, sem arquivos de log próprios.

- Middleware antes do parser gera/valida UUID, devolve `X-Request-ID`, oferece `req.requestId` e contexto aos services. Um evento de conclusão por request registra template seguro, status/duração e finalização ou fechamento antecipado; antes dos headers, status null.
- Checkout registra criação, replay, conflito esperado e falha inesperada com o mesmo ID. Mensagens/stacks de erros não são serializadas; códigos fixos e allowlists protegem o contexto. Nenhuma regra, resposta de negócio, transação, lock ou idempotência alterada.
- Política de redação, exemplo sanitizado de correlação, configuração e cuidados de retenção em [REQUEST_LOGGING.md](nodejs-backend/docs/REQUEST_LOGGING.md).
- Typecheck (`npx tsc --noEmit`), build e `npm run test:logging` **14/14 aprovados**. Testes usam HTTP real local com logger capturado e persistência substituída por doubles, sem banco/dataset de escala; o sandbox inicialmente bloqueou loopback com EACCES, e a execução com permissão local passou. A suíte integra `test:all`, que não foi executado nesta entrega para não criar fixtures em banco.
- Arquivos principais: `src/utils/logger.ts` seleciona/sanitiza campos e controla nível/sink; `src/utils/requestContext.ts` mantém contexto; `src/middlewares/requestLogging.ts` identifica e encerra chamadas; checkout service/controller emitem eventos seguros. `dist` foi gerado exclusivamente pelo build, mantendo a política de versionamento existente.

Limites: correlação somente dentro da chamada Express, sem propagação implementada na ponte Next, métricas, tracing ou garantia de retenção. Logs legados fora do escopo não foram substituídos em massa. Perfil de escala e tickets inalterados; sem novas cargas, fixtures em banco, geração ou purge.

Próxima etapa: **6.2 — métricas**, sem implementação nesta entrega. Pendências transversais preservadas.
