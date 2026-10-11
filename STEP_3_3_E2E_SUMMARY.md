# Etapa 3.3 — Ambiente E2E reproduzível e baseline funcional

## Resultado

A infraestrutura E2E da 3.2 foi consolidada sem criar outra suíte nem alterar
as jornadas. O README E2E reúne instalação, preparação, execução completa/alvo,
relatórios, isolamento e recuperação. Foi registrada uma baseline funcional com
toolchain, commit-base, fixtures e limitações.

## Validação

- A primeira rodada partiu de `postgres-e2e` parado; o runner iniciou o serviço,
  aplicou a migration baseline existente, compilou o backend e lançou Next e
  backend automaticamente.
- Rodada 1: 12/12; rodada 2: 12/12. Teardown confirmou a limpeza das fixtures.
- Next/backend encerrados após cada execução; ao final, somente o container E2E
  foi parado. Nenhum container ou volume foi removido.
- O banco autorizado foi exclusivamente `127.0.0.1:5434/marketplace_e2e`.
  `marketplace_dev` e produção não foram acessados nem limpos.
- Durações observadas: aproximadamente 1,3 min na primeira rodada e 76,7 s na
  segunda; não são métricas de performance.

Toolchain, composição das fixtures, lista das jornadas e limites estão em
[E2E_FUNCTIONAL_BASELINE.md](E2E_FUNCTIONAL_BASELINE.md). Os passos de operação
estão em [README E2E](nextjs-frontend/e2e/README.md). A captura de pagamento
usa o simulador interno; a suíte não substitui testes de concorrência em escala
nem valida integrações reais externas.
