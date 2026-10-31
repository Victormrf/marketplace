# Logs estruturados e identificação HTTP — 6.1

## Uso e configuração

O backend Express usa um logger compartilhado, com JSON por linha, timestamp UTC, `level`, `event` e `context`. Implementação nativa pequena: `JSON.stringify`, stdout/stderr e `AsyncLocalStorage`, sem dependência adicional ou logger por domínio. O contexto assíncrono permite importar `logger` e `getRequestId()` em controller/service sem passar IDs por todos os métodos.

Defina `LOG_LEVEL=debug|info|warn|error` **antes de iniciar** o processo. O nível mínimo padrão é `info` em todos os ambientes; valor inválido também resulta em `info`. `debug` não fica habilitado globalmente por padrão. `error` vai para stderr; demais níveis, stdout. Níveis mais altos podem suprimir eventos de sucesso: para acompanhar o ciclo completo, use `info`. Build normal: `npm run build`; regressão sem banco: `npm run test:logging` após o build.

## Request ID e ciclo HTTP

O primeiro middleware, antes do parser JSON e das rotas, cria um UUID e o devolve em `X-Request-ID`, inclusive em 400/401/403/404/500. Um UUID textual recebido, com exatamente 36 caracteres e formato hexadecimal com hífens, é aceito; outros valores, inclusive longos ou múltiplos concatenados, são substituídos. O ID também fica em `req.requestId`. Ele é opaco, não autentica ninguém, não garante unicidade global quando escolhido pelo cliente e **não é Idempotency-Key nem tracing distribuído**.

Uma única conclusão `http.completed` contém método, template de rota, status, duração monotônica em milissegundos e `outcome=finished|connection_closed`. `finish` e `close` são deduplicados. Se a conexão encerra antes dos headers, `status=null`: não houve status HTTP enviado. Após envio parcial, registra o status escolhido e `connection_closed`; isso não prova que o cliente recebeu o corpo nem cancela uma operação de negócio em andamento.

IDs e queries não entram no nome da rota: usa-se `req.route.path` e somente mounts literais conhecidos. Recursos inexistentes ou bloqueados antes de selecionar rota usam `[unmatched]`; um mount dinâmico/desconhecido usa `[mounted]`, nunca seu valor real. Rotas regex não são serializadas. Novos mounts literais devem ser revisados na allowlist do middleware. Request ID é local à chamada Express: a ponte Next e outros serviços não foram instrumentados nesta etapa.

## Eventos de checkout e correlação

O service emite `checkout.created` ou `checkout.replayed` após a execução retornar, sem código diagnóstico nos eventos de sucesso. Conflito do repository vira `checkout.conflict` em `warn`, com o código tipado atribuído ao `CheckoutConflictError` no ponto de detecção. Falha inesperada é registrada uma vez no controller como `checkout.failed`, `error`, com categoria técnica somente quando reconhecida por tipo/código estruturado. O evento HTTP de status 500 é um resumo distinto, sem duplicar erro/stack. Validação, falta de permissão e recurso inexistente mantêm seus códigos HTTP e não são registrados como falhas técnicas.

### Códigos de conflito (`checkout.conflict`)

| Código                             | Condição detectada no repository                                                       |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| `CART_EMPTY`                       | Carrinho ativo sem itens                                                               |
| `INSUFFICIENT_STOCK`               | Quantidade solicitada maior que o estoque disponível                                   |
| `PRODUCT_UNAVAILABLE`              | Produto ou seller associado inativo/indisponível para a compra                         |
| `INVALID_QUANTITY`                 | Quantidade não inteira segura ou não positiva                                          |
| `IDEMPOTENCY_PROCESSING`           | Registro da chave no estado PROCESSING                                                 |
| `IDEMPOTENCY_FINGERPRINT_MISMATCH` | Registro existente com fingerprint divergente                                          |
| `IDEMPOTENCY_STATE_CONFLICT`       | Registro não localizado após colisão ou outro estado/resultado incompatível com replay |
| `PRODUCT_NOT_FOUND`                | Produto necessário não encontrado após leitura com lock                                |
| `SELLER_NOT_FOUND`                 | Seller necessário não encontrado após leitura com lock                                 |
| `INVENTORY_UNAVAILABLE`            | Inventário ausente ou indisponível durante o checkout                                  |
| `UNSUPPORTED_CURRENCY`             | Produto com moeda diferente de BRL                                                     |
| `BUSINESS_CONFLICT`                | Fallback do erro tipado quando não há classificação mais específica                    |

Não se compara `error.message` para classificar. Mensagens públicas continuam exatamente as existentes: por exemplo, a condição de moeda incompatível ainda responde com o texto público de estoque insuficiente, mas seu diagnóstico interno é `UNSUPPORTED_CURRENCY`. `PRODUCT_UNAVAILABLE` é uma categoria agregada: não identifica sozinho qual entidade está inativa. Se várias condições existirem, o código corresponde à verificação que interrompeu o fluxo, não a uma investigação completa de causas.

### Falhas técnicas (`checkout.failed`)

Somente instâncias de `PrismaClientKnownRequestError` (campo `code`) ou `PrismaClientInitializationError` (campo `errorCode`) são reconhecidas:

| Código do log               | Evidência estruturada                                                           |
| --------------------------- | ------------------------------------------------------------------------------- |
| `DATABASE_UNAVAILABLE`      | Prisma P1001 (servidor não alcançado) ou P1017 (conexão encerrada)              |
| `DATABASE_TIMEOUT`          | Prisma P1002, P1008 ou P2024 (timeout de conexão/operação/aquisição de conexão) |
| `UNEXPECTED_CHECKOUT_ERROR` | Qualquer outra falha, código não mapeado ou objeto sem tipo confiável           |

P2024 não comprova query lenta nem indisponibilidade global do banco; a categoria indica timeout na interação com o banco. P1017 indica indisponibilidade daquela conexão, não de toda a infraestrutura. P2028 pode representar diferentes falhas transacionais e permanece fallback. Mensagens que contenham “timeout”, nomes de erro, objetos com `{code: "P1001"}` e causas aninhadas não são usados para inferir causa específica. A exceção original não é modificada, e a resposta continua 500 com a mensagem genérica anterior.

### Categorias do resumo HTTP (`http.completed`)

| Código                   | Resultado conhecido                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------- |
| `HTTP_BAD_REQUEST`       | 400: requisição rejeitada, inclusive validação/parsing; não identifica o campo ou causa |
| `HTTP_UNAUTHENTICATED`   | 401                                                                                     |
| `HTTP_FORBIDDEN`         | 403                                                                                     |
| `HTTP_NOT_FOUND`         | 404                                                                                     |
| `HTTP_CONFLICT`          | 409, sem presumir conflito de estoque/idempotência                                      |
| `HTTP_CLIENT_ERROR`      | Outros 4xx                                                                              |
| `HTTP_SERVER_ERROR`      | 5xx, sem presumir indisponibilidade ou timeout                                          |
| `HTTP_CONNECTION_CLOSED` | Conexão encerrada antes da conclusão; tem precedência sobre a categoria do status       |

Respostas normais abaixo de 400 não recebem código. Um fechamento antecipado pode ter status 200/202 já enviado e continuar sendo warning, ou status null antes dos headers; não é reinterpretado como timeout. Categorias HTTP descrevem o resultado; a classificação detalhada de negócio continua restrita ao checkout. Todos os códigos acima passam pela allowlist do logger; códigos arbitrários são descartados.

Exemplo fictício sanitizado, **não uma nova execução**:

```json
{"timestamp":"2026-10-26T12:00:00.000Z","level":"info","event":"checkout.created","context":{"requestId":"11bb22cc-3344-4567-8abc-1234567890ab"}}
{"timestamp":"2026-10-26T12:00:00.005Z","level":"info","event":"http.completed","context":{"method":"POST","route":"/checkout/","status":201,"durationMs":42.5,"outcome":"finished","requestId":"11bb22cc-3344-4567-8abc-1234567890ab"}}
```

Copie o `X-Request-ID` recebido e filtre os JSONs por igualdade de `context.requestId` em stdout/stderr. Isso reúne os eventos de negócio e a conclusão daquela chamada, inclusive após awaits. Repetições HTTP podem ter IDs diferentes; não os use para deduzir idempotência.

Exemplo fictício de conflito, sem mensagem bruta, chave ou fingerprint:

```json
{"timestamp":"2026-10-31T12:00:00.000Z","level":"warn","event":"checkout.conflict","context":{"code":"INSUFFICIENT_STOCK","requestId":"11bb22cc-3344-4567-8abc-1234567890ab"}}
{"timestamp":"2026-10-31T12:00:00.005Z","level":"warn","event":"http.completed","context":{"method":"POST","route":"/checkout/","status":409,"durationMs":42.5,"outcome":"finished","code":"HTTP_CONFLICT","requestId":"11bb22cc-3344-4567-8abc-1234567890ab"}}
```

## Política de seleção e redação

O código escolhe somente campos operacionais. O logger aplica defesa adicional por allowlist: descarta propriedades desconhecidas, objetos aninhados, campos de Error/Prisma/request e IDs de contexto fornecidos pelo chamador. Eventos e códigos também têm allowlists; números precisam ser finitos e não negativos. Rotas têm limite de 200 caracteres e formato restrito. Nenhum erro é serializado automaticamente: mensagem, stack e cause ficam fora da saída.

Nunca enviar ao logger senhas, JWTs, cookies, Authorization, headers completos, Idempotency-Key, fingerprint, e-mails, endereços, dados de pagamento, strings de conexão, bodies ou SQL. Não usar `route`/nomes de eventos para codificar esses dados: redação não substitui selecionar campos seguros. A política vale para o logger introduzido; logs legados de outros domínios/dependências não foram substituídos indiscriminadamente nem auditados integralmente nesta etapa.

Não há arquivos de log criados pela aplicação, transporte remoto, métricas ou infraestrutura de coleta. Configure retenção, rotação e limites no ambiente que consumir stdout/stderr; não redirecione para arquivo sem limite. Níveis elevados reduzem o volume, mas não garantem persistência. Falha de sink não altera respostas/transações e pode perder o evento; o logger não é trilha financeira durável. Não habilitar dumps SQL ou debug de dependências para compensar isso.

## Validação

`test:logging` captura o logger em memória e usa HTTP real local em portas efêmeras, com doubles de autenticação/persistência e JWT exclusivamente de teste, **sem conexão PostgreSQL**. Cobre UUID válido/inválido, header e contexto, concorrência, status/duração, sucesso/replay/409/500, 400/401/403/404, fechamento com e sem headers, deduplicação, níveis, exclusão de dados sensíveis e falha do sink. A suíte também integra `test:all`.

Ajuste de classificação validado em 31/10/2026: **20/20 testes de logging**, incluindo os pontos reais de detecção do repository com transações substituídas por doubles, tipos reais de erro Prisma, códigos distintos, fallbacks sem inferência por mensagem, descarte de códigos arbitrários e ausência de código em sucesso. Regressão `test:checkout`: **15/15**, executada somente no PostgreSQL local `marketplace_dev:5433`, com fixtures próprias removidas pelo teardown. Typecheck e build aprovados. Nenhum dataset de escala, ticket, carga, gerador ou purge executado.
