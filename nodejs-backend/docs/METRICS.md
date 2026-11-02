# Métricas locais — etapa 6.2

Implementação em `prom-client` 15.1.3, registro privado por processo e prefixo `marketplace_`. Não inicia Prometheus, Grafana, filas, exportadores remotos ou tracing. Coleta desabilitada por padrão. As métricas são agregados voláteis: reiniciar o processo reinicia contadores/histogramas; nenhuma série é gravada pela aplicação.

## Habilitar e consultar

Variáveis lidas ao iniciar o processo:

| Variável                 | Padrão e limites                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------- |
| `METRICS_ENABLED`        | `false`; somente o texto `true` habilita endpoint, eventos query e coleta periódica   |
| `METRICS_DB_INTERVAL_MS` | 30.000 ms após terminar a coleta anterior; aceita 10.000–300.000, inválido usa padrão |
| `METRICS_DB_TIMEOUT_MS`  | 2.000 ms; aceita 250–5.000, inválido usa padrão                                       |

Exemplo PowerShell, em `nodejs-backend`, com o PostgreSQL de desenvolvimento já disponível:

```powershell
npm.cmd ci
npm.cmd run build
$env:DATABASE_URL = 'postgresql://marketplace_dev:marketplace_dev_password@127.0.0.1:5433/marketplace_dev'
$env:METRICS_ENABLED = 'true'
$env:METRICS_DB_INTERVAL_MS = '30000'
$env:METRICS_DB_TIMEOUT_MS = '2000'
$env:PORT = '8000'
npm.cmd start
```

As configurações devem ser exportadas ao processo; `.env.example` documenta os valores, não instala um novo carregador de ambiente. Usar somente URL local autorizada para essa verificação. Em outro terminal:

```powershell
$response = Invoke-WebRequest 'http://127.0.0.1:8000/metrics'
$response.StatusCode
$response.Headers['Content-Type']
$response.Content
($response.Content -split "`n") | Select-String '^marketplace_(http|checkout|prisma|postgres)_'
```

`Ctrl+C` encerra a coleta antes de desconectar Prisma. Para desabilitar, definir `METRICS_ENABLED=false` e reiniciar; GET `/metrics` volta a ser inexistente (404). Flags inválidas não habilitam a instrumentação.

**Endpoint somente local:** quando habilitado, aceita GET/HEAD em `/metrics` de socket loopback por padrão; a exceção privada opt-in da 6.3 exige IP exato e credencial própria, conforme [operação local](OBSERVABILITY_LOCAL.md). Demais conexões remotas recebem 403, sem confiar em X-Forwarded-For. Retorna `Cache-Control: no-store`; falha ao renderizar métricas retorna 503 genérico. Não publicar o caminho no proxy/ingress: um proxy local pode fazer uma requisição externa parecer loopback. Não há nova autenticação de negócio nem alteração dos contratos existentes.

## Métricas disponíveis

| Métrica (prefixo `marketplace_`)          | Significado e labels                                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------- |
| `http_requests_total`                     | Respostas concluídas em `finish`, inclusive 4xx/5xx; labels `method`, `route` template e `status`                  |
| `http_request_duration_seconds`           | Histograma até `finish`, com as mesmas labels; inclui respostas de erro, exclui abortadas                          |
| `http_requests_in_flight`                 | Gauge sem labels, do início até finish/close                                                                       |
| `http_connections_closed_total`           | Encerramentos antes de finish; labels somente `method`, `route`; não entram em respostas concluídas                |
| `checkout_created_total`                  | Criações depois do retorno bem-sucedido da transação; sem labels                                                   |
| `checkout_replayed_total`                 | Replays bem-sucedidos; não são novas compras; sem labels                                                           |
| `checkout_conflicts_total`                | Conflitos por `code` tipado da 6.1, com a mesma allowlist                                                          |
| `checkout_failures_total`                 | Falhas técnicas por `code`: DATABASE_UNAVAILABLE, DATABASE_TIMEOUT ou UNEXPECTED_CHECKOUT_ERROR                    |
| `prisma_queries_total`                    | Eventos query emitidos pelo cliente singleton da API; sem labels SQL/modelo/ID                                     |
| `prisma_query_duration_seconds`           | Histograma da duração em ms informada pelo Prisma, convertida para segundos; não é duração de transação ou request |
| `postgres_connections`                    | Sessões client backend do banco atual, incluindo a conexão usada pelo monitor; NaN quando indisponível             |
| `postgres_active_sessions`                | Sessões ativas visíveis à role, excluindo a própria consulta do monitor; NaN quando indisponível                   |
| `postgres_collection_up`                  | 1 na última coleta bem-sucedida; 0 antes da primeira ou após falha                                                 |
| `postgres_last_success_timestamp_seconds` | Unix timestamp da última coleta válida; 0 antes da primeira; preservado em falhas                                  |
| `postgres_collection_errors_total`        | Quantidade de tentativas de coleta malsucedidas, sem mensagem/código SQL                                           |
| `postgres_collection_duration_seconds`    | Histograma do tempo total de uma coleta, incluindo aquisição/configuração transacional; label `outcome=success     | failure` |

Os histogramas expõem `_bucket`, `_count` e `_sum`. HTTP tem buckets de 5 ms a 10 s; query, 1 ms a 5 s; coleta, 5 ms a 5 s; há bucket `+Inf`. Percentis estimados pelos buckets não equivalem a amostras individuais. Para saber quantas respostas falharam, separar 5xx dos 4xx pelo status; um conflito esperado 409 não é contado como falha técnica de checkout. Abortos são outra série.

Métricas padrão do Node (`marketplace_process_*` e `marketplace_nodejs_*`) incluem CPU acumulada em segundos, RSS/heap, GC, event loop e recursos disponíveis na plataforma. CPU acumulada não é percentual; seu consumo é obtido por diferença no tempo. Não são adicionadas labels de ambiente, PID, hostname, argumentos ou credenciais. Labels nativas de runtime, como tipo, heap space, kind e versão, são limitadas. Nenhum provider/exportador de tracing foi configurado, inclusive com a dependência transitiva `@opentelemetry/api` do prom-client.

## Limites HTTP e de negócio

O middleware da 6.1 fornece a mesma identificação segura de rota para logs e métricas. Usa templates como `/products/:productIds`, `[unmatched]` ou `[mounted]`; nunca URL real, query string, usuário, produto, payload, request ID, chave ou fingerprint como label. A conclusão é deduplicada entre finish/close; o gauge é decrementado também no aborto. Finish indica conclusão no servidor, não confirmação de recebimento pelo navegador.

GET/HEAD em `/metrics` (inclusive caixa/trailing slash e query) não entram em contagem, histograma, abortos ou gauge HTTP. O endpoint ainda tem request ID e log de ciclo da 6.1; sua CPU pode aparecer naturalmente nos agregados do processo. Não há counter por domínio além do checkout. Métodos desconhecidos usam OTHER; códigos fora das allowlists são ignorados. Falhas de atualização dos instrumentos são contidas e não alteram a resposta/commit de negócio. Métricas não são uma trilha financeira durável.

## Prisma e PostgreSQL: alcance exato

Prisma instalado: **6.11.1**, client padrão PostgreSQL, sem preview `metrics` no schema. Foi escolhido o evento query suportado (`emit: event`), não `$metrics` experimental. O callback acessa somente `duration`; SQL, parâmetros, targets e credenciais não são lidos, registrados ou adicionados às séries.

Só o singleton de `src/config/db.ts` é instrumentado. Clientes separados de scripts/testes, outros processos e ferramentas externas não entram nesse counter. Contam-se eventos efetivamente emitidos: podem incluir BEGIN/COMMIT, configuração transacional e SQL do próprio monitor. Não é um contador exato de operações de negócio nem uma contagem garantida de todas as tentativas/erros SQL. A duração vem do evento do Prisma; não mede awaits da aplicação, transação completa ou tempo de rede HTTP.

O monitor usa o mesmo cliente/pool, sem outro Prisma engine/container. No início da API faz uma coleta; depois aguarda o intervalo **após** a conclusão anterior. Não há sobreposição, nem SQL de monitoramento por request ou scrape. Uma transação curta READ ONLY executa configuração local de `statement_timeout` e uma agregação em `pg_stat_activity`, limitada a `current_database()` e client backends. A conta de conexões inclui o monitor; a conta de ativas o exclui e depende da visibilidade da role. Isso não é ocupação exata do pool Prisma nem monitor de locks.

Timeout padrão: 2 s para aguardar aquisição, 2,5 s para a transação e 2 s por statement. Inicialização/conexão de rede também depende dos timeouts do datasource/Prisma; não se promete um único teto wall-clock somando todas essas fases. A coleta seguinte só ocorre quando a tentativa anterior termina. Em erro, continua servindo a API, incrementa erros, marca up=0 e torna os valores de sessões NaN, sem fingir um zero ou manter contagens antigas como atuais. Último sucesso permite avaliar idade do dado. O shutdown aguarda a tentativa pendente e cancela o próximo timer antes do disconnect.

## Verificação observada e limitações

Em **31/10/2026**, typecheck/build, `test:metrics` (15/15) e `test:logging` (20/20) passaram. As suítes usam HTTP loopback e doubles; cobrem finalização única, gauge, duração, abortos, labels, flags, recusa remota, isolamento de falhas, códigos compartilhados, coleta serial, recuperação e configuração de timeout. Sem fixtures de banco nos testes.

Smoke de leitura no `marketplace_dev:5433`, com API efêmera encerrada ao final: GET `/` 200, recurso inexistente 404 e duas leituras de `/metrics` 200. Contabilizadas exatamente duas respostas da aplicação; scrapes excluídos, gauge voltou a zero. Uma coleta teve up=1, uma conexão, zero outras sessões ativas, zero falhas e **246,3 ms**, incluindo a primeira conexão. O Prisma emitiu seis eventos (monitor/controle transacional e SELECT 1). Os scrapes levaram **12,2 e 7,8 ms**, com cerca de **18,5 kB** e 43 famílias de métricas na plataforma observada. RSS do processo completo foi aproximadamente 100 MiB; não é custo isolado da instrumentação.

São amostras de verificação, não benchmark, carga ou limite de capacidade. Memória/dados mudam conforme plataforma, uptime e número de templates. Não houve operação de negócio, geração, purge, acesso ao dataset de escala ou consumo de tickets. Sem coleta externa, não há histórico entre reinícios ou painéis. O npm marca `prom-client` como descontinuado em favor de outro pacote; foi mantido e fixado em 15.1.3 conforme a biblioteca solicitada, sem migração de escopo nesta etapa.

**Logs** explicam eventos de uma chamada pelo request ID. **Métricas** mostram agregados e distribuições sem IDs. **Tracing futuro** descreverá spans/caminhos internos; não está implementado. A 6.3 poderá adicionar visualização/tracing/health-readiness. Filas e métricas de workers ficam para a fase 7, sem séries fictícias agora.
