# Progressão de deliveries por fila — etapas 7.2–7.4

Fluxo implementado: scheduler opcional → descoberta da 7.1 → publicação confirmada
→ BullMQ/Redis → worker Node → processDeliveryProgressionJob → service →
repository/PostgreSQL. Nenhuma regra de progressão foi duplicada no worker.
O publisher manual permanece disponível; a recorrência explícita está na seção 7.4.

## Versões e infraestrutura

BullMQ **5.81.5**, com ioredis **5.11.1** resolvido pelo lockfile; Node utilizado
24.21.0 e Prisma 6.11.1. Linha BullMQ 5 escolhida para as APIs de worker e
UnrecoverableError utilizadas; npm ci reproduz a instalação. O npm avisa que
cron-parser 4.9.0 transitivo está deprecated: dívida de dependência, sem cron
HTTP ou scheduler novo na aplicação. Não foi instalada interface de administração.

Redis **7.4.2-alpine**, Compose dedicado marketplace-delivery-queue, somente
127.0.0.1:6381 → 6379. Limite de container 192 MiB/0,5 CPU, maxmemory 64 MiB,
noeviction, AOF e appendfsync everysec; logs Docker limitados a 1 MB × 3 arquivos.
Sem observabilidade obrigatória e sem alterar o Compose do PostgreSQL existente.
Ao atingir maxmemory, Redis pode recusar publicação, em vez de expulsar chaves.

Volume estável **marketplace-delivery-redis-data**, montado em **/data**. Docker
reportou /var/lib/docker/volumes/marketplace-delivery-redis-data/_data dentro do
ambiente Linux. No Docker Desktop esses dados ficam no armazenamento da VM/disco
virtual compartilhado, não em uma pasta Windows equivalente inventada. Não foi
identificado um caminho Windows específico desse volume. Parar/remover container
sem -v preserva dados. AOF/persistência e limites não garantem perda zero, nem
redução imediata do disco virtual após remover jobs. Falha abrupta pode perder
escritas ainda não sincronizadas; PostgreSQL continua autoridade de negócio.

## Comandos (PowerShell)

Na raiz, iniciar explicitamente apenas a fila:

```powershell
docker compose -f docker-compose.delivery-queue.yml up -d
cd nodejs-backend
npm.cmd ci
npm.cmd run build
$env:DATABASE_URL='postgresql://marketplace_dev:marketplace_dev_password@127.0.0.1:5433/marketplace_dev'
$env:DELIVERY_REDIS_URL='redis://127.0.0.1:6381/0'
$env:DELIVERY_QUEUE_PREFIX='marketplace-delivery'
$env:DELIVERY_WORKER_CONCURRENCY='1'
```

Variáveis devem ser exportadas em cada terminal; .env.example não é um novo
carregador de ambiente. REDIS URL é obrigatória (redis/rediss, host e DB 0–15),
prefixo aceita letras minúsculas/números/hífen até 80 caracteres e concorrência
por worker aceita inteiro **1–4**, padrão 1. Não imprimir URLs com credenciais.
Use somente o banco pretendido e não aponte os comandos desta etapa para escala
ou produção. Os comandos operacionais abaixo alteram as deliveries configuradas.

| Comando | Responsabilidade |
| --- | --- |
| npm.cmd run job:deliveries | Modo direto existente: descobre e processa sem fila; inclui build como antes. |
| npm.cmd run job:deliveries:publish | Descobre em páginas/keyset e publica sequencialmente, aguardando cada confirmação. |
| npm.cmd run worker:deliveries | Inicia o worker compilado independente, sem Express; fica aguardando jobs. |
| npm.cmd run queue:deliveries:status | Consulta contagens e até 20 falhas recentes, sem reprocessá-las. |

Build única antes dos novos comandos; eles usam dist. Não operar o modo direto e
o modo com fila simultaneamente no uso normal. O Job Scheduler opcional da 7.4
tem comandos próprios; nenhum cron/worker é iniciado junto ao HTTP.
Cada processo possui suas conexões, sem exigir Next, Grafana ou Tempo.

Para encerrar: Ctrl+C no worker; após parar publishers/workers, na raiz:

```powershell
docker compose -f docker-compose.delivery-queue.yml down
```

Não usar -v, FLUSHALL/FLUSHDB, prune ou limpeza global. Não há comando de retry
ou recuperação automática de failed nesta entrega.

## Publicação e resultados

- Nome único de fila: delivery-progression; mensagem: advance-delivery-v1.
- Contrato e identidade determinística permanecem os da 7.1. Datas são ISO UTC;
  a mensagem é uma expectativa, não autorização de alteração.
- Uma publicação por vez. add é aguardado; só depois há log de confirmação.
  O total final conta submissões confirmadas, **não novas identidades únicas**:
  reenviar uma identidade ainda retida pode retornar o job existente.
- Erro de publicação interrompe a varredura, fecha conexões e resulta em saída
  não zero, sem log de conclusão. Ready tem limite 5 s, connect timeout 3 s e
  comandos do produtor 5 s, offline queue desabilitada e sem reconexão automática
  do produtor. Isso não torna uma falha de rede prova de ausência de publicação.
- Em resposta desconhecida, parar e consultar a mesma identidade, sem trocar ID
  ou repetir toda a publicação automaticamente. Pode haver confirmações parciais;
  publicação confiável entre bancos diferentes será aprofundada na 7.3.

O worker valida nome e payload e reutiliza a função da 7.1 uma única vez:

| Condição | Tratamento |
| --- | --- |
| applied | Completed, transição persistida; retorno mínimo, não DTO completo. |
| ignored | Completed sem retry: ausente, obsoleta ou expectativa não atendida. |
| Payload/nome/versão inválidos | INVALID_DELIVERY_JOB, UnrecoverableError, terminal. |
| Prisma P1001/P1017 tipados | DATABASE_UNAVAILABLE, retry limitado. |
| Prisma P1002/P1008/P2024 tipados | DATABASE_TIMEOUT, retry limitado. |
| Prisma P2034 tipado | DATABASE_RETRYABLE_CONFLICT, retry limitado. |
| Demais erros/conflitos inesperados | UNEXPECTED_DELIVERY_JOB_ERROR, terminal para investigação. |

Classificação por instanceof/código estruturado, nunca texto de erro. Erros
Prisma P2028 ou objetos genéricos com code=P1001 não são presumidos transitórios.
Os erros originais ficam em cause não enumerável para uso interno; para BullMQ
são lançados erros com mensagem/stack sanitizadas contendo apenas código seguro.
O terminal herda UnrecoverableError. Assim failedReason/stacktrace não guardam
SQL, parâmetros, URL, dados pessoais ou mensagens brutas do Prisma.

## Tentativas, retenção e encerramento

**3 tentativas totais**: primeira execução + até 2 retries. Backoff exponencial
base 1 s: espera inicial de 1 s, depois 2 s. Falha terminal não espera essas novas
tentativas. maxStartedAttempts=3 limita entradas do processor; stalled tem limite
1 da configuração do worker, sem promessa de exatamente uma vez. Quedas e casos
de publicação/ack serão aprofundados na 7.3, preservando o lock do PostgreSQL.

Concluídos: até 1 dia/1.000 jobs. Falhos: até 7 dias/500 jobs; esgotamento permanece
failed. Limpeza por idade/contagem é lazy, ao finalizar outros jobs, não um timer
de exclusão pontual. Stream de eventos limitado aproximadamente a 1.000 entradas.
Backlog ainda pode crescer até os limites do Redis; noeviction não é capacidade
infinita. Remover/expirar um job libera sua identidade para futura publicação;
a retenção não é um registro eterno de falhas terminais ou de idempotência.
Não remover failed como atalho de retry: investigar antes de nova publicação.

SIGINT/SIGTERM: worker.close interrompe novos recebimentos e aguarda o ativo;
Redis e Prisma são fechados, com prazo total normal **15 s**. Se excedido, tenta
liberar conexões por até mais **1 s**, registra WORKER_SHUTDOWN_INCOMPLETE e sai
não zero. Não afirma cancelar ou reverter uma operação cujo resultado é incerto.
Publisher interrompe novas publicações ao receber sinal e impõe prazo de parada
15 s, registrando QUEUE_SHUTDOWN_INCOMPLETE e saindo não zero se necessário.
Reconexão do consumidor Redis não equivale a retry de operação de negócio.

## Logs e investigação manual

Eventos JSON no logger compartilhado: delivery.job.published,
delivery.publication.completed, delivery.job.completed, delivery.job.failed,
delivery.queue.failed, delivery.worker.started/stopped. Contexto selecionado:
jobId somente no formato hash da 7.1, jobOutcome applied/ignored, attempt/count e
códigos permitidos. Tentativa transitória final é error, intermediárias warn;
resultados são info. Erros de infraestrutura usam QUEUE_UNAVAILABLE ou
QUEUE_PUBLICATION_FAILED. Sem payload, usuário, cookie, senha, stack ou SQL nos
logs; não há novas métricas/traces de fila fictícios nem arquivos de log abertos.

Investigar sem executar retry:

1. Executar queue:deliveries:status com a mesma URL/prefixo; observar waiting,
   active, delayed, completed e failed. IDs desconhecidos e failedReason fora
   da allowlist são omitidos/sanitizados. Nenhum payload é impresso.
2. Buscar o jobId nos logs e conferir código e número da tentativa. O comando
   de status mostra apenas falhas recentes, com código seguro e tentativas.
3. Se necessário, consultar o job pelo ID em um script local usando
   createDeliveryQueue(config).getJob(id), com finally queue.close(); verificar
   getState e comparar IDs/expectativas com PostgreSQL por leitura autorizada.
   Não despejar data, stack ou erro bruto em logs compartilhados.
4. Payload inválido/conflito desconhecido exige investigação/correção do produtor
   ou ambiente; não há retry automático. Rede com resultado incerto exige
   reconciliação por leitura da mesma identidade e do histórico.

## Validação observada

TypeScript/build aprovados; **20/20** testes da 7.1, **9/9** unitários 7.2,
**7/7** integração Redis/PostgreSQL e **20/20** regressão logging: **56 aprovados**.
Os testes usam polling condicional de estado (watchdog 12 s), sem simular sucesso
ou pular o backoff: uma falha transitória executou 2 vezes e concluiu (~1,07 s);
falha persistente executou 3 vezes e permaneceu failed (~3,07 s). O helper relê
metadados após confirmar estado terminal, evitando observar attemptsMade antigo.

Integração usa exclusivamente Redis localhost:6381/15 com prefixos aleatórios
delivery-test-<uuid>; obriga AOF/noeviction. A fixture usa marketplace_dev:5433
como marketplace_dev, com guarda explícita de URL. IDs 97200000-...-000001 até
000008 e e-mails delivery-queue-{customer,seller}@local.invalid. Cria 2 users,
customer, seller, Order/SellerOrder mínimos, delivery SEPARATED e histórico antigo.
Publica só esse contrato, sem descoberta global: worker real aplica PROCESSING,
um histórico adicional, total 2; depois encerra o worker e remove somente esse
grafo em transação com checagem de vínculos. IDs preexistentes bloqueiam preparo.
Nenhum checkout/pagamento é simulado; fixture operacional isolada, não compra real.

Prefixos de teste removidos somente por queue.obliterate da fila própria depois
de fechar workers, nunca flush. Fechamento Redis conferido; fixtures ausentes
após teste. Integração Redis é comando explícito, não inicia containers via
scripts/test:all. test:all ganhou só a suíte unitária, sem depender de Redis.

```powershell
# Com Redis dedicado e PostgreSQL local disponíveis, em nodejs-backend:
npx.cmd tsc --noEmit
npm.cmd run build
npm.cmd run test:delivery-progression
npm.cmd run test:delivery-queue
npm.cmd run test:delivery-queue:integration
npm.cmd run test:logging
```

Smoke adicional: CLI worker em prefixo isolado vazio iniciou e encerrou por
SIGINT com delivery.worker.stopped; status mostrou zero jobs. CLI com porta local
Redis indisponível saiu com código 1 e somente códigos seguros, sem conclusão.
Namespaces do smoke também removidos especificamente. Redis DB 0 e DB 15 tinham
zero chaves ao final; fixture com users/Order/Delivery/histórico ausentes por leitura.
Redis observou ~9,3 MiB de RAM/192 MiB e 300 KiB alocados em /data, incluindo
histórico AOF de comandos removidos; não é benchmark nem overhead universal.

Worker, clientes e Redis iniciados para testes encerrados; volume próprio
preservado e PostgreSQL preexistente mantido ativo. Não iniciado HTTP, stack de
observabilidade, escala, gerador, carga, purge ou gateway. Schema/migrations,
contrato v1 e regras de delivery preservados. Não há publicação transacional
PostgreSQL+Redis, nem prova de resistência a todas as interrupções: **7.3 é a próxima**.

Referências: [conexões](https://docs.bullmq.io/guide/connections),
[retries](https://docs.bullmq.io/guide/retrying-failing-jobs),
[terminais](https://docs.bullmq.io/patterns/stop-retrying-jobs) e
[shutdown](https://docs.bullmq.io/guide/workers/graceful-shutdown).

## Recuperação validada na 7.3

A seção de validação acima registra a execução histórica da 7.2. Em 08/11/2026,
a 7.3 aprovou typecheck/build, 20 testes de progressão, 11 unitários da fila,
7 de integração da fila e 5 de recuperação: **43/43**. Não foi repetida carga
nem descoberta global sobre deliveries existentes.

### Por que não adicionar outbox agora

A descoberta consulta estado e histórico persistidos, sem marcar uma delivery
como publicada. Uma publicação ausente não remove sua elegibilidade: uma nova
execução explícita do publisher pode reencontrá-la. A identidade determinística
deduplica enquanto retida no Redis; a garantia contra efeitos duplicados fica
no PostgreSQL, independentemente da identidade ou retenção da fila.

O consumidor bloqueia e relê a linha, confere status, último histórico esperado
e cutoff temporal, e persiste transição/histórico na mesma transação. Depois de
um commit, uma mensagem baseada no histórico anterior resulta em ignored.
Cada mensagem aplica no máximo uma transição; a próxima exige novo histórico
e nova espera de 4/24 horas. Não há promessa de exatamente uma vez.

Outbox deve ser reavaliada se surgir publicação obrigatória vinculada a uma
transação cujo evento/intenção não possa ser reconstruído pela consulta atual.
Nesse caso, persistir a intenção na mesma transação permitiria publicá-la depois.
Nenhuma tabela operacional ou migration foi necessária neste fluxo.

### Procedimento operacional

Usar a configuração explícita do banco, Redis e prefixo do ambiente pretendido
descrita acima. Primeiro, apenas leitura:

```powershell
npm.cmd run queue:deliveries:status
npm.cmd run queue:deliveries:status -- --job <delivery-progression-v1-hash>
```

O segundo comando exige o ID completo (`delivery-progression-v1-` + 64 caracteres
hexadecimais minúsculos). Retorna missing ou estado, tentativas e outcome/código
seguro quando disponíveis; nunca payload, stack ou erro bruto. `--job` sem
`--status` é recusado, impedindo descoberta acidental nessa forma de inspeção.

1. Consultar waiting/active/delayed/completed/failed e localizar a mesma identidade
   registrada em delivery.job.published ou delivery.queue.failed. Falha de add
   registra QUEUE_PUBLICATION_FAILED e jobId antes de propagar o erro original.
   Ausência de confirmação não prova que Redis deixou de receber o job.
2. Comparar por leitura autorizada do PostgreSQL o status e o último histórico
   (changedAt DESC, id DESC) com a expectativa da mensagem conhecida. Não imprimir
   DTOs completos ou dados pessoais. Se estiver active, considerar resultado
   desconhecido e aguardar/investigar antes de decidir por nova ação.
3. Se a publicação estiver ausente e a delivery continuar elegível, reexecutar
   explicitamente `npm.cmd run job:deliveries:publish`. Esse comando faz descoberta
   sobre o banco configurado inteiro; não é uma operação de leitura nem teste.
   A 7.3 dependia dessa execução manual; a 7.4 permite novas descobertas quando
   scheduler e worker de descoberta forem explicitamente habilitados.
4. Um completed retido também pode conter ignored; conferir outcome e PostgreSQL.
   Um failed retido não é reativado por nova publicação da mesma identidade.
   Investigar código, tentativas, causa operacional e estado persistido antes de
   decidir por retry manual. Não remover failed como atalho, nem trocar identidade
   para contornar uma falha. Não há comando de retry automático nesta etapa.

Recuperação de publicação e retry de falha terminal são decisões diferentes.
Redis/AOF não é fonte de verdade de delivery. Após perda de dados do Redis,
somente trabalho reconstruível pelo estado/histórico PostgreSQL pode ser
redescoberto. Isso exige banco, fila e publisher disponíveis. Retenção pode
impedir nova inclusão de completed/failed; expiração não elimina a proteção
transacional do consumidor. Rediscovery não recupera eventos que já não sejam
reconstruíveis pela consulta atual.

### Evidência dos cenários reais

| Cenário | Evidência observada |
| --- | --- |
| Publicação parcial | Primeira inclusão confirmada, segunda falha antes de add; redescoberta encontra ambas, com dois jobs únicos e duas transições. |
| Resposta de publicação perdida | Redis recebe add, produtor perde a confirmação; redescoberta mantém uma identidade e uma transição. |
| Dois workers / identidades diferentes | Barreira libera duas mensagens equivalentes; uma aplicada, outra ignored, somente um novo histórico. Remover apenas o job concluído de teste e republicar a mensagem antiga também resulta em ignored. |
| Commit antes de ack | Processo filho persiste transição; leitura independente confirma PROCESSING/histórico novo enquanto Redis ainda está active. SIGKILL encerra esse filho; lease expira, evento stalled e reentrega reais ocorrem, com ignored e dois inícios do processor. Estado/histórico permanecem iguais. |
| Falha antes do histórico | Hook de teste existente lança dentro da transação, depois da atualização; rollback preserva inclusive updatedAt. Failed retido não reinicia por redescoberta. Após remover a falha, decisão manual explícita de retry do mesmo job aplica uma transição. |

```powershell
# Redis dedicado e PostgreSQL de desenvolvimento disponíveis, build atualizado:
npm.cmd run test:delivery-progression
npm.cmd run test:delivery-queue
npm.cmd run test:delivery-queue:integration
npm.cmd run test:delivery-recovery
```

Recuperação usa somente Redis localhost:6381/15, prefixo aleatório
delivery-recovery-test-<uuid> e banco marketplace_dev:5433/usuário marketplace_dev.
A guarda verifica URL e identidade real do banco antes do preparo. Fixture
97300000-...: dois users (001/002), customer/seller (003/004), até duas Orders
(100/110), SellerOrders (101/111), deliveries (102/112) e históricos (103/113).
E-mails delivery-recovery-{customer,seller}@local.invalid; IDs preexistentes
bloqueiam preparo. A descoberta usa a função real da 7.1 com consulta restrita
a essas deliveries. Não é executado job global ou compra/pagamento simulado.

O processo filho, barreiras e falhas ficam exclusivamente em tests/helpers.
Somente o worker de teste usa lockDuration 1.500 ms, lockRenewTime 500 ms e
stalledInterval 500 ms para observar lease/reentrega sem uma espera longa;
configuração de produção permanece intacta. Falhas desconhecidas continuam
terminais; o retry manual descrito é decisão controlada do teste de rollback.

Cleanup confere vínculos e remove apenas o grafo criado em transação. Workers e
filho encerram antes da remoção da fila de prefixo próprio, sem flush. Leitura
final confirmou zero users/Orders/deliveries/históricos da fixture e DB 15 vazio.
O CLI individual também retornou missing para uma identidade inexistente.
Redis e PostgreSQL iniciados nesta validação foram encerrados, volumes preservados.
Não há novo fault switch operacional, DLQ, painel ou expansão para a 7.4.

## Descoberta periódica — 7.4

Fluxo: Job Scheduler BullMQ → fila **delivery-discovery** → worker de descoberta
→ descoberta paginada da 7.1 → publicação sequencial → fila **delivery-progression**
→ worker de progressão → service/repository/PostgreSQL. O HTTP não inicia nenhum
agendamento ou consumidor. Não foi instalado cron ou outro serviço de fila.

O contrato de descoberta contém somente `{ "version": 1 }`; campos adicionais,
versão ou nome de job desconhecidos são recusados. Não aceita consultas ou IDs
enviados na mensagem. A consulta operacional continua sendo a descoberta do
domínio; dependências restritas às fixtures são injetadas somente nos testes.

### Operação explícita

Com build pronto e as variáveis de banco/Redis/prefixo da seção inicial:

```powershell
# Registrar ou atualizar: mesma identidade delivery-discovery-v1, sem duplicar.
$env:DELIVERY_DISCOVERY_INTERVAL_MS='300000'
npm.cmd run schedule:deliveries:configure
npm.cmd run schedule:deliveries:status

# Terminais independentes; nenhum deles registra o scheduler ao iniciar:
npm.cmd run worker:deliveries:discovery
npm.cmd run worker:deliveries

# Impedir novas ocorrências futuras:
npm.cmd run schedule:deliveries:remove
```

Intervalo padrão **cinco minutos**, mínimo **um minuto**, máximo **24 horas**,
inteiro em milissegundos. NODE_ENV=test não reduz esse mínimo operacional.
O primeiro job do Job Scheduler pode ficar disponível imediatamente ao registrar;
não assumir espera inicial de cinco minutos. Status mostra apenas identidade,
intervalo, próximo instante informado pelo Redis, concorrência global e contagens.

O worker de descoberta estabelece `setGlobalConcurrency(1)` antes de consumir.
Esse limite reside no Redis da fila/prefixo e vale também com dois processos,
além da concorrência local 1. Usar o mesmo prefixo entre as instâncias pretendidas;
prefixos diferentes são ambientes independentes. Não executar o publisher manual
simultaneamente à descoberta recorrente no uso normal: ele não consome essa fila.
O limite BullMQ não elimina as possibilidades de reentrega após perda de lease;
a proteção final contra efeitos duplicados continua transacional no PostgreSQL.

Job Schedulers produzem a próxima ocorrência quando a anterior começa a ser
processada. Sem consumidores, não são materializados todos os intervalos perdidos.
Se a descoberta demorar mais que o intervalo, a próxima aguarda capacidade; não há
promessa de horário exato ou compensação de cada tick. Não há laço para recriar
ocorrências perdidas. Falha de publicação parcial mantém elegibilidade no banco;
uma ocorrência posterior redescobre candidatos e usa as mesmas identidades.
Jobs de progressão failed retidos continuam exigindo investigação, nunca retry
automático por este agendador.

### Falhas, retenção e encerramento

Descoberta reutiliza três tentativas totais, backoff 1 s/2 s, retenções limitadas
e classificação segura da 7.2: somente erros Prisma tipados reconhecidos como
transitórios recebem retry; erros desconhecidos de publicação são terminais
nessa ocorrência, sem presumir ausência de publicação. Uma futura ocorrência
agendada não equivale a reativar esse failed. Reconexão do consumidor Redis é
comportamento de transporte e não confirmação de publicação ou retry de negócio.

Logs JSON: delivery.discovery.configured/removed, started/completed, failed e
stopped. Completed informa `count`: submissões confirmadas, **não jobs novos**,
pois identidades retidas podem deduplicar. Códigos/attempt seguem a allowlist,
sem payload, URL, credencial, stack ou exceção bruta. Um shutdown incompleto usa
WORKER_SHUTDOWN_INCOMPLETE; o processo não declara sucesso de encerramento.

Ctrl+C/SIGTERM para o consumidor impede novos recebimentos e aguarda o ativo,
com prazo de 15 s e liberação adicional limitada da política existente. Filas
produtoras e Prisma são fechados; falha de fechamento resulta em saída não zero.
Parar o worker **não remove** o scheduler: ele pode manter uma ocorrência pendente.
Remover o scheduler impede recorrências futuras e deixa o BullMQ remover sua
próxima ocorrência agendada conforme a API; não cancela o job ativo nem apaga
jobs individuais já publicados. Uma ocorrência já disponível em waiting também
pode permanecer: o smoke do CLI confirmou waiting=1 após scheduler=null. Ela
ainda pode ser consumida; remover agendamento não é cancelamento desse trabalho.
Não há cancelamento global ou cleanup automático.

Testes sem banco: `npm.cmd run test:delivery-discovery`. Integração explícita com
Redis dedicado e PostgreSQL dev: `npm.cmd run test:delivery-discovery:integration`.
Reutiliza as guardas e o grafo restrito 97300000 da 7.3, prefixos aleatórios
discovery-test-<uuid>, Redis DB 15; não executar em paralelo com a recuperação,
pois ambas usam os mesmos IDs fixos e recusam fixture preexistente. Cleanup remove
o scheduler próprio, encerra workers, apaga só as duas filas desse prefixo e o
grafo da fixture. Não há descoberta recorrente global nos testes.

Referências oficiais: [Job Schedulers](https://docs.bullmq.io/guide/job-schedulers/)
e [concorrência global](https://docs.bullmq.io/guide/queues/global-concurrency).

Validação em 08/11/2026: typecheck/build, 6/6 unitários de descoberta, 5/5 de
integração, progressão 20/20, fila 11/11, integração da fila 7/7, recuperação 5/5
e logging 20/20: **74/74 aprovados**. Logging inicialmente recebeu EACCES de
loopback no sandbox; a execução com acesso local permitido passou integralmente.
Integração 7.4 repetida após os ajustes finais: 5/5, aproximadamente 6 segundos
na última rodada, sem constituir benchmark. CLI configure/status/remove/status
testado sem consumidor em prefixo exclusivo, removido ao final. Nenhum scheduler
operacional foi habilitado e nenhuma descoberta global foi executada.

Amostra local anterior às integrações: Redis 8,3 MiB/192 MiB, PostgreSQL 35,6 MiB
e Windows com aproximadamente 529 MiB livres. São fotografias de containers/host
compartilhados, não pico, orçamento garantido ou custo isolado da descoberta.
Não foi executado teste de carga nem iniciada a stack de observabilidade.
