# Logs estruturados e identificação HTTP — 6.1

## Uso e configuração

O backend Express usa um logger compartilhado, com JSON por linha, timestamp UTC, `level`, `event` e `context`. Implementação nativa pequena: `JSON.stringify`, stdout/stderr e `AsyncLocalStorage`, sem dependência adicional ou logger por domínio. O contexto assíncrono permite importar `logger` e `getRequestId()` em controller/service sem passar IDs por todos os métodos.

Defina `LOG_LEVEL=debug|info|warn|error` **antes de iniciar** o processo. O nível mínimo padrão é `info` em todos os ambientes; valor inválido também resulta em `info`. `debug` não fica habilitado globalmente por padrão. `error` vai para stderr; demais níveis, stdout. Níveis mais altos podem suprimir eventos de sucesso: para acompanhar o ciclo completo, use `info`. Build normal: `npm run build`; regressão sem banco: `npm run test:logging` após o build.

## Request ID e ciclo HTTP

O primeiro middleware, antes do parser JSON e das rotas, cria um UUID e o devolve em `X-Request-ID`, inclusive em 400/401/403/404/500. Um UUID textual recebido, com exatamente 36 caracteres e formato hexadecimal com hífens, é aceito; outros valores, inclusive longos ou múltiplos concatenados, são substituídos. O ID também fica em `req.requestId`. Ele é opaco, não autentica ninguém, não garante unicidade global quando escolhido pelo cliente e **não é Idempotency-Key nem tracing distribuído**.

Uma única conclusão `http.completed` contém método, template de rota, status, duração monotônica em milissegundos e `outcome=finished|connection_closed`. `finish` e `close` são deduplicados. Se a conexão encerra antes dos headers, `status=null`: não houve status HTTP enviado. Após envio parcial, registra o status escolhido e `connection_closed`; isso não prova que o cliente recebeu o corpo nem cancela uma operação de negócio em andamento.

IDs e queries não entram no nome da rota: usa-se `req.route.path` e somente mounts literais conhecidos. Recursos inexistentes ou bloqueados antes de selecionar rota usam `[unmatched]`; um mount dinâmico/desconhecido usa `[mounted]`, nunca seu valor real. Rotas regex não são serializadas. Novos mounts literais devem ser revisados na allowlist do middleware. Request ID é local à chamada Express: a ponte Next e outros serviços não foram instrumentados nesta etapa.

## Eventos de checkout e correlação

O service emite `checkout.created` ou `checkout.replayed` após a execução retornar; conflito do repository vira `checkout.conflict` em `warn`, com `code=BUSINESS_CONFLICT`. Falha inesperada é registrada uma vez no controller como `checkout.failed`, `error`, código fixo `UNEXPECTED_CHECKOUT_ERROR`. O evento HTTP de status 500 é um resumo distinto, sem duplicar erro/stack. Validação, falta de permissão e recurso inexistente mantêm seus códigos HTTP e não são registrados como falhas técnicas.

Exemplo fictício sanitizado, **não uma nova execução**:

```json
{"timestamp":"2026-10-26T12:00:00.000Z","level":"info","event":"checkout.created","context":{"requestId":"11bb22cc-3344-4567-8abc-1234567890ab"}}
{"timestamp":"2026-10-26T12:00:00.005Z","level":"info","event":"http.completed","context":{"method":"POST","route":"/checkout/","status":201,"durationMs":42.5,"outcome":"finished","requestId":"11bb22cc-3344-4567-8abc-1234567890ab"}}
```

Copie o `X-Request-ID` recebido e filtre os JSONs por igualdade de `context.requestId` em stdout/stderr. Isso reúne os eventos de negócio e a conclusão daquela chamada, inclusive após awaits. Repetições HTTP podem ter IDs diferentes; não os use para deduzir idempotência.

## Política de seleção e redação

O código escolhe somente campos operacionais. O logger aplica defesa adicional por allowlist: descarta propriedades desconhecidas, objetos aninhados, campos de Error/Prisma/request e IDs de contexto fornecidos pelo chamador. Eventos e códigos também têm allowlists; números precisam ser finitos e não negativos. Rotas têm limite de 200 caracteres e formato restrito. Nenhum erro é serializado automaticamente: mensagem, stack e cause ficam fora da saída.

Nunca enviar ao logger senhas, JWTs, cookies, Authorization, headers completos, Idempotency-Key, fingerprint, e-mails, endereços, dados de pagamento, strings de conexão, bodies ou SQL. Não usar `route`/nomes de eventos para codificar esses dados: redação não substitui selecionar campos seguros. A política vale para o logger introduzido; logs legados de outros domínios/dependências não foram substituídos indiscriminadamente nem auditados integralmente nesta etapa.

Não há arquivos de log criados pela aplicação, transporte remoto, métricas ou infraestrutura de coleta. Configure retenção, rotação e limites no ambiente que consumir stdout/stderr; não redirecione para arquivo sem limite. Níveis elevados reduzem o volume, mas não garantem persistência. Falha de sink não altera respostas/transações e pode perder o evento; o logger não é trilha financeira durável. Não habilitar dumps SQL ou debug de dependências para compensar isso.

## Validação

`test:logging` captura o logger em memória e usa HTTP real local em portas efêmeras, com doubles de autenticação/persistência e JWT exclusivamente de teste, **sem conexão PostgreSQL**. Cobre UUID válido/inválido, header e contexto, concorrência, status/duração, sucesso/replay/409/500, 400/401/403/404, fechamento com e sem headers, deduplicação, níveis, exclusão de dados sensíveis e falha do sink. A suíte também integra `test:all`. Nenhum dataset, ticket ou perfil de escala é consumido.
