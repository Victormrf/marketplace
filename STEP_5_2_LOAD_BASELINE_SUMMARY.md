# Etapa 5.2 — Leituras smoke aprovadas; baseline ainda parcial

## Resultado de 25/10/2026

Executados **21 smokes adicionais**, um por vez, **1 VU × 5 GETs = 105 requests medidos**: catálogo com busca, filtros e páginas 1/2, indisponíveis, cinco produtos populares e os oito endpoints do dashboard separadamente para sellers de maior/menor volume. Todos corretos pelos oráculos SQL, zero erros técnicos/conflitos e hashes das 22 tabelas iguais antes/depois. Os dois smokes gerais anteriores (10 GETs) ficam separados no relatório; total histórico 115 GETs.

O small continuou **completed / 30.349 registros**, com as **18 invariantes** reconfirmadas por leitura no final. Não houve escrita de negócio em escala, geração, purge, medium/large, Next, jobs ou gateway externo. API 8051 e containers iniciados pelo trabalho foram encerrados, volumes preservados; serviços preexistentes não foram parados.

## Observador e limites

A coleta anterior custava até **7,381 s**. Removidas chamadas recorrentes Docker/PowerShell: stream Docker único, API por IPC a cada 1 s, consulta SQL limitada e disco Windows por Node. Amostras gerais seriais a cada 1 s e watchdog RAM a cada 250 ms, sem subprocessos por request. Novo máximo periódico **380,645 ms**; 153 amostras gerais (7–9/rodada). Instalação de 573–1.407 ms e detalhadas de 235,317–1.197,087 ms ficam fora da janela. Timestamps, custos e idade das fontes são registrados. Não é medição contínua de cada pico ou histórico completo de SQL.

Relaxamento apenas read/smoke: **>=1,25 GiB depois de API/DB/observador prontos**, interrompendo <1 GiB. Mínima observada nas rodadas aprovadas **1,225 GiB**. Baixa/gradual/escritas mantêm 2 GiB e novo aceite. Pico CPU host amostrado **97,504%**, sem evidência de sustentação por 15 s nessas janelas curtas; guardas CPU/disco/tempo/conexões/locks preservadas.

Primeira busca falhou no preparo por escapes ANSI do Docker: zero GETs medidos. Parser corrigido/testado; uma repetição autorizada foi recusada pela memória antes da carga. Após nova autorização explícita e recursos suficientes, a busca passou 5/5. Nenhum retry automático.

## Fixtures e escrita preparadas

Criado banco dedicado **marketplace_load_test:5436**, container/volume próprios, baseline existente e marcador SQL. URL/usuário/porta/container/volume validados, recusando escala, desenvolvimento, E2E e remotos.

Manifesto persistente e namespace próprio: até 20 customers / 1 seller / 21 produtos, IDs/chaves estáveis e contagens/assinatura anterior. PREPARING/READY/RUNNING/UNKNOWN bloqueiam nova preparação; advisory lock impede concorrência. Recuperação explícita por grafo/FKs e transação Serializable, sem cleanup automático, sem liberação fictícia de reservas e sem purge da 4.3. Detecta resposta perdida e relações cruzadas; falha na recuperação reverte todos os deletes. Estado final **RECOVERED**, apenas usuário sentinela próprio preservado no banco de teste.

Testes reais passaram primeiro 11/11 e, após acrescentar RUNNING órfão, **12/12**. Cart, checkouts compartilhado/distinto, idempotência e pagamento integral/duplicado têm scripts limitados e **11/11 testes HTTP simulados**. Simulação não comprova concorrência real no banco. Escala permanece recusada: transporte real, destino operacional, supervisão da janela de escrita e autorização são pendências antes da execução.

## Validação final

| Comando                                      | Resultado                            |
| -------------------------------------------- | ------------------------------------ |
| test:load-plan                               | 8/8                                  |
| test:load-baseline                           | 17/17, incluindo k6 inspect sem HTTP |
| test:load-resources                          | 2/2                                  |
| test:load-writes                             | 11/11, HTTP simulado                 |
| test:load-fixtures                           | 12/12, PostgreSQL dedicado           |
| test:scale-profiles / distributions / loader | 5/5 + 7/7 + 8/8                      |
| npx.cmd tsc --noEmit                         | Aprovado                             |
| npm.cmd run build                            | Aprovado                             |
| scale:verify                                 | 30.349 registros / 18 invariantes    |

São **70 testes**, todos aprovados nas suítes acima. Percentis de cinco operações são exploratórios: orders/high p95 **852,421 ms**; timeseries/high **188,950 ms**; top/low **428,814 ms**, sem atribuição comprovada a query específica. Throughput e demais endpoints/custos estão separados no relatório; pausas de 1 s integram a janela.

Banco 24.321.047 bytes; PGDATA 81.399.808 bytes incluindo WAL 33.562.624 bytes; mínimo Windows livre 59.960.098.816 bytes. VHDX é compartilhado, sem atribuir seu tamanho ao dataset.

## Pendências e próxima decisão

**5.2 permanece em andamento.** Nenhuma baixa/gradual ou escrita real foi executada. Solicitar autorização para somente catálogo geral low: **2 VUs, 40 GETs, pausa de 1 s, timeout de 10 s, teto de 90 s, RAM >=2 GiB antes/durante**, mesmas guardas de CPU/disco/conexões/locks; uma rodada, sem retry ou avanço automático. Não iniciar 5.3.

Operação: `nodejs-backend/docs/LOAD_TEST_PLAN.md`. Resultados e IDs: `nodejs-backend/docs/LOAD_BASELINE_REPORT.md`; agregados limitados em load/results ignorados pelo Git, sem tokens/cookies/bodies. Commit-base 401c27f127da068a27499aa17dc53dcbf24d5487 com alterações locais preservadas; sem commit, schema/migrations/regras de negócio ou configurações globais alterados.
