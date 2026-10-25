# Primeira baseline local — leituras smoke aprovadas; etapa parcial

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

Banco exclusivo `marketplace_load_test`, usuário homônimo, container `marketplace-load-test-postgres`, porta loopback5436, volume próprio `marketplace_load_fixture_test_data`. Baseline existente aplicada sem mudar migrations. Proteções recusam escala/desenvolvimento/E2E/remotos e exigem também identidade SQL, label e volume. Namespace/manifesto em scale_ops, até 20 customers/1 seller/21 produtos, assinatura histórica, bloqueio persistente e advisory lock comum.

**12/12 testes reais PostgreSQL aprovados**: preparação/recuperação dos cinco grafos; falha após etapa já commitada; exclusão mútua; rollback de todos os deletes; RUNNING órfão; resposta perdida com pagamento persistido; FK cruzada; assinatura histórica alterada. Recuperações são explícitas, sem cleanup automático. O usuário sentinela de teste permaneceu idêntico, nenhum grafo experimental ficou pendente e o manifesto terminou **RECOVERED**. A primeira versão de 11 testes também passou; a contagem final da suíte é 12.

**11/11 testes HTTP simulados aprovados** para carrinho, checkout compartilhado/distinto, idempotência e pagamento integral/duplicado, incluindo motivo exato do 409, pós-condição ausente e resposta perdida sem retry. Barreira demonstra despacho concorrente no simulador, não disputa real no PostgreSQL. O executor recusa escala; apenas simulação/API de teste fixa são permitidas. Não há API pública de captura nem gateway externo.

Pendências antes de executar escrita real: autorização posterior, ≥2 GiB, adaptação explícita do controlador/manifesto para o destino operacional de escala, transporte autenticado real e supervisão/armazenamento apropriados à janela de escrita. Não confundir fixtures testadas com cenários de escrita medidos.

### Validação e encerramento

- `test:load-plan` 8/8; `test:load-baseline` 17/17 (inclui k6 inspect real sem HTTP); `test:load-resources` 2/2; `test:load-writes` 11/11; `test:load-fixtures` 12/12 no banco dedicado.
- Typecheck/build e regressões 4.x são registrados no resumo após seu resultado final.
- API exclusiva8051 e ambos os containers iniciados pelo trabalho foram encerrados; volumes preservados. O container de desenvolvimento preexistente não foi parado. Sem Next/jobs/serviços externos, purge/regeneração, medium/large, mudanças de schema/migrations ou commit.
- Próxima autorização proposta: somente catálogo geral em estágio **low**, 2 VUs, 40 GETs, pausa1 s, timeout10 s, teto90 s, RAM ≥2 GiB no início e durante toda execução; mesmas guardas CPU/disco/conexões/locks. Uma rodada, sem retry, sem avanço automático e sem escritas. **Ainda não autorizada nem executada.**
- 5.2 permanece em andamento e 5.3 não foi iniciada.

Agregados limitados, sem cookies/tokens/bodies por request: `load/results/<id>-{run,k6}.json`, ignorados pelo Git. Manifesto de sessões em `load/.local/` também ignorado. Operação reproduzível em `LOAD_TEST_PLAN.md`.

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

Resultados agregados limitados estão em `load/results/catalog-all-smoke-<identificador>-{k6,run}.json`, ignorados pelo Git; sem tokens/cookies/bodies por request. Só documentação e configuração são versionadas. API e container iniciado por este trabalho foram encerrados, restaurando o estado inicialmente parado do container; volume/dataset preservados.

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
