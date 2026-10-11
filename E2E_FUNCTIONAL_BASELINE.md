# Baseline funcional E2E — fase 3

## Identificação da execução

- Data: 09/10/2026.
- Commit-base: `b00fa86b748b2b704e726661f1e8b45000a9fcd1` (`Added e2e testing infra`).
- A árvore de trabalho já continha alterações locais da correção final da 3.2
  (ponte DELETE, testes do proxy/pagamento e registros da 3.2). Elas foram
  preservadas; esta baseline descreve a árvore efetivamente testada, não um
  checkout limpo desse commit.

## Toolchain observada

| Componente | Versão usada |
|---|---|
| Node.js | `v24.21.0` |
| npm | `11.19.0` |
| PostgreSQL | `16.15` (`postgres:16-alpine`) |
| Playwright | `1.63.0` (`@playwright/test`, lockfile do frontend) |
| Chromium | `153.0.8010.12` (Playwright revision `1243`) |

## Ambiente e fixtures

As instruções operacionais, comandos de instalação/execução, recuperação,
relatórios e isolamento estão centralizados no [README E2E](nextjs-frontend/e2e/README.md).
O alvo exclusivo é `127.0.0.1:5434/marketplace_e2e`, com o serviço
`postgres-e2e` em container e armazenamento tmpfs. A primeira rodada partiu com
esse container parado; o runner o iniciou e aplicou a baseline existente
`20260910120000_schema_v2_baseline`. Nenhuma migration foi criada.

As fixtures são determinísticas e criadas pela própria suíte: CUSTOMER, dois
SELLERs e seus perfis, cinco produtos com inventários (incluindo um indisponível
e outro de seller distinto), dois endereços, uma Order/SellerOrder e um item.
Cada teste limpa antes de preparar seus dados e limpa/verifica as tabelas de
negócio ao terminar. Não se usa seed de desenvolvimento, conta real, cookie
persistido nem sessão reaproveitada.

## Jornadas e resultados

Foram executados os mesmos 12 cenários completos em duas rodadas consecutivas:

| Área | Cenários |
|---|---:|
| Auth | 3 |
| Carrinho | 2 |
| Catálogo | 2 |
| Checkout | 2 |
| Pagamento | 1 |
| Seller/inventário/pedido | 2 |
| **Total por rodada** | **12/12 aprovados** |

A primeira rodada foi iniciada do container E2E parado e terminou com 12/12;
a segunda também terminou com 12/12. As fixtures foram recriadas e as asserções
de teardown de cada cenário confirmaram a ausência de registros de negócio. O
relatório JSON da segunda rodada registrou `76.7 s`; a saída Playwright observou
cerca de `1.3 min` na primeira. Esses tempos são apenas duração destas execuções
funcionais e não constituem benchmark de desempenho.

As jornadas cobrem login CUSTOMER/SELLER, cookie HttpOnly, refresh/logout e
acesso protegido; filtros, paginação e disponibilidade de catálogo; mutações e
estoque insuficiente no carrinho; checkout, snapshot e replay idempotente após
perda real da resposta; pagamento integral e persistência da captura simulada;
produtos/inventário SellerOrder e ownership de seller. A remoção de item retorna
204 e deixa o carrinho sem itens. O refresh do pagamento recebe GETs 200 e
mantém `PaymentAttempt=CAPTURED`, `Order=CONFIRMED`, um único attempt e um
histórico de confirmação.

O runner compilou o backend e aplicou migrations sem pendências na segunda
rodada. Após as execuções, as portas `3100` (Next) e `8100` (backend) estavam
fechadas, confirmando o encerramento dos processos Playwright. O container E2E
foi parado ao final sem remoção; o container de desenvolvimento na porta 5433
permaneceu em execução e não foi acessado nem limpo.

## Relatórios e limites

O relatório HTML e `test-results/results.json` são gerados sob
`nextjs-frontend/playwright-report` e `nextjs-frontend/test-results`; ambos são
ignorados pelo Git. Screenshots/traces são produzidos em falhas e podem conter
cookies temporários, portanto não são versionados nem compartilhados sem revisão.

Esta baseline comprova somente as jornadas explicitamente listadas. Não cobre
toda a aplicação, testes de concorrência em escala, carga, gateway de pagamento
real, transportadora ou ambiente de produção. A captura é acionada pelo helper
de teste através do fluxo interno do simulador; não existe endpoint público de
captura.
