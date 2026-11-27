# Etapa 4.3 — Geração determinística e carga isolada

## Resultado observado em 22/10/2026

**Uma única carga real small**, concluída e preservada para inspeção. Nenhuma execução medium/large, nenhum retry de carga, nenhum purge final. Run `cb6ea698-6131-4b04-b78d-d5bdcff2fb97`, configuração v2, gerador v1.0.0, seed `410401`, base `2026-01-01T00:00:00.000Z`.

Execução de 18:45:16 a 18:46:22 (America/Sao_Paulo), duração registrada **66.008 ms**. Duração operacional observada, não benchmark de desempenho. Estado persistido e efetivo `completed`; autorização consumida. Planejamento e registros inseridos conferidos por consultas somente leitura:

| Tabela | Previsto = inserido = verificado |
|---|---:|
| user | 110 |
| customer | 100 |
| seller | 10 |
| customer_address | 150 |
| product | 500 |
| inventory | 500 |
| cart | 40 |
| cart_item | 80 |
| order | 1.000 |
| seller_order | 1.400 |
| order_item | 3.500 |
| order_address | 1.000 |
| payment_attempt | 1.150 |
| refund | 105 |
| delivery | 784 |
| order_status_history | 1.700 |
| seller_order_status_history | 4.106 |
| delivery_status_history | 3.314 |
| inventory_reservation | 3.500 |
| inventory_movement | 6.000 |
| review | 300 |
| idempotency_key | 1.000 |
| **Total físico** | **30.349** |

## Ambiente e armazenamento

Container `marketplace-scale-postgres`; PostgreSQL **16.15**, imagem `postgres:16-alpine`; `127.0.0.1:5435`, banco/usuário `marketplace_scale`. Volume dedicado persistente `marketplace_scale_data`, PGDATA `/var/lib/postgresql/data/pgdata`; diretório do volume dentro da VM `/var/lib/docker/volumes/marketplace_scale_data/_data`.

| Medida | Antes (bytes) | Depois (bytes) |
|---|---:|---:|
| Banco, incluindo tabelas/índices (`pg_database_size`) | 9.157.655 | 24.239.127 |
| Diretório PostgreSQL/volume (`du`, inclui WAL) | 49.459.200 | 81.481.728 |
| WAL (já incluído acima) | 16.785.408 | 33.562.624 |
| Camada gravável do container | 24.576 | 24.576 |
| Espaço livre real do Windows C: | 66.175.455.232 | 66.174.066.688 |
| Comprimento do VHDX compartilhado | 20.805.844.992 | 20.805.844.992 |

Pico amostrado do diretório: 81.481.728 bytes; menor espaço livre Windows observado: 66.173.632.512 bytes. Logs limitados a 10 MB × 3; esse teto conservador entra no cálculo de orçamento. Alvo preventivo 5 GiB e teto 10 GiB preservados, com margens por lote. O tamanho observado ficou muito abaixo de ambos.

VHDX real em `C:\Users\Principal\AppData\Local\Docker\wsl\disk\docker_data.vhdx`. É compartilhado com outros ambientes: não atribuir seu tamanho integral à escala nem confundir comprimento lógico com alocação física. O volume não possui uma pasta Windows independente. Nenhum arquivo intermediário ou dump foi gerado.

## Implementação e verificações

Infraestrutura/gerador previamente escritos foram retomados do commit-base `75255db`. Nesta retomada, foram concluídas a conferência de quantidade por lote, a inclusão da última amostra no pico de armazenamento, a identificação anterior ao provisionamento e a regressão do estado órfão após encerramento abrupto. Node **24.21.0**, npm **11.19.0**, Docker Engine **29.7.2**.

O bloqueio inicial do Docker foi superado após o engine voltar a responder; não houve alteração global do Docker/WSL nesta retomada. Sequência executada: testes sem banco → prepare → dry-run small sem consumo de autorização → purge explícito com 22 tabelas vazias → uma carga small → verify/status somente leitura.

- `test:scale-profiles`: **5/5**.
- `test:scale-distributions`: **7/7**.
- `test:scale-loader`: **8/8**, incluindo destino, autorização consumida/órfã, contrato de exclusão mútua, orçamento, determinismo e quotas/relações. O teste de lock usa adapter unitário; não representa teste de concorrência real em escala.
- Dry-run: 30.349 registros, estado inicial interrompido, zero existente, autorização não consumida.
- Purge: todas as 22 tabelas vazias, estado `ready`.
- Carga e verificação posterior: **18 verificações de invariantes aprovadas**, contagens exatas e estado `completed`.

Hash dos registros planejados: `1e7c1f255a3625f7bf3f85793572c26121d67ff61a7880278302502f10827d6f`. É uma referência determinística do plano, não um hash calculado por releitura integral do banco. Relatório operacional detalhado fica em `scale_ops.control.report`; consultas e comandos estão centralizados em `nodejs-backend/docs/SCALE_DATA_LOADING.md`.

## Limitações preservadas

SellerOrders avançadas são snapshots históricos; reservas continuam ACTIVE, inclusive após entrega, conforme 4.2. Não houve gateway, job, liberação de reserva ou mudança de regra. O plano compacto cresce com o perfil; esta execução não autoriza nem valida medium/large. Métricas são amostradas; não constituem limite físico automático ou garantia contra crescimento de outros containers.

O dataset permanece disponível. Não foram acessados/limpos bancos de desenvolvimento, E2E ou produção. Schema da aplicação, baseline e migrations não foram alterados; a baseline existente foi apenas aplicada no novo banco exclusivo. Nenhum commit criado. Pendências transversais do roteiro preservadas.
