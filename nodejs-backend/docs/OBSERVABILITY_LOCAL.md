# Observabilidade local — etapa 6.3

Status em 02/11/2026: **6.3 concluída**, com demonstração integrada aprovada no
PostgreSQL de desenvolvimento. Prometheus coletou a API; Grafana exibiu métricas
e o trace real do catálogo no Tempo. A indisponibilidade inicial do Docker em
01/11 foi superada. API e stack iniciadas para a demonstração foram encerradas;
volumes locais preservados. Nenhum dado de negócio, fixture ou dataset de escala
foi criado ou alterado.

## Componentes e alcance

- OpenTelemetry API 1.9.0, SDK Node/base/resources 2.0.1, exportador OTLP/HTTP JSON
  0.200.0, fixados no lockfile. Node utilizado: 24.21.0; Express 4.21.2;
  Prisma 6.11.1. Engines do SDK: ^18.19.0 ou >=20.6.0. Testes confirmaram essa
  combinação. npm sinaliza os pacotes SDK 2.0.1 como deprecated em favor do pacote
  consolidado: revisar atualização em manutenção, sem alegar incompatibilidade.
- Spans manuais: não dependem de patch automático de Express/Prisma nem de feature
  no schema. Primeiro import de server.ts inicializa o provider/contexto antes dos
  módulos de negócio. Nenhum auto-instrumentador coleta SQL ou atributos HTTP.
- Trace começa no Express: GET /products, /products/ e /products/search.
  Outras entradas e Next/BFF não estão instrumentados. Não se aceita traceparent
  externo nesta etapa; requisições concorrentes recebem raízes próprias.
- Árvore: HTTP → catalog.list → repository.products.count/findMany e
  repository.reviews.averageRatings → prisma.product.count/findMany/review.groupBy.
  Spans Prisma medem a chamada real ao client, incluindo seu overhead/esperas;
  **não são duração exclusiva de SQL**, nem o total do repository é uma query.
  groupBy só tem span quando realmente executado (coleção não vazia).
- Apenas método/template/status e error.type são atributos selecionados. Classes
  Prisma conhecidas P1001/P1017 → DATABASE_UNAVAILABLE; P1002/P1008/P2024 →
  DATABASE_TIMEOUT; demais → OPERATION_FAILED. HTTP 5xx → HTTP_SERVER_ERROR;
  fechamento antecipado → CONNECTION_CLOSED. Não são provas da causa raiz.
  Nada de recordException, SQL, parâmetros, filtros, URLs completas, mensagens,
  stacks, cookies, headers ou payloads. Logs acrescentam traceId/spanId somente
  de contexto ativo, preservando requestId. Eles nunca viram labels Prometheus.
- /metrics e health não criam traces. Logs HTTP continuam sendo emitidos.
- Exportação em lote: fila máxima 256 spans, lote 32, intervalo 1 s, timeout HTTP
  1 s/processador 1,5 s. Fila cheia/exportador indisponível pode perder spans;
  não bloqueia a resposta de negócio. Sem console exporter ou logs brutos do SDK.
- Ctrl+C/SIGTERM fecha o HTTP, para o coletor PostgreSQL, encerra exportador e
  desconecta Prisma. Não existe timer de tracing de domínio por requisição.

Referências: [SDK e instrumentação manual](https://opentelemetry.io/docs/languages/js/instrumentation/)
e [tracing Prisma](https://docs.prisma.io/docs/orm/prisma-client/observability-and-logging/opentelemetry-tracing).
Optou-se por spans manuais delimitados, não pelo auto-instrumentador Prisma, para
controlar precisamente os campos exportados e não coletar statements.

## Saúde

| Endpoint | Resultado |
| --- | --- |
| GET /health/live | 200 {status: live}, sem consulta ao banco |
| GET /health/ready | 200 {status: ready} ou 503 {status: unavailable} |

Ambos têm no-store e nenhuma credencial/detalhe interno. Readiness usa transação
READ ONLY, SELECT 1, statement_timeout 1 s, maxWait 1 s, transaction timeout
1,25 s e deadline HTTP 1,5 s. O deadline não cancela magicamente inicialização do
engine/conexão; os limites Prisma/datasource continuam relevantes. Uma única
consulta permanece em voo até realmente terminar, mesmo após o deadline HTTP;
novas chamadas reutilizam resultado indisponível, sem acumular consultas.
Cache de sucesso/falha: 1 s. Nada depende de Grafana, exportador ou métricas.

## Operação (PowerShell)

Na raiz do projeto, Docker Desktop Linux pronto e PostgreSQL de desenvolvimento
já disponível em 127.0.0.1:5433. Não redirecionar para marketplace_scale/E2E.

```powershell
cd nodejs-backend
npm.cmd ci
npm.cmd run build
npm.cmd run observability:secrets
cd ..
docker compose -f docker-compose.observability.yml config --quiet
docker compose -f docker-compose.observability.yml up -d
```

Os segredos aleatórios são criados somente sob demanda em
nodejs-backend/observability/.local, ignorado pelo Git, sem imprimir valores e
sem substituir os existentes. Não versionar nem enviar esses arquivos.

Em outro terminal, no backend:

```powershell
$env:DATABASE_URL='postgresql://marketplace_dev:marketplace_dev_password@127.0.0.1:5433/marketplace_dev'
$env:PORT='8063'
$env:METRICS_ENABLED='true'
$env:TRACING_ENABLED='true'
$env:OTEL_EXPORTER_OTLP_TRACES_ENDPOINT='http://127.0.0.1:4318/v1/traces'
$env:METRICS_REMOTE_TOKEN_FILE='observability/.local/metrics-token'
$env:METRICS_REMOTE_ADDRESSES='172.30.63.2'
npm.cmd start
```

Prometheus conecta em host.docker.internal:8063, **não localhost do container**.
Rede dedicada 172.30.63.0/24: Prometheus 172.30.63.2, Tempo 172.30.63.3 e
Grafana 172.30.63.4, todos fixos para impedir disputa com a alocação automática.
Verificar conflito de subnet antes de iniciar. IP privado exato **e** Bearer dedicado de 64 hex são
necessários para socket não loopback. Não se confia em X-Forwarded-For.
Token ausente/inválido/arquivo ilegível mantém acesso remoto fechado.

Docker Desktop pode apresentar outro IP de origem por NAT/proxy. A conectividade
real foi validada neste host em 02/11/2026 como loopback (127.0.0.1); nesse
caminho vale a proteção local preexistente, não a exceção remota. Em outro host: verificar alvo em /targets do
Prometheus e RemoteAddress com Get-NetTCPConnection -LocalPort 8063 durante
scrapes. Ajustar explicitamente só o IP privado observado e reiniciar a API;
não ampliar para sub-redes, internet ou remover autenticação. Se o transporte
aparecer como loopback, vale a proteção local preexistente. Nenhuma autorização
para publicar esse endpoint por ingress/BFF/proxy público. O token não é JWT.

```powershell
Invoke-RestMethod http://127.0.0.1:8063/health/live
Invoke-RestMethod http://127.0.0.1:8063/health/ready
1..3 | ForEach-Object { Invoke-RestMethod 'http://127.0.0.1:8063/products?page=1&limit=2' }
Invoke-WebRequest http://127.0.0.1:8063/metrics
```

Não executar Try it out de escrita, checkout, jobs ou baseline. Três consultas
sequenciais servem para demonstração, não para medir capacidade.

## Interfaces e correlação

- Grafana: http://127.0.0.1:3063 — admin; senha no arquivo local grafana-password
  (consultar localmente, não copiar para documentação). Fontes e dashboard
  Marketplace — observabilidade local provisionados automaticamente.
- Prometheus: http://127.0.0.1:9090/targets — alvo deve estar UP.
- Tempo: http://127.0.0.1:3200/ready (sem UI); OTLP em 127.0.0.1:4318/v1/traces.
- Grafana Explore → Tempo: pesquisar service.name marketplace-api ou colar
  traceId do log na consulta do tipo TraceQL (o editor reconhece um trace ID).
  Para localizar a chamada: copiar X-Request-ID da resposta,
  buscar esse requestId no stdout e copiar seu traceId para Explore.

Exemplo **ilustrativo**, sanitizado:

```json
{
  "timestamp": "2026-11-01T12:00:00.000Z",
  "level": "info",
  "event": "http.completed",
  "context": {
    "method": "GET",
    "route": "/products/",
    "status": 200,
    "durationMs": 20,
    "outcome": "finished",
    "requestId": "11111111-1111-4111-8111-111111111111",
    "traceId": "11111111111111111111111111111111",
    "spanId": "1111111111111111"
  }
}
```

Logs descrevem eventos, métricas agregam contagens/durações e traces delimitam
operações de uma chamada. Sem Loki, tracing distribuído ou correlação automática
com Next. Nenhum painel deve inventar zero para série ausente. O p95 exige pelo
menos 20 respostas em 5 min; não surgirá na demonstração de três GETs. CPU é rate
de segundos acumulados (núcleos usados), com ao menos 3 scrapes, não percentual.
Demais gráficos mostram contadores, gauges e média acumulada quando definida.

## Recursos, armazenamento e encerramento

Stack opcional, restart=no, somente portas publicadas em loopback. Imagens fixas:
Prometheus 3.2.1, Grafana 11.6.0, Tempo 2.7.1. Limites de memória respectivamente
192/256/256 MiB (704 MiB somados), mais API e Docker Desktop/VM. Cada serviço tem
0,5 CPU de limite, não reserva. Pré-instalação de plugins desabilitada e
grafana-lokiexplore-app explicitamente desabilitado: ele não pertence à stack e
sua versão baixada automaticamente causou 404 de react/jsx-runtime no Grafana
11.6.0. Tempo habilita stream_over_http_enabled para que o cliente gRPC de
consulta do Grafana funcione no endpoint HTTP configurado; isso não adiciona
Loki nem uma stack intermediária. Medir antes de manter ligado em máquina limitada;
OOM pode exigir reduzir o escopo, não aumentar limites automaticamente.

Volumes persistentes próprios do projeto marketplace-observability; não são os
volumes de desenvolvimento/escala. Prometheus: retenção 2 h/100 MB de blocos;
WAL/head podem exceder esse valor. Tempo: 1 h de blocos, rotação de bloco 5 min,
ingestão limitada a 1 MB/s e trace até 100 KB; retenção não é quota rígida de disco
nem inclui toda a WAL. Grafana persiste configuração local. Logs Docker: 1 MB ×
3 arquivos por serviço. Não há compactação ou limpeza global automatizada.

Recomendação preventiva: interromper essa stack se seus volumes ultrapassarem
1 GiB no total ou o host ficar sem margem; observar com docker stats --no-stream,
docker system df -v (somente leitura) e Get-PSDrive. Limites/retensão não garantem
o tamanho do disco virtual compartilhado do Docker Desktop. Parar preserva os
volumes; não executar prune, remoção de volumes ou --remove-orphans.

```powershell
# Encerrar somente os serviços desta stack, preservando volumes:
docker compose -f docker-compose.observability.yml down
# No terminal da API, Ctrl+C. Não encerrar outros processos Node/PostgreSQL.
```

## Evidências finais e limitações — 02/11/2026

- Typecheck e build aprovados novamente; tracing/health **11/11**, métricas
  **15/15** e logging **20/20**, sem depender do dataset de escala. Compose config
  e promtool check config aprovados. Apenas configurações da stack precisaram de
  correções; contratos e regras de negócio permaneceram intactos.
- API compilada exclusiva em 8063, DATABASE_URL explicitamente local
  marketplace_dev:5433. Liveness e readiness 200, no-store. Três GETs sequenciais
  /products?page=1&limit=2 retornaram 200, dois itens e total três em cada chamada.
- Trace real f7e1433563eeee36d976369a21bf5736, request ID
  72964c5d-502b-4c28-aaee-bd4ce03a87f4: oito spans esperados, com pais coerentes
  e correlação no log HTTP. Tempos HTTP observados das três respostas: 91,026 ms
  (primeira), 7,721 ms e 6,972 ms; demonstração, não benchmark nem comparação de
  capacidade. Só operações reais Prisma, sem SQL/parametrização exportados.
- Prometheus /targets UP (up=1), postgres_collection_up=1, uma conexão observada.
  Séries HTTP mostraram três respostas do catálogo; scrapes não foram incluídos.
  Docker → host.docker.internal:8063 funcionou e chegou ao socket como loopback.
  A exceção por IP privado + segredo permanece testada por doubles, sem alegar
  que esse caminho NAT exerceu autenticação remota.
- Playwright: login local Grafana, painel provisionado com dez painéis e consultas
  de todos eles com status 200. p95 ficou sem amostras, corretamente, e não foi
  preenchido com zero. Explore exibiu HTTP, catalog.list, repository e Prisma no
  trace real; o mesmo trace reapareceu após reiniciar Tempo. Após as correções,
  nova navegação de dashboard/Explore sem erros de console. O endpoint opcional
  /api/datasources/uid/tempo/health respondeu 404 Method not implemented nessa
  versão; a conexão foi comprovada por consulta/exibição real do trace.
- Tempo foi parado isoladamente, sem parar PostgreSQL. Dois GETs adicionais do
  catálogo retornaram 200 e readiness permaneceu 200, antes e depois de ciclos
  de exportação. Spans durante indisponibilidade podem ser perdidos; não se
  simula entrega ou persistência. Depois, Tempo voltou e o trace anterior foi
  exibido novamente. Indisponibilidade do banco e timeout cobertos por doubles
  na suíte; smoke isolado anterior com banco local inacessível: ready 503 ~1,51 s.
- Ajustes comprovados: IPs fixos de todos os containers (Tempo havia ocupado .2
  antes do Prometheus); plugin Loki não utilizado desabilitado; consulta gRPC
  sobre HTTP habilitada no Tempo (cessaram erros de protocolo no Grafana).

Consumo observado, por amostras, não monitoramento contínuo nem overhead isolado:

| Componente | Memória observada |
| --- | --- |
| Prometheus | 19,9–26,7 MiB |
| Grafana | 74,0–97,7 MiB |
| Tempo | 25,9–41,5 MiB |
| API Node | cerca de 83 MiB RSS |

CPU dos containers nas amostras pós-inicialização: 0–0,21%; isso não é pico nem
custo por requisição. Memória livre Windows: cerca de 1,71 GiB antes da stack e
menor amostra de aproximadamente 307 MiB durante a navegação. Docker/VM, browser
e outros aplicativos compartilham a máquina; não atribuir essa diferença só à
instrumentação. Encerrar a stack após uso continua recomendado; sem cargas,
novos pisos de RAM ou alterações globais para liberar memória.

Último du -sk: Prometheus 76 KiB, Grafana 30.428 KiB, Tempo 320 KiB (~30,1 MiB
alocados nos diretórios amostrados). Não inclui imagens baixadas, toda a VM,
metadados, espaço aparente de arquivos esparsos nem disco virtual compartilhado;
não representa teto de armazenamento. Windows C: tinha ~21,1 GiB livres na
última amostra. Volumes persistentes marketplace-observability_prometheus-data,
marketplace-observability_grafana-data e marketplace-observability_tempo-data
preservados; nenhuma compactação ou remoção de volumes executada.

Encerramento conferido: log server.stopped, API/collector/exportador/Prisma
encerrados; Compose down removeu apenas os três containers e a rede desta
stack. Portas 8063/3063/9090/3200/4318 sem listeners; PostgreSQL preexistente
marketplace-postgres-1 permaneceu ativo. Cookies/senhas, screenshots, traces e
arquivos de sessão não foram adicionados ao Git. Nenhum teste de carga, ticket,
purge, geração de dados ou acesso a produção/escala. Próxima etapa: **7.1**;
pendências transversais permanecem preservadas.
