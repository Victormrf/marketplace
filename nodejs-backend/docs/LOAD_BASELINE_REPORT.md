# Primeira baseline local — escopo mínimo concluído

## Fechamento em 26/10/2026, horário de São Paulo

Quatro experimentos reais executados uma única vez em `marketplace_scale`, com API compilada exclusiva 8051 e Node HTTP. Autorização direta do responsável substituiu o piso de RAM por monitoramento sem mínimo exclusivamente neste modo; CPU sustentada 85%/15 s, armazenamento, timeout 10 s, teto 60 s e ausência de retries foram preservados. Nenhum cenário adicional, k6, Next ou job executado.

Base Git `3d643ba`, com alterações locais preexistentes; Node v24.21.0, npm 11.19.0. Os timestamps dos artefatos são UTC em 27/10/2026 01:05–01:08, equivalentes a 26/10/2026 22:05–22:08 no host local. Não houve instalação de dependências.

| Experimento                            | Concluídas |  Janela HTTP | Latência mínima / mediana / máxima | Requests/s | Resultado                                      |
| -------------------------------------- | ---------: | -----------: | ---------------------------------- | ---------: | ---------------------------------------------- |
| Produto popular                        |   5/5 GETs | 4.138,006 ms | 10,540 / 12,240 / 83,119 ms        |      1,208 | Cinco respostas iguais ao oráculo SQL          |
| Dashboard seller high, somente summary |   5/5 GETs | 4.128,134 ms | 10,740 / 11,789 / 67,947 ms        |      1,211 | Cinco respostas iguais ao oráculo SQL          |
| Checkout compartilhado                 |  2/2 POSTs |   112,614 ms | Mediana 110,933 ms                 |     17,760 | Uma criação e um 409 por estoque insuficiente  |
| Idempotência                           |  2/2 POSTs |    97,624 ms | Mediana 94,187 ms                  |     20,487 | Uma criação e um replay integralmente idêntico |

Latências individuais de produto: 83,119; 16,237; 12,240; 11,087; 10,540 ms. Summary: 67,947; 23,485; 11,789; 10,740; 10,756 ms. As leituras incluem quatro pausas de 1 s na janela e nenhum GET de aquecimento. A medição inclui consumo/validação JSON. Throughput não representa capacidade máxima; com duas/cinco amostras não se tiram conclusões de percentis de cauda. Erros técnicos, respostas desconhecidas e operações interrompidas: zero em todos os experimentos.

### Preparação, coleta e recursos separados

| Experimento   | Preparo executor | Verificação SQL | Amostras | RAM mínima disponível | Máximo da coleta periódica |
| ------------- | ---------------: | --------------: | -------: | --------------------: | -------------------------: |
| Produto       |         7.604 ms |          803 ms |       42 |             4,410 GiB |                   1,209 ms |
| Summary       |         7.551 ms |          765 ms |       42 |             4,318 GiB |                   1,435 ms |
| Compartilhado |        11.725 ms |          445 ms |        2 |             4,013 GiB |                   0,869 ms |
| Idempotência  |        11.481 ms |          500 ms |        1 |             4,434 GiB |                   0,778 ms |

Esses preparos são os registrados pelos executores; descoberta de sessões, criação e recuperação explícitas das fixtures são etapas adicionais, fora da janela. Medições detalhadas de armazenamento custaram 3,027–3,601 s antes/depois, fora da janela HTTP. Em comparação com a coleta antiga de 7,38 s, a coleta periódica atual não executa subprocessos ou SQL e custa no máximo 1,435 ms nesta entrega; a coleta detalhada permanece separada e mais cara.

RAM antes dos serviços: 4.946.526.208 bytes; após PG: 4.725.653.504. Deltas incluem outros processos do host e não provam consumo exclusivo dos nossos serviços. Pico de CPU do host no produto: 98,58%, sustentado acima de 85% por somente 100 ms; summary: 82,72%; compartilhado: uma amostra de intervalo de 49,51%; idempotência: nenhum intervalo, CPU null. Não houve violação da guarda sustentada, mas as janelas curtas não comprovam picos de processos nem histórico de consultas lentas. Não atribuir CPU zero nem desempenho de produção.

### Integridade e recuperação realmente executadas

- Antes e depois das leituras: mesmas assinaturas SHA-256 das 22 tabelas e 18 invariantes aprovadas.
- Compartilhado: dois customers, um produto/uma unidade, duas requisições sobrepostas (`peakInFlight=2`); um pedido, uma reserva ACTIVE de quantidade 1, um movimento RESERVATION de delta 1 e uma chave COMPLETED. O conflito foi validado pelo motivo exato, não só pelo 409.
- Idempotência: uma identidade/chave/payload, `peakInFlight=2`; um pedido/chave/reserva/movimento, criação e replay. Comparação integral em memória passou; nenhum body foi persistido.
- Após cada escrita: reconciliação explícita, API própria encerrada e recuperação transacional somente do grafo experimental. Ambas retornaram `RECOVERED`, `baselineIntact=true` e os mesmos 30.349 registros nas 22 tabelas, com 18 invariantes. Ausência das fixtures validada pelo mecanismo de recuperação. Sem purge da fase 4, ajuste fictício de saldo ou alterações históricas.
- O manifesto operacional e os tickets permanecem para auditoria e bloqueio de repetição; não fazem parte do dataset de negócio. O controle do gerador small permanece `completed`, sem nova geração.

### Armazenamento e término

Banco antes: 24.321.047 bytes; após recuperação: 24.542.231 bytes. PGDATA: 81.399.808 → 81.620.992 bytes, incluindo WAL de 33.562.624 bytes. Crescimento físico residual de índices/páginas/metadados não significa fixture remanescente. Espaço livre Windows C: aproximadamente 58,86 GiB ao final. Margens e orçamento 5/10 GiB respeitados.

Volume `marketplace_scale_data`, container `marketplace-scale-postgres`, PGDATA `/var/lib/postgresql/data/pgdata`. VHDX compartilhado `C:\Users\Principal\AppData\Local\Docker\wsl\disk\docker_data.vhdx`, comprimento lógico 20.805.844.992 bytes; não é ocupação exclusiva do banco e não diminui necessariamente ao recuperar registros. Nenhum volume removido ou compactação executada. API e container de escala próprios encerrados ao final; serviços preexistentes preservados.

Artefatos agregados ignorados em `load/results`, sem cookies/tokens/bodies por request:

- `product-minimal-8a46e0da-3be4-402f-a86a-5a5022c41aa3-run.json`.
- `dashboard-minimal-020eb10b-2938-4ada-8219-5f0dfcc0ced8-run.json`.
- `write-259f048e-97c3-4d9f-a0ec-3e7706c06062.json`.
- `write-74d3bdc1-972a-43c3-a17c-02a06e89b925.json`.
- `minimal-idempotency-recovery.json` e `minimal-final-scale-status.json`.

Validações desta entrega: 28 testes puros aprovados (baseline 18, reference 3, mínimo 7), typecheck e build. Os três testes dedicados PostgreSQL já aprovados na entrega anterior continuam como evidência de recuperação/falha parcial; não foram repetidos para fabricar medições. Falha inicial de teste por política antiga foi corrigida usando um piso explícito nos testes da guarda. K6 inspect inicialmente falhou por `SSLKEYLOGFILE` herdado do ambiente; a reprodução estática passou removendo essa variável somente do processo de teste, sem mudança global. Nenhum erro desses foi uma rodada HTTP real.

**5.2 concluída no escopo mínimo aprovado**, perfil suspenso e tickets consumidos. A matriz extensa anterior é opcional e não foi executada. Próxima etapa 5.3: análise curta e limitações, sem alegação de teste de estresse/capacidade. Desenvolvimento, E2E, produção, schema e migrations intocados.

## Histórico abaixo — bloqueios anteriores superados

## Entrega mínima de 26/10/2026 — validação dedicada concluída, escala bloqueada

A execução foi repartida: **build/testes sem banco → testes PostgreSQL dedicados → tentativa de iniciar escala**. Não houve build, k6 ou regressões paralelos aos experimentos HTTP. Nenhuma instalação/download.

A referência mínima usa **Node HTTP nativo**, não k6: leituras1 usuário/5 GETs seriais, pausa de 1 s; dois checkouts coordenados sem pausa. Teto de 60 s e timeout de 10 s, sem retries. O piso emergencial **512 MiB antes/durante** foi explicitamente autorizado no pedido e confirmado diretamente no chat. Não é garantia de segurança nem autorização para reduzi-lo novamente. Quotas20 GETs/2 VUs e guardas1,25/1 GiB foram substituídas apenas neste modo.

### Atividades e resultados reais

| Atividade                          | Implementada/testada                  | Executada realmente             | Resultado/bloqueio                                                          |
| ---------------------------------- | ------------------------------------- | ------------------------------- | --------------------------------------------------------------------------- |
| Build e typecheck                  | Sim                                   | Sim, antes dos serviços         | Aprovados                                                                   |
| Testes sem banco                   | Sim                                   | Sim                             | 53 cenários aprovados                                                       |
| Preparação dedicada                | Sim                                   | Sim, marketplace_load_test:5436 | Baseline já aplicada, nenhum migrate/reset de outro banco                   |
| Checkout compartilhado dedicado    | Sim                                   | Sim, API 8052                   | 2 requests sobrepostas, 1 pedido, 1 conflito de estoque,1 reserva/movimento |
| Idempotência dedicada              | Sim                                   | Sim, API 8052                   | 2 requests sobrepostas, 1 criação + 1 replay,1 pedido/chave/reserva         |
| Falha parcial/recuperação dedicada | Sim                                   | Sim                             | Commit parcial ficou UNKNOWN, recuperação explícita preservou baseline      |
| Produto popular em escala          | Implementado; helpers testados        | **Não**                         | Guarda antes do PostgreSQL                                                  |
| Dashboard summary em escala        | Implementado; helpers testados        | **Não**                         | Mesma fase de escala bloqueada; sem nova tentativa                          |
| Checkout compartilhado em escala   | Fixture/executor testados no dedicado | **Não**                         | Nenhuma preparação em escala                                                |
| Idempotência em escala             | Fixture/executor testados no dedicado | **Não**                         | Nenhuma preparação em escala                                                |

Os três PostgreSQL antes pendentes **estão concluídos**. Não são resultados de carga no small e não substituem os quatro experimentos reais requeridos para fechamento.

### Memória por fase

| Ambiente/fase                        |                        Disponível | Observação                                           |
| ------------------------------------ | --------------------------------: | ---------------------------------------------------- |
| Dedicado: processos próprios parados |  1.118.924.800 bytes (1067,1 MiB) | Antes de iniciar seu PostgreSQL                      |
| Dedicado: após PostgreSQL            |   1.035.145.216 bytes (987,2 MiB) | Banco exclusivo, sem escala                          |
| Dedicado: após API do compartilhado  |     872.521.728 bytes (832,1 MiB) | API compilada8052                                    |
| Dedicado: após API da idempotência   |     890.863.616 bytes (849,6 MiB) | Processo anterior encerrado                          |
| Escala: processos próprios parados   | **513.331.200 bytes (489,6 MiB)** | **Abaixo536.870.912; bloqueado antes do PostgreSQL** |
| Escala: após PostgreSQL/API          |                        Não medido | Não foram iniciados                                  |

A limitação ocorreu **na fase inicial do host**, sem API/k6/PostgreSQL de escala próprios ligados. Nenhum processo próprio foi deixado desnecessariamente ativo. Não há motivo para tratar isso como custo do k6, que não foi iniciado durante essas execuções. Deltas entre fases incluem atividades concorrentes da máquina; não atribuí-los exclusivamente a um processo.

Intervenção humana necessária: disponibilizar RAM no host suficiente para manter ** >=512 MiB após iniciar PostgreSQL e API**, com margem para variabilidade. Pode reduzir voluntariamente consumo dos aplicativos que escolher ou disponibilizar outro host. Não foi encerrado aplicativo/serviço preexistente nem alterado Docker, pagefile ou durabilidade. Não repetir automaticamente a fase bloqueada.

### Supervisão proporcional — evidência dedicada

Novo coletor usa memória/CPU do host e espaço livre real Windows a 100 ms, sem subprocessos Docker/PowerShell ou SQL por request e sem sobreposição. Timestamps limitados e custo das amostras persistidos; CPU sustentada 85%/15 s, duração e orçamento5/10 GiB preservados. Detalhes de armazenamento ficam fora da janela HTTP.

| Teste dedicado | Preparo executor | Janela HTTP | Verificação SQL | Amostras | Máximo periódico |
| -------------- | ---------------: | ----------: | --------------: | -------: | ---------------: |
| Compartilhado  |     9.727,058 ms |  105,536 ms |      238,942 ms |        2 |         0,791 ms |
| Idempotência   |     9.135,168 ms |   83,890 ms |      231,006 ms |        1 |         0,543 ms |

Medições detalhadas antes/depois custaram 2,717–2,812 s, **fora** das janelas acima. Não são throughput/latência de referência de escala. Uma ou duas amostras não sustentam picos nem atribuição de CPU/queries; no teste idempotente não houve intervalo CPU. O zero inicial desse agregado antigo não significa CPU medida: o coletor foi ajustado para null quando não há intervalo.

Memória mínima amostrada no compartilhado 912.441.344 bytes (870,2 MiB); na idempotência 883.937.280 (843,0 MiB). São amostras curtas, não mínimos contínuos. A memória por fase chegou abaixo disso antes da medição, como tabela anterior. Não há memória/CPU/latências de experimento **em escala** nesta entrega.

### Recuperação e integridade

Os três testes dedicados recuperaram explicitamente seus próprios grafos e compararam SHA-256 com a baseline inicial. Estado final **RECOVERED**,1 usuário sentinela histórico, 0 Orders e 0 reservas experimentais; container dedicado encerrado. Sem cleanup automático em falha, liberação artificial de saldo ou purge da 4.3.

IDs de evidência dedicada (agregados ignorados em load/results):

- Compartilhado: write-49aea68b-c9b5-4edb-9ba7-bb04a855625e.
- Idempotência: write-04d5b8d6-c374-43ec-85ec-617e3a1f3a05.
- Memória por fase: load/.local/minimal-memory-fixture-test.json e minimal-memory-scale.json.

Replay positivo confirmou o mesmo pedido e efeitos únicos. A comparação integral do body foi acrescentada ao executor e validada por teste simulado que rejeita divergência em campo não projetado; não foram refeitas execuções aprovadas para fabricar novas medições. Bodies/cookies/tokens não foram gravados.

PostgreSQL de escala permaneceu parado nesta entrega; sua identidade SQL, contagens e invariantes atuais não foram reconfirmadas. Nenhuma fixture de escala criada ou recuperação pendente nela. Nenhuma operação em desenvolvimento/E2E/produção, geração, medium/large, purge ou mudança estrutural.

### Validações finais e estado

- test:load-minimal 6/6; test:load-reference 3/3 puros + 3/3 PostgreSQL; test:load-baseline 18/18; test:load-plan 8/8; test:load-writes 11/11; test:load-write-executor 5/5; test:load-resources 2/2. **53 sem banco + 3 PostgreSQL =56 cenários únicos aprovados**; repetições de regressão não aumentam essa contagem.
- npx.cmd tsc --noEmit e npm.cmd run build aprovados, antes do banco dedicado. Formatação/diff check.
- K6 inspect foi apenas teste estático antes dos serviços, não executor das rodadas. Leituras futuras Node registrarão cinco latências individuais, min/mediana/max e duração; não misturar com p95/p99/throughput k6 históricos.
- Perfil suspenso: reducedBaseline.enabled=false; executionStatus=dedicated-validation-completed-scale-blocked-before-postgres-512MiB.
- **5.2 parcial por ambiente**. Falta somente buscar os quatro resultados reais em escala e recuperar seus grafos. Preparação e testes dedicados não ficam pendentes por causa do executor. Retomada requer resolver a margem do host, não outro replanejamento ou aumento/redução de carga.

## Histórico anterior — mantido apenas para rastreabilidade

O conteúdo abaixo registra handoffs passados. Estados de fixtures/testes pendentes e quotas antigas foram substituídos pelas evidências e limites atuais acima.

## Replanejamento vigente — 26/10/2026: quatro experimentos, fechamento parcial ambiental

A matriz de 59 combinações foi **substituída**, não ficou pendente como requisito. O objetivo é referência pequena para cache/observabilidade/concorrência, não capacidade máxima. Estágios completos, catálogo extenso, carrinho, pagamento e checkout distribuído ficam opcionais. A 5.3 será análise curta de resultados, limitações e repetições após melhorias.

| Experimento obrigatório | Configuração                                                     | Resultado real desta entrega                                  |
| ----------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------- |
| Produto popular         | Um produto,2 VUs,20 GETs, pausa de 1 s                           | **Não executado**: guarda inicial de ambiente não satisfeita  |
| Dashboard summary       | Um seller high,2 VUs,20 GETs, pausa de 1 s                       | **Não executado**: sequência parada por limitação ambiental   |
| Checkout compartilhado  | 2 customers próprios,1 unidade,2 chamadas coordenadas sem pausa  | **Não executado**: ambiente bloqueado; nenhum grafo preparado |
| Idempotência            | Uma identidade, chave e payload,2 chamadas coordenadas sem pausa | **Não executado**: ambiente bloqueado; nenhum grafo preparado |

Teto **60 s/experimento**, timeout **10 s/request**, sem retry. Início **>=1,25 GiB com API/observador prontos**, interrupção **<1 GiB**. CPU sustentada e armazenamento 5/10 GiB/margens Windows preservados. Não houve redução silenciosa ou execução dos antigos estágios.

### Evidência do bloqueio, sem insistência

Na inspeção inicial havia 1,501 GiB; depois0,962 GiB e, no registro de bloqueio, **838.131.712 bytes =0,781 GiB**, abaixo dos1.342.177.280 bytes exigidos, **antes de iniciar API/observador**. O mínimo observado é fora de carga; não existe mínima durante experimentos. Nenhum processo de API/carga, container ou consulta SQL foi iniciado nesta entrega e nenhuma rodada foi repetida. Não foram encerrados aplicativos nem alteradas configurações globais.

Agregado limitado ignorado pelo Git: `load/results/reference-environment-2026-10-26.json`, timestampUTC `2026-10-26T05:22:02.905Z` (02:22:02 America/Sao_Paulo). Zero experimentos iniciados. Não há throughput, latências, erros HTTP ou recursos de uma janela medida para reportar. Nenhum aquecimento ocorreu.

`reducedBaseline.enabled=false` / executionStatus=blocked-before-start-memory impedem execução até decisão do responsável. O programa mantém os tickets individuais das leituras e, para checkouts futuros, consumo persistente próprio em scale_ops.reference_authorizations antes da escrita de negócio, na mesma transação do manifesto PREPARING. Não criar essa tabela ao iniciar API ou consultar status.

### Implementação preparada e validações efetivamente executadas

Selecionado somente um produto e summary de um seller; allowlist inclui variante/endpoint, quota20 GETs. Modo reference das fixtures limita cenários a checkout-shared/idempotency,2 chamadas e estoque compartilhado1. Chamadas coordenadas sem pausa; a mesma chave/payload permanece. Pós-condições verificam uma chave COMPLETED, reserva ACTIVE de quantidade1, um movimento RESERVATION de delta1 e saldo reservado1. Scripts opcionais conservam seus parâmetros e bloqueios.

| Comando                  | Resultado nesta entrega                  |
| ------------------------ | ---------------------------------------- |
| test:load-reference      | **3/3 puros**, sem banco                 |
| test:load-baseline       | **18/18**, inclui inspect estático do k6 |
| test:load-plan           | **8/8**                                  |
| test:load-writes         | **11/11**, HTTP simulado                 |
| test:load-write-executor | **5/5**, sem banco                       |
| test:load-resources      | **2/2**                                  |
| npx.cmd tsc --noEmit     | Aprovado                                 |
| npm.cmd run build        | Aprovado                                 |

Total **47 testes sem banco aprovados**. Os **3 novos testes PostgreSQL** do modo reference (dois HTTPs e falha parcial com recuperação) **não foram executados**, pois a memória impediu iniciar o ambiente. O opt-in TEST_REFERENCE_POSTGRES=yes usa exclusivamente marketplace_load_test:5436; comandos estão no plano. A evidência anterior de12/12 recuperação e 6/6 HTTP real pertence ao harness anterior e não equivale a validar a nova quota/ramificação SQL.

### Dados e estado da etapa

Nenhuma fixture criada ou removida nesta entrega; nenhuma recuperação a realizar. PostgreSQL de escala permaneceu parado, logo identidade SQL/contagens/invariantes **atuais não foram reconfirmadas**. O dataset histórico não foi alterado por este trabalho. Não reutilizar24 MB/30.349/18 invariantes da execução anterior como medidas atuais. Sem desenvolvimento/E2E/produção, geração, purge, medium/large ou mudanças de schema/migrations.

**5.2 em andamento/bloqueada por ambiente, não concluída.** Fechamento parcial apresentado para decisão do responsável. Retomada: validar os três testes dedicados e os recursos; executar apenas os quatro experimentos uma vez cada, sequencialmente, sem novo aceite entre sucessos. Parar em qualquer falha/ambiguidade. Após cada checkout bem-sucedido, recuperar explicitamente seu grafo e provar preservação histórica. Scripts opcionais não são requisito para encerrar. Não iniciar análise 5.3 como se existisse baseline reduzida executada.

## Evidências históricas anteriores — não são critérios atuais

Os resultados/pendências abaixo pertencem aos handoffs anteriores. Foram preservados para rastreabilidade e são substituídos, no fechamento, pelo escopo de quatro experimentos acima.

## Handoff posterior de 25/10/2026 — catálogo geral baixo interrompido

**Não é uma rodada aprovada.** Autorização única `5.2-catalog-all-low-2026-10-25` consumida; execução `catalog-all-low-67c8ed2c-07ad-4efb-b28b-7f361a7eac7d`, iniciada às **19:03:13 America/Sao_Paulo**. Commit-base `3d643ba2ebf86be33826edffbbdffd02019010fd`, com alterações locais. Não houve repetição, outras variantes, gradual ou escrita em escala.

| Item                                              | Resultado observado                                                                                                                |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Planejado                                         | 2 VUs, 40 GETs, pausa de 1 s, timeout de 10 s, teto de 90 s, sem retry                                                             |
| Pré-condições                                     | small completed, 30.349 registros, 18 invariantes verificadas por CLI; API compilada 8051                                          |
| RAM com API/observador prontos                    | 2.410.119.168 bytes = 2,245 GiB, acima de 2 GiB                                                                                    |
| RAM mínima amostrada                              | 2.121.732.096 bytes = 1,976 GiB; guarda interrompeu                                                                                |
| Requests/operações concluídos/interrompidos       | **Indeterminados**: k6 não deixou sumário após interrupção. Não tratar o 0 inicial do agregado bruto como zero requests executados |
| Throughput / p50 / p95 / p99 / taxa de erros HTTP | **Indisponíveis**, sem inventar valores a partir de outra rodada                                                                   |
| Aquecimento                                       | 1 GET, 5.641 ms, validado pelo oráculo, fora da medição                                                                            |
| Preparo registrado                                | 53.311 ms, separado do aquecimento/instalação que o compõem                                                                        |
| Observador                                        | Instalação 8.302 ms; detalhada antes 305,652 ms; 6 amostras gerais / 24 RAM; custo periódico máximo 184,281 ms                     |
| CPU                                               | Máximo amostrado 46,630%, abaixo de 85%; não houve intervalo amostrado acima do limiar                                             |
| Conexões / locks                                  | Até 4 conexões, zero esperas observadas                                                                                            |
| Banco / diretório PG / WAL                        | 24.321.047 / 81.399.808 / 33.562.624 bytes antes                                                                                   |
| Windows livre mínimo observado                    | 58.733.981.696 bytes; não é espaço livre da VM                                                                                     |
| Encerramento                                      | API e k6 encerrados; PostgreSQL próprio parado, volume preservado                                                                  |

**Limitações da cobertura:** houve intervalo de 22,429 s entre a amostra inicial e a primeira periódica. O campo windowWithMonitorMs registrou 5,916 s e não representa toda essa sequência. Não há dados para atribuir o intervalo nem para afirmar proteção contínua nele. O runner agora renova a amostra após trabalho de filesystem, registra custo de lançamento e distingue sumário ausente de zero operações. A medição interrompida não foi refeita para validar essas mudanças em escala.

O campo maxHighCpuDurationMs do agregado bruto desta primeira versão estava incorreto por aritmética com null. Foi corrigido/testado; **não usar o valor bruto como duração de CPU sustentada**. O máximo de CPU amostrado ficou abaixo de 85%, portanto nenhuma duração acima de 85% é sustentada pelas amostras. Não confundir esse erro de diagnóstico com a causa da interrupção, que foi RAM abaixo de 2 GiB.

### Reconciliação por leitura e integridade

Antes/depois: contagens 30.349 e **18 invariantes aprovadas**. Após encerrar a API, as 22 assinaturas foram comparadas com a última leitura aprovada (`dashboard-low-smoke-f21b8468-0dfc-4045-b44e-a52124d1a0c4`): todas iguais. **O hash pré-rodada foi calculado, mas a versão executada não o persistiu ao interromper**; não afirmar que o agregado contém essa comparação específica. O runner corrigido persiste o hash antecipadamente e reconcilia também em falhas.

`scale_ops.load_experiments` continua **ausente em escala**: nenhuma preparação ou DDL de fixtures foi executada ali. O agregado complementar `<id>-reconciliation.json` registra a referência usada, métricas desconhecidas e as 18 invariantes; o original foi preservado. Sem purge, regeneração, medium/large, alterações de schema/migrations ou acesso a desenvolvimento/E2E/produção.

### Infraestrutura de escrita concluída e testada fora de escala

- Controlador reconhece teste e escala por URL, usuário, porta, marcador SQL, container/volume e estado completed/small. Escala também compartilha o advisory lock 49314301 com a fase 4 e as leituras. A tabela de manifesto só é criada por preparação explícita.
- Escala permanece **administrativamente bloqueada** (`fixtures.writesEnabled=false`). Além de autorização posterior e habilitação consciente, exige confirmação do ambiente e aprovação específica `namespace:scenario:stage`. Cliente/testes não mudam essa configuração em disco.
- Executor inicia API compilada própria 8052/8051, prepara login e /users/me antes da janela, mantém cookies só em memória, usa transporte HTTP com destinos/caminhos fixos, timeout de 10 s, pausa de 1 s, barreira e pós-condições SQL. Supervisão termina antes das verificações persistidas, evitando bloquear o stream com Docker síncrono.
- Sucesso exige recuperação explícita: `effects.execution` bloqueia outro run; falha deixa UNKNOWN e não dispara cleanup. Recuperação transacional verifica grafo/FKs, hashes e invariantes históricas. Não libera reservas artificialmente nem usa purge da 4.3.
- **12/12 testes PostgreSQL dedicados aprovados**, com falha parcial, rollback, exclusão mútua, manifesto órfão, resposta perdida e proteção histórica.
- **6/6 testes com API HTTP real no banco marketplace_load_test:5436 aprovados**. Carrinho, checkout compartilhado/distinto, idempotência, pagamento e resposta perdida depois do checkout real. No compartilhado: 10 requests,2 participantes coordenados, 2 pedidos e 8 conflitos pelo motivo exato. Idempotência: requests sobrepostas, mesma chave/endereço e um pedido. Pagamento permaneceu CREATED/PENDING_PAYMENT e duplicata ativa foi rejeitada; nenhuma captura simulada.
- No teste de resposta perdida, a requisição chegou ao backend e o checkout commitou antes de sua entrega ser interrompida; leitura encontrou o mesmo pedido. Houve uma única chamada, sem replay/retry ou nova chave, seguida de recuperação explícita.
- Estado final do banco dedicado **RECOVERED**, somente usuário sentinela histórico, zero Orders/PaymentAttempts experimentais. As assinaturas históricas permaneceram iguais.

Falhas encontradas e corrigidas nos próprios testes: cast regclass→text; desempate temporal da reposição/reserva da fixture de pagamento; verificação síncrona de identidade Docker no pós-request, que deixava o stream parecer obsoleto. Cada grafo pendente foi reconciliado e recuperado explicitamente no banco dedicado antes de novo teste. Os insucessos e agregados anteriores não foram substituídos por sucesso fictício. Isso não repete nem autoriza carga real de escala.

### Validações finais deste handoff

| Comando                  | Resultado final                                  |
| ------------------------ | ------------------------------------------------ |
| test:load-plan           | 8/8                                              |
| test:load-baseline       | 18/18, incluindo consumo único e sumário ausente |
| test:load-resources      | 2/2                                              |
| test:load-writes         | 11/11, HTTP simulado                             |
| test:load-write-executor | 5/5, guardas/transporte/percentis                |
| test:load-fixtures       | 12/12, PostgreSQL dedicado                       |
| test:load-write-http     | 6/6, API real somente no banco dedicado          |
| npx.cmd tsc --noEmit     | Aprovado                                         |
| npm.cmd run build        | Aprovado                                         |

Total: **62 testes aprovados** nas suítes acima. Resultados anteriores malsucedidos foram usados para corrigir o próprio harness e explicitamente reconciliados; não são apresentados como baseline aprovada.

### Lista de acompanhamento para fechamento da 5.2

| Rodada em escala                                                                              | Baixo                                                | Gradual                                        |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------- |
| Catálogo geral                                                                                | **Interrompido por memória; novo aceite necessário** | Pendente/não autorizado                        |
| Catálogo busca                                                                                | Pendente/não autorizado                              | Pendente/não autorizado                        |
| Catálogo filtros combinados, página1                                                          | Pendente/não autorizado                              | Pendente/não autorizado                        |
| Catálogo filtros combinados, página2                                                          | Pendente/não autorizado                              | Pendente/não autorizado                        |
| Catálogo indisponíveis                                                                        | Pendente/não autorizado                              | Pendente/não autorizado                        |
| Produtos populares                                                                            | Pendente/não autorizado                              | Pendente/não autorizado                        |
| Dashboard high: summary, orders, by-status, timeseries, category, top, new-customers, ratings | Cada endpoint separado pendente/não autorizado       | Cada endpoint separado pendente/não autorizado |
| Dashboard low: mesmos oito endpoints                                                          | Cada endpoint separado pendente/não autorizado       | Cada endpoint separado pendente/não autorizado |

Escritas reais em escala **não executadas**: carrinho, checkout compartilhado, checkout distribuído, idempotência e pagamento integral/duplicata. Por cenário e estágio, manter quotas aprovadas: smoke1 VU/2 operações/30 s; baixo2/10/90 s; gradual4/20/180 s. Cada rodada exige aceite próprio e recuperação comprovada antes da próxima. Testes dedicados que usam essas quotas não contam como baseline de escala.

Próxima autorização proposta: **nova tentativa de catálogo geral baixo**, mesmos 2 VUs/40 GETs/90 s, pausa de 1 s e timeout de 10 s, RAM >=2 GiB antes/durante e demais guardas. Somente após recursos estáveis e novo ticket explicitamente aprovado; não remover o ticket consumido nem reduzir o piso. **5.2 em andamento; 5.3 não iniciada.**

## Atualização desta entrega — leituras e recuperação testadas em 25/10/2026

**5.2 em andamento.** Executados os **21 smokes pendentes de leitura**, 1 VU e 5 operações cada: **105 GETs medidos**, todos corretos pelos oráculos SQL, zero erros técnicos e zero conflitos. As duas rodadas gerais anteriores permanecem no histórico abaixo, separadas: o total acumulado é 115 GETs, não uma única rodada. Nenhuma baixa/gradual ou escrita de negócio contra escala foi executada.

### Resultados separados por variante e endpoint

Valores de latência em ms. Operações/s = requests/s porque cada operação desta tabela tem um GET. A duração é a janela k6, incluindo pausa de 1 s por operação, timeout HTTP 10 s e teto 30 s. Cinco amostras tornam p95/p99 **exploratórios**, sem conclusão de capacidade ou SLA. Não misturar high e low.

| Cenário / variante / endpoint    | Ops previstas/executadas | Janela s | Ops/s = req/s | p50 ms |  p95 ms |  p99 ms |
| -------------------------------- | -----------------------: | -------: | ------------: | -----: | ------: | ------: |
| catalog/filtered1                |                    5 / 5 |    5.117 |         0.977 | 14.817 |  15.958 |  15.992 |
| catalog/filtered2                |                    5 / 5 |    5.073 |         0.986 | 12.728 |  13.794 |  13.852 |
| catalog/unavailable              |                    5 / 5 |    5.159 |         0.969 | 18.925 |  19.838 |  19.997 |
| product/popular                  |                    5 / 5 |    5.076 |         0.985 | 10.083 |  25.162 |  27.901 |
| dashboard/high/summary           |                    5 / 5 |    5.067 |         0.987 | 10.705 |  16.799 |  17.932 |
| dashboard/high/orders            |                    5 / 5 |    6.810 |         0.734 | 12.450 | 852.421 | 913.814 |
| catalog/search                   |                    5 / 5 |    5.076 |         0.985 | 13.781 |  16.882 |  17.267 |
| dashboard/high/orders/by-status  |                    5 / 5 |    5.093 |         0.982 | 11.939 |  36.342 |  40.978 |
| dashboard/high/sales/timeseries  |                    5 / 5 |    5.353 |         0.934 | 18.208 | 188.950 | 222.846 |
| dashboard/high/sales/by-category |                    5 / 5 |    5.080 |         0.984 | 10.472 |  29.189 |  32.710 |
| dashboard/high/products/top      |                    5 / 5 |    5.093 |         0.982 | 13.930 |  23.474 |  23.944 |
| dashboard/high/customers/new     |                    5 / 5 |    5.091 |         0.982 | 13.110 |  25.122 |  25.139 |
| dashboard/high/ratings           |                    5 / 5 |    5.060 |         0.988 |  9.254 |  16.576 |  17.925 |
| dashboard/low/summary            |                    5 / 5 |    5.061 |         0.988 | 10.289 |  14.481 |  15.274 |
| dashboard/low/orders             |                    5 / 5 |    5.080 |         0.984 | 11.956 |  19.503 |  20.552 |
| dashboard/low/orders/by-status   |                    5 / 5 |    5.080 |         0.984 | 11.065 |  27.775 |  31.091 |
| dashboard/low/sales/timeseries   |                    5 / 5 |    5.111 |         0.978 | 12.975 |  27.906 |  30.560 |
| dashboard/low/sales/by-category  |                    5 / 5 |    5.057 |         0.989 |  9.682 |  12.058 |  12.346 |
| dashboard/low/products/top       |                    5 / 5 |    5.582 |         0.896 | 10.827 | 428.814 | 512.334 |
| dashboard/low/customers/new      |                    5 / 5 |    6.142 |         0.814 | 10.026 |  18.612 |  19.548 |
| dashboard/low/ratings            |                    5 / 5 |    5.054 |         0.989 |  9.682 |  10.635 |  10.738 |

Orders/high apresentou p95 de 852,421 ms e top/low de 428,814 ms. São observações reais preservadas, sem repetição para melhorar números. Não há instrumentação suficiente para atribuir esses atrasos a uma consulta específica; não realizar otimização ou análise consolidada da 5.3 aqui.

### Custo do observador e preparação, fora da janela HTTP

Antes: coleta geral de até **7.381 ms**, somente duas amostras gerais por smoke. Agora: stream Docker único, CPU/RSS/heap da API por IPC a cada segundo, consulta PostgreSQL limitada e espaço Windows nativo; configuração estática e du detalhado fora da janela. Coleta serial de 1 s, RAM a 250 ms, sem subprocessos no caminho de cada request. A CPU do coletor ainda disputa recursos com a carga.

| Cenário                          | Preparo s | Aquecimento GETs / ms | Instalação observador ms | Detalhada antes/depois ms | Máximo periódico ms | Amostras gerais | RAM mínima GiB |
| -------------------------------- | --------: | --------------------: | -----------------------: | ------------------------: | ------------------: | --------------: | -------------: |
| catalog/filtered1                |     7.996 |                1 / 54 |                     1003 |             278.3 / 256.2 |                7.08 |               7 |          1.285 |
| catalog/filtered2                |     7.020 |                1 / 50 |                     1280 |             251.8 / 240.9 |                7.35 |               7 |          1.225 |
| catalog/unavailable              |    15.785 |                1 / 87 |                     1032 |             296.2 / 285.5 |              380.64 |               8 |          2.607 |
| product/popular                  |     7.125 |               5 / 107 |                      930 |             250.9 / 235.3 |               16.47 |               7 |          2.586 |
| dashboard/high/summary           |     7.510 |                1 / 65 |                     1265 |             250.2 / 275.8 |               39.40 |               7 |          2.974 |
| dashboard/high/orders            |     7.432 |                1 / 53 |                      981 |            263.0 / 1197.1 |               22.72 |               9 |          2.629 |
| catalog/search                   |     8.976 |                1 / 54 |                      598 |             280.5 / 268.3 |               62.74 |               8 |          2.396 |
| dashboard/high/orders/by-status  |     8.536 |                1 / 57 |                     1378 |             279.7 / 266.6 |               21.03 |               7 |          2.813 |
| dashboard/high/sales/timeseries  |    10.746 |                1 / 77 |                     1179 |             260.4 / 252.6 |                8.38 |               8 |          2.478 |
| dashboard/high/sales/by-category |     8.174 |                1 / 53 |                     1201 |             269.7 / 262.5 |                7.18 |               7 |          2.635 |
| dashboard/high/products/top      |     6.591 |                1 / 48 |                      585 |             242.1 / 275.9 |               16.69 |               7 |          2.623 |
| dashboard/high/customers/new     |     8.395 |                1 / 51 |                     1269 |             271.4 / 341.6 |                7.73 |               7 |          2.398 |
| dashboard/high/ratings           |     9.251 |                1 / 58 |                     1407 |             272.7 / 254.2 |                7.19 |               7 |          2.691 |
| dashboard/low/summary            |     6.986 |                1 / 63 |                      576 |             262.5 / 288.1 |                7.29 |               7 |          2.698 |
| dashboard/low/orders             |     7.530 |                1 / 46 |                     1222 |             267.3 / 266.2 |                7.72 |               7 |          2.569 |
| dashboard/low/orders/by-status   |     7.143 |                1 / 52 |                      587 |             282.4 / 286.0 |               21.71 |               7 |          2.378 |
| dashboard/low/sales/timeseries   |     6.833 |                1 / 43 |                      577 |             249.2 / 284.7 |                7.85 |               7 |          2.617 |
| dashboard/low/sales/by-category  |     7.227 |                1 / 52 |                      710 |             278.1 / 279.1 |                9.78 |               7 |          2.699 |
| dashboard/low/products/top       |     7.074 |                1 / 58 |                      965 |             261.1 / 274.1 |                8.83 |               7 |          2.372 |
| dashboard/low/customers/new      |     7.556 |               1 / 430 |                      579 |             289.1 / 260.3 |               12.60 |               8 |          2.287 |
| dashboard/low/ratings            |     6.621 |                1 / 42 |                      573 |             265.6 / 724.3 |                9.85 |               7 |          2.676 |

Foram **153 amostras gerais** (7–9 por rodada), com timestamps e idade das fontes registrados; máximo periódico **380,645 ms**. Instalação do stream: 573–1.407 ms; detalhadas: 235,317–1.197,087 ms, ambas fora da janela. Preparo total inclui descoberta de ambiente, assinaturas, oráculo, aquecimento e instalação — não somar esses custos novamente. Os 25 GETs de aquecimento das rodadas aprovadas e um GET da preparação interrompida não integram os 105 GETs medidos. Hashing final também fica fora da janela.

Política temporária aplicada somente a read/smoke: início ≥1,25 GiB **depois** de iniciar API, banco e observador; interrupção <1 GiB. A RAM mínima durante as rodadas aprovadas variou de **1,225 a 2,974 GiB**. A página filtrada 2 pôde cair abaixo de 1,25 durante a execução, mas permaneceu acima do piso de 1 GiB. A partir de ratings/high o agregado também persiste explicitamente RAM no instante pós-observador; nas rodadas anteriores a guarda existia, mas esse ponto separado não foi salvo. Antes desta retomada final houve recusa por pouca memória e amostra avulsa de ~0,85 GiB; isso não é mínimo de uma carga executada.

Picos **amostrados** de CPU host chegaram a **97,504%**, inclusive >85% em popular, summary/high e top/high. As janelas curtas não demonstram sustentação por 15 s; a guarda permanece configurada. Working set API máximo amostrado 83.963.904 bytes, PostgreSQL/container 51.778.682,88 bytes; até 4 conexões, zero esperas por lock e zero fingerprints lentos observados. Isso não representa picos contínuos nem histórico completo de consultas. Private bytes da API não medidos ficam null; RSS e heap são métricas distintas.

### Falhas de preparação e política de repetição

A primeira busca (`catalog-search-smoke-17ac46fe-8124-4113-971b-48f7a256c907`) foi interrompida antes do k6: zero GETs medidos, um aquecimento. O Docker stream continha escapes ANSI que o parser rejeitou. O parser foi corrigido e seus testes passaram. Uma repetição explicitamente autorizada foi recusada antes de conexão/carga pela guarda de 1,25 GiB. Após novo aceite expresso do responsável e recuperação de memória, **uma nova tentativa** passou 5/5 (`catalog-search-smoke-c98a45f6-383d-449c-8ffe-3425109eeeea`). Não houve retry automático ou escrita para contornar falhas.

### Integridade e armazenamento

Small permaneceu completed, **30.349 registros**. Hashes e contagens das **22 tabelas** iguais antes/depois de cada rodada; `scale:verify` final passou as **18 invariantes**. Nenhuma fixture foi preparada no small. Desenvolvimento, E2E e produção não foram usados.

Banco final **24.321.047 bytes**; diretório PostgreSQL **81.399.808 bytes**, WAL **33.562.624 bytes**. Menor espaço livre Windows amostrado **59.960.098.816 bytes**. Volume `marketplace_scale_data` e VHDX compartilhado permanecem conforme inventário anterior abaixo; o comprimento do VHDX não é ocupação exclusiva de escala. A supervisão mantém orçamento 5/10 GiB, margens de WAL/temporários/logs e disco Windows; nenhuma configuração global/durabilidade foi alterada.

### Fixtures e cenários de escrita: preparados/testados, sem medição em escala

Banco exclusivo `marketplace_load_test`, usuário homônimo, container `marketplace-load-test-postgres`, porta loopback 5436, volume próprio `marketplace_load_fixture_test_data`. Baseline existente aplicada sem mudar migrations. Proteções recusam escala/desenvolvimento/E2E/remotos e exigem também identidade SQL, label e volume. Namespace/manifesto em scale_ops, até 20 customers/1 seller/21 produtos, assinatura histórica, bloqueio persistente e advisory lock comum.

**12/12 testes reais PostgreSQL aprovados**: preparação/recuperação dos cinco grafos; falha após etapa já commitada; exclusão mútua; rollback de todos os deletes; RUNNING órfão; resposta perdida com pagamento persistido; FK cruzada; assinatura histórica alterada. Recuperações são explícitas, sem cleanup automático. O usuário sentinela de teste permaneceu idêntico, nenhum grafo experimental ficou pendente e o manifesto terminou **RECOVERED**. A primeira versão de 11 testes também passou; a contagem final da suíte é 12.

**11/11 testes HTTP simulados aprovados** para carrinho, checkout compartilhado/distinto, idempotência e pagamento integral/duplicado, incluindo motivo exato do 409, pós-condição ausente e resposta perdida sem retry. Barreira demonstra despacho concorrente no simulador, não disputa real no PostgreSQL. O executor recusa escala; apenas simulação/API de teste fixa são permitidas. Não há API pública de captura nem gateway externo.

Pendências antes de executar escrita real: autorização posterior, ≥2 GiB, adaptação explícita do controlador/manifesto para o destino operacional de escala, transporte autenticado real e supervisão/armazenamento apropriados à janela de escrita. Não confundir fixtures testadas com cenários de escrita medidos.

### Validação e encerramento

- `test:load-plan` 8/8; `test:load-baseline` 17/17 (inclui k6 inspect real sem HTTP); `test:load-resources` 2/2; `test:load-writes` 11/11; `test:load-fixtures` 12/12 no banco dedicado.
- Typecheck/build e regressões 4.x são registrados no resumo após seu resultado final.
- API exclusiva8051 e ambos os containers iniciados pelo trabalho foram encerrados; volumes preservados. O container de desenvolvimento preexistente não foi parado. Sem Next/jobs/serviços externos, purge/regeneração, medium/large, mudanças de schema/migrations ou commit.
- Próxima autorização proposta: somente catálogo geral em estágio **low**, 2 VUs, 40 GETs, pausa de 1 s, timeout de 10 s, teto de 90 s, RAM ≥2 GiB no início e durante toda execução; mesmas guardas CPU/disco/conexões/locks. Uma rodada, sem retry, sem avanço automático e sem escritas. **Ainda não autorizada nem executada.**
- 5.2 permanece em andamento e 5.3 não foi iniciada.

Agregados limitados, sem cookies/tokens/bodies por request: `load/results/<id>-{run, k6}.json`, ignorados pelo Git. Manifesto de sessões em `load/.local/` também ignorado. Operação reproduzível em `LOAD_TEST_PLAN.md`.

### Identificadores dos smokes desta entrega

- `catalog/filtered1`: `catalog-filtered1-smoke-ab6055b2-fab6-4612-9f5f-fe2bbfbbafed`.
- `catalog/filtered2`: `catalog-filtered2-smoke-f9bd33f1-b33e-4913-9efa-1f76ec147922`.
- `catalog/unavailable`: `catalog-unavailable-smoke-16a23825-74c9-4d07-98ba-f6d38fa72bef`.
- `product/popular`: `product-popular-smoke-e91d2e53-f350-4102-a73f-9cc260bea0f1`.
- `dashboard/high/summary`: `dashboard-high-smoke-a1b7869e-e5dc-4361-b057-074b3b175400`.
- `dashboard/high/orders`: `dashboard-high-smoke-9bf79d27-469d-4e00-afe3-6ec7b3923cab`.
- `catalog/search`: `catalog-search-smoke-c98a45f6-383d-449c-8ffe-3425109eeeea`.
- `dashboard/high/orders/by-status`: `dashboard-high-smoke-4e5ff4d6-ea4c-441d-bff1-5e3cff11cbd3`.
- `dashboard/high/sales/timeseries`: `dashboard-high-smoke-27a6f696-a1f8-4ba4-99b9-d5f1e636475e`.
- `dashboard/high/sales/by-category`: `dashboard-high-smoke-8cfdb334-9c13-4de3-a69b-822ef78d1a7e`.
- `dashboard/high/products/top`: `dashboard-high-smoke-933d193c-7fe0-4043-b8fb-6ce7ddd24e4e`.
- `dashboard/high/customers/new`: `dashboard-high-smoke-21ccd2a4-7387-404f-bb48-9b09b42b4091`.
- `dashboard/high/ratings`: `dashboard-high-smoke-64135709-e68e-4a82-87f6-4141bca605df`.
- `dashboard/low/summary`: `dashboard-low-smoke-a2b1a4ba-836c-41ac-96c1-cd8555a00e48`.
- `dashboard/low/orders`: `dashboard-low-smoke-e54dead1-c320-4f29-a4ed-8fe039a9cd05`.
- `dashboard/low/orders/by-status`: `dashboard-low-smoke-4c1db949-f717-4142-a5c4-b2590f9caf10`.
- `dashboard/low/sales/timeseries`: `dashboard-low-smoke-55157f11-1246-4ee1-9e6d-6658a42b8c10`.
- `dashboard/low/sales/by-category`: `dashboard-low-smoke-3857f593-8440-4f3c-9885-7e15d0742375`.
- `dashboard/low/products/top`: `dashboard-low-smoke-bc67c5c4-2743-42b1-b65b-eddcf625baa1`.
- `dashboard/low/customers/new`: `dashboard-low-smoke-8b21b39e-f518-468b-9f16-d6e8e27a6760`.
- `dashboard/low/ratings`: `dashboard-low-smoke-f21b8468-0dfc-4045-b44e-a52124d1a0c4`.

## Histórico anterior: smokes gerais e bloqueio inicial

Os trechos seguintes preservam as evidências anteriores. Seus estados pendentes descrevem aquele momento, não substituem a atualização acima.

## Duas medições gerais iniciais de 25/10/2026

Nova política: início com pelo menos **1,25 GiB**; interrupção abaixo de **1 GiB**. Demais limites mantidos. Apenas `catalog/all/smoke`, **1 VU, 5 GETs /products?page=1&limit=20**, timeout 10 s, pausa 1 s, máximo 30 s. Nenhuma escrita, avanço de estágio ou outro cenário foi executado.

| Medida                                    |                        Primeira rodada |               Repetição supervisionada |
| ----------------------------------------- | -------------------------------------: | -------------------------------------: |
| Identificador                             | `233b2487-9439-4a25-bb1d-ce2abb8f33bb` | `799803e9-5c16-4d11-8b44-0c6dc602863b` |
| Início do preparo (America/Sao_Paulo)     |                               01:13:27 |                               01:17:06 |
| Operações / GETs previstos e executados   |                                  5 / 5 |                                  5 / 5 |
| Respostas corretas pelo oráculo / falhas  |                                  5 / 0 |                                  5 / 0 |
| Janela k6, incluindo pausas               |                                5,113 s |                                5,075 s |
| Operações/s = requests/s                  |                                  0,978 |                                  0,985 |
| p50 HTTP                                  |                              13,169 ms |                              12,578 ms |
| p95 HTTP                                  |                              15,225 ms |                              13,948 ms |
| p99 HTTP                                  |                              15,583 ms |                              14,219 ms |
| Erros técnicos / conflitos                |                                  0 / 0 |                                  0 / 0 |
| Preparação total (inclui aquecimento)     |                               15,479 s |                               12,452 s |
| Aquecimento fora da janela                |                          1 GET / 82 ms |                          1 GET / 47 ms |
| Verificação de assinaturas fora da janela |                                 623 ms |                                 655 ms |
| Janela supervisor (inclui coleta final)   |                               12,068 s |                               12,445 s |
| Amostras gerais / rápidas de memória      |    2 / não havia watchdog independente |                                 2 / 22 |
| RAM host mínima observada                 |        2.443.735.040 bytes (2,276 GiB) |        2.145.730.560 bytes (1,998 GiB) |
| CPU host máxima amostrada                 |                                11,855% |                                18,743% |
| Working set API máximo amostrado          |                       78.245.888 bytes |                       78.614.528 bytes |
| Memória PostgreSQL/container amostrada    |                       51.841.597 bytes |                       48.307.896 bytes |
| Conexões / sessões esperando lock         |                                  3 / 0 |                                  3 / 0 |
| Custo máximo da coleta pesada             |                                7,010 s |                                7,381 s |

As duas rodadas somam **10 requests medidos** e **2 GETs de aquecimento**; descoberta SQL, root, dois logins e `/users/me` foram preparação separada, não entram no throughput medido. A segunda NÃO foi retry de falha de negócio: a primeira passou, mas expôs uma limitação do observador; a repetição do mesmo smoke foi anunciada e registrada após mover os comandos lentos a um worker. Não houve tentativa silenciosa ou carga baixa/gradual.

**Avaliação antes de avançar:** RAM permaneceu acima do piso, sem interrupção; CPU/conexões/disco ficaram abaixo dos limites nas amostras. Porém cinco requests não demonstram concorrência/capacidade e p95/p99 são exploratórios. O observador pesado custa mais que a janela k6 e teve apenas duas amostras gerais, incluindo finalização: isso limita atribuição de CPU/SQL. Watchdog de RAM independente a 250 ms foi efetivamente observado na segunda rodada. Não liberar estágios posteriores automaticamente; revisar custo de coleta e obter nova decisão.

### Integridade, ambiente e armazenamento reconfirmados

Small reconfirmado antes/depois: **30.349 registros, estado completed, 18 invariantes aprovadas**. Assinaturas SHA-256 das 22 tabelas foram iguais antes/depois de CADA rodada. Nenhuma fixture de escrita foi criada; não há limpeza/recuperação de fixture a executar.

Banco: **24.321.047 bytes**; diretório PostgreSQL: **81.399.808 bytes**, incluindo WAL de **33.562.624 bytes**, estáveis nas duas janelas. Menor espaço livre Windows observado na segunda: **60.733.497.344 bytes**. VHDX compartilhado continuou com comprimento lógico 20.805.844.992 bytes; não é ocupação exclusiva de escala. Não houve purge, geração ou alteração de schema/migrations/durabilidade.

API compilada exclusiva 8051, pool 5; PostgreSQL **16.15**, Docker Engine **29.7.2**, VM configurada 12 CPUs/8.278.122.496 bytes, container sem caps explícitos CPU/RAM. Node 24.21.0, npm 11.19.0, k6 1.3.0/checksum aprovado. Commit-base `401c27f127da068a27499aa17dc53dcbf24d5487` e alterações locais registrados em cada agregado. Não foram iniciados Next ou jobs.

CPU API amostrada foi 0% e sessões ativas/slow fingerprints observados foram zero: **não significam custo ou consultas inexistentes**; a resolução e o intervalo do observador não capturam necessariamente requests de ~13 ms. `log_min_duration_statement=-1` e shared_preload_libraries vazio foram apenas lidos, não modificados. Não há histórico completo de queries nem atribuição comprovada de consulta lenta.

Resultados agregados limitados estão em `load/results/catalog-all-smoke-<identificador>-{k6, run}.json`, ignorados pelo Git; sem tokens/cookies/bodies por request. Só documentação e configuração são versionadas. API e container iniciado por este trabalho foram encerrados, restaurando o estado inicialmente parado do container; volume/dataset preservados.

Validação atual: **17/17** testes da supervisão, **8/8** do plano, typecheck/build aprovados. O teste novo demonstra a interrupção por memória durante coleta pesada pendente. CPU, duração, armazenamento, conexões e locks conservam suas proteções anteriores.

## Histórico de bloqueio — 24/10/2026

Os itens abaixo descrevem exclusivamente a tentativa anterior; seus "não medidos" não anulam o smoke de catálogo medido acima.

## Evidências observadas

- Commit-base: `401c27f127da068a27499aa17dc53dcbf24d5487` (`k6 load test cases configured`), com alterações locais de preparação da 5.2. Nenhum commit criado.
- k6 instalado localmente: **1.3.0**, commit `5870e99ae8`, Go 1.25.1, Windows/amd64. SHA-256 do ZIP aprovado e observado: `06a15d69869efb9261e6c132af64078731ad7d048095eaca05198daacb17686d`. Ferramenta e arquivo ZIP em `load/.local/`, ignorados pelo Git.
- Node **24.21.0**, npm **11.19.0**; host Ryzen 5 5600, 12 CPUs lógicas, RAM total **17.083.686.912 bytes**. API, PostgreSQL e k6 compartilham a máquina.
- Na retomada: RAM livre **1.639.845.888 bytes (1,53 GiB)**; depois **1.951.547.392 bytes (1,82 GiB)** e **1.964.343.296 bytes (1,83 GiB)**. Todas essas amostras estão abaixo dos **2.147.483.648 bytes** exigidos. Uma amostra transitória acima do piso não comprova disponibilidade estável.
- `npm.cmd run load:read -- catalog all smoke` foi recusado **antes de conectar ao banco/iniciar k6**: `Host memory below 2 GiB or unavailable; no API/load will be started`. Exit code 1, **zero operações e zero requests de carga**.
- Docker Engine **29.7.2** disponível; VM configurada com **12 CPUs e 8.278.122.496 bytes de memória**. São recursos configurados, não consumo medido em carga.
- Container `marketplace-scale-postgres` encontrado **parado**, exit code 255, OOMKilled=false. Não foi iniciado nesta retomada, preservando seu estado. A versão PostgreSQL, estado operacional SQL, contagens e invariantes atuais **não foram reconfirmados** com o container parado.
- Espaço livre real observado em `C:`: **61.125.787.648 bytes**. Não houve medição atual de PGDATA/WAL ou tamanho do banco. Os números da 4.3 não foram reutilizados como se fossem medidas desta etapa.

## Cenários

| Cenário/variantes                                               | Estágios executados          | Requests de carga | p50/p95/p99, throughput, resultados de negócio |
| --------------------------------------------------------------- | ---------------------------- | ----------------: | ---------------------------------------------- |
| Catálogo: geral, filtros combinados, páginas 1/2, indisponíveis | Nenhum; guard bloqueou smoke |                 0 | Não medidos                                    |
| Produto: cinco populares                                        | Nenhum                       |                 0 | Não medidos                                    |
| Dashboard: seller maior/menor volume, oito endpoints separados  | Nenhum                       |                 0 | Não medidos                                    |
| Carrinho                                                        | Nenhum; escrita bloqueada    |                 0 | Não medidos                                    |
| Checkout compartilhado/distribuído                              | Nenhum; escrita bloqueada    |                 0 | Não medidos                                    |
| Idempotência concorrente                                        | Nenhum; escrita bloqueada    |                 0 | Não medidos                                    |
| Pagamento integral/duplicidade                                  | Nenhum; escrita bloqueada    |                 0 | Não medidos                                    |

Não houve login, aquecimento de API, preparação/recuperação de fixture, carga sintética, purge ou operação de negócio. Nenhum processo de API/Next/job/k6 de carga foi iniciado. Não há listener 8051 deixado por esta retomada. `k6 version` e `k6 inspect` são validações da ferramenta, não operações de carga.

## Infraestrutura preparada e validações

Runner supervisionado de leitura, coleta/agregação limitada de recursos, oráculos SQL, comparação de campos/ordem, assinatura SHA-256 em lotes das 22 tabelas e separação por variante/seller/endpoint foram implementados. Não foram validados contra o PostgreSQL real nesta sessão. Os testes de coleta/interrupção usam amostras e processo falsos; não são resultados de carga ou prova de proteção em produção.

Validação local: `test:load-baseline` **15/15**, `test:load-plan` **8/8**, perfis/distribuições/loader **20/20**; TypeScript sem emissão e build compilada aprovados. `k6 inspect` com arquivos fictícios isolados passou sem executar HTTP e recusou modo não supervisionado. Uma primeira execução de inspect no sandbox falhou ao acessar o canal TLS de diagnóstico herdado; a execução permitida fora do sandbox passou, sem mudar antivírus/configurações globais.

## Pendências antes da execução

1. Disponibilidade de pelo menos 2 GiB livres com margem para API/k6/DB, sem encerrar aplicativos do usuário ou alterar configurações globais automaticamente.
2. Iniciar explicitamente apenas o container existente de escala, conferir armazenamento, identidade SQL, small/estado/contagens/invariantes e recursos efetivos; não gerar/purgar dados.
3. Iniciar API compilada 8051, preparar sessões/oráculos, validar supervisão real; executar uma variante por vez em smoke → baixa → gradual, conferindo cada rodada. Não executar uma lista de comandos como escalada automática.
4. **Ainda implementar** namespace/manifesto persistente, bloqueios de preparação/concorrência, grafo de fixtures e recuperação transacional. Testar recuperação/falha parcial em banco próprio antes de qualquer escrita de experimento sobre escala. Nenhuma fixture foi criada; não há recuperação de dados a executar agora.
5. Só então liberar cenários de escrita, barreiras de participantes, verificações persistidas e recuperação explícita entre rodadas. Em falha/timeout, parar e reconciliar por leitura, sem retry automático ou troca de chave.

A 5.2 permanece **pendente/bloqueada**; a 5.3 ainda não deve começar. Comandos e limitações do harness estão em `LOAD_TEST_PLAN.md`. Não se alteraram schema, migrations, regras de negócio, dataset-base ou ambientes de desenvolvimento/E2E/produção.
