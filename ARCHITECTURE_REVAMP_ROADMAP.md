# Marketplace — roteiro da próxima fase do revamp

Última atualização: 25/09/2026  
Estado atual: **Fase 2.2 — autenticação, sessão e perfis**

## Objetivo

Evoluir o marketplace schema-v2, já implementado no backend, para uma aplicação completa e mensurável. Cada item abaixo deve ser executado em um handoff pequeno, validado e marcado antes de avançarmos. Este arquivo acompanha o trabalho futuro; o histórico detalhado do backend permanece em [BACKEND_REVAMP_PROGRESS.md](BACKEND_REVAMP_PROGRESS.md).

## Como acompanhar

- `[x]` concluído e validado;
- `[~]` em andamento ou próximo item a atacar;
- `[ ]` pendente;
- `[!]` exige correção antes de avançar.

Ao encerrar um item, registrar brevemente a evidência da validação, marcar `[x]`, mover `[~]` para o próximo item e atualizar a data no topo. Ao encerrar uma fase, acrescentar um resumo curto com o resultado, decisões e limites conhecidos. Ajustaremos a sequência se medições ou dependências reais justificarem isso, registrando a razão aqui. Handoffs e relatórios para o agente CLI devem ser curtos e focados no item atual.

## Fundação concluída

- [x] Schema-v2 normalizado, PostgreSQL local via Docker, migration, seed e testes de invariantes.
- [x] Backend adaptado ao schema-v2: catálogo, inventário, identidade, endereços, carrinho, checkout, pedidos, pagamentos, refunds, entregas, reviews e dashboard.
- [x] Suíte e fechamento do backend registrados em [BACKEND_REVAMP_PROGRESS.md](BACKEND_REVAMP_PROGRESS.md).

## Fase 1 — Interface manual da API

**Objetivo:** tornar o `nodejs-backend/api.http` uma ferramenta confiável para explorar os endpoints v2.

- [x] 1.1 Validar sintaxe e variáveis do REST Client; confirmar os três logins e o uso independente dos cookies por papel.
- [x] 1.2 Testar os fluxos principais em ordem, capturando IDs das respostas; identificar claramente IDs determinísticos do seed e requisições que alteram estado.
- [x] 1.3 Conferir cobertura dos endpoints com as rotas reais e corrigir exemplos incompatíveis. Registrar pré-requisitos e resultados esperados de cada fluxo.

**Concluída quando:** o arquivo não apresenta erros de sintaxe no cliente HTTP escolhido e os fluxos principais podem ser executados contra o banco local populado.

**Fechamento:** fase considerada concluída por confirmação do usuário em 23/09/2026; resultados de execução detalhados não foram anexados a este roteiro.

## Fase 2 — Frontend compatível com schema-v2

**Objetivo:** migrar a experiência existente em fatias verticais, com frontend e backend falando o mesmo contrato.

- [x] 2.1 Mapear telas, chamadas `fetch`, tipos e payloads legados; definir cliente HTTP e services por domínio, hooks apenas para estado e interações de componentes client, e acesso direto via service nas páginas/server components quando apropriado. Padronizar autenticação por cookie, erros e DTOs.
- [!] 2.2 Migrar autenticação, sessão e perfis de customer/seller usando o BFF de mesma origem no navegador. Validar em navegador real login, cookie HttpOnly, `/users/me`, perfil após refresh, logout, acesso protegido e respostas 401/403; confirmar configuração de produção e proteção/cache das rotas BFF.
- Revisão da decisão 2.1: adotar o fluxo principal `Componente → hook opcional → service → lib/http.ts → app/api → backend`. Perfil autenticado nesta fatia é carregado pelo navegador; SSR autenticado fica adiado até uma tela justificar. Ver a seção “Revisão da decisão arquitetural” em `FRONTEND_PHASE_2_1_MIGRATION_MAP.md`.
- Validação local em navegador real (26/09/2026): login CUSTOMER e SELLER, cookie de sessão não legível por `document.cookie`, `/users/me`, perfil após refresh, edição de user/perfil, logout, acesso direto a `/profile` sem sessão (redireciona para login), credenciais inválidas e resposta 403 para ação de CUSTOMER sem permissão. Foi corrigida uma incompatibilidade comprovada: GET `/customers` e `/sellers` responde `{ profile: DTO }`; os services agora extraem `profile`, e os dados de telefone/nome da loja/descrição aparecem corretamente. `npx tsc --noEmit`, `next build` e `test:auth` (18/18) passaram; smokes HTTP locais também passaram. A 2.2 permanece `[!]` somente pela pendência de produção: `BACKEND_API_URL` é lida por `process.env` nos Route Handlers em runtime (não é `NEXT_PUBLIC_*` nem está fixada no build), mas o hostname de backend e a conectividade a partir do processo Next de produção (DNS, rota/egress e TLS) ainda não foram fornecidos ou verificados.
- [ ] 2.3 Migrar catálogo, filtros paginados, detalhes e disponibilidade; migrar criação/edição de produtos e inventário do seller.
- [ ] 2.4 Migrar endereços e carrinho, preservando ownership e mensagens de indisponibilidade.
- [ ] 2.5 Migrar checkout para a operação transacional e idempotente do backend; atualizar pedidos, SellerOrders e seus estados.
- [ ] 2.6 Migrar pagamento, refund, delivery, reviews e dashboard de seller conforme os contratos v2 existentes.
- [ ] 2.7 Remover tipos e fluxos legados; revisar build e jornadas manuais completas nos três papéis.

**Concluída quando:** as jornadas principais funcionam de ponta a ponta sem depender dos campos e da orquestração v1 no navegador.

**Fechamento da 2.1:** mapa de telas, chamadas e DTOs em [FRONTEND_PHASE_2_1_MIGRATION_MAP.md](FRONTEND_PHASE_2_1_MIGRATION_MAP.md). Decisão revisada em 24/09/2026 para simplificar a integração à ponte BFF no browser e remover a divisão client/server sem necessidade atual.

## Fase 3 — Contratos e testes ponta a ponta

**Objetivo:** criar uma referência estável de comportamento antes dos experimentos de escala.

- [ ] 3.1 Publicar contratos de API legíveis, preferencialmente OpenAPI, com payloads, respostas, autenticação, paginação e erros.
- [ ] 3.2 Cobrir com testes E2E as jornadas críticas: login, busca, carrinho, checkout, pagamento e consulta de pedido; incluir ao menos um fluxo de seller.
- [ ] 3.3 Definir ambiente de teste reproduzível, dados conhecidos e uma baseline funcional registrada.

**Concluída quando:** mudanças de contrato quebram testes de forma clara e as jornadas prioritárias são reproduzíveis.

## Fase 4 — Dados sintéticos em escala

**Objetivo:** produzir cargas realistas e reproduzíveis sem prejudicar o banco de desenvolvimento cotidiano.

- [ ] 4.1 Definir perfis `small`, `medium` e `large`, contagens, seed aleatória fixa e limites de execução.
- [ ] 4.2 Modelar distribuição desigual de sellers, produtos populares, compras repetidas, carrinhos abandonados, falhas de pagamento, pressão de estoque, entregas, refunds e reviews.
- [ ] 4.3 Gerar e inserir em lotes; medir duração e volume; validar invariantes e relações depois da carga.

**Concluída quando:** o mesmo perfil gera cenários comparáveis, com contagens e tempo de geração documentados.

## Fase 5 — Testes de carga e baseline

**Objetivo:** localizar gargalos com números antes de otimizar.

- [ ] 5.1 Escolher ferramenta, ambiente e cenários de leitura/escrita: catálogo, produto, carrinho, checkout concorrente, pagamento e dashboard.
- [ ] 5.2 Medir throughput, latências p50/p95/p99, erros, conexões, CPU/memória e consultas lentas; registrar tamanho do dataset e concorrência.
- [ ] 5.3 Produzir um relatório curto com os principais gargalos e hipóteses para a fase seguinte.

**Concluída quando:** existe uma execução reproduzível que permita comparar antes e depois de cada ajuste.

## Fase 6 — Observabilidade

**Objetivo:** entender cada requisição e job durante falhas e testes de carga.

- [ ] 6.1 Adicionar logs estruturados e request/correlation ID, com cuidado para não registrar segredos.
- [ ] 6.2 Instrumentar métricas HTTP, PostgreSQL, filas/jobs e indicadores de negócio relevantes.
- [ ] 6.3 Adicionar tracing, health/readiness checks e painéis locais; repetir um cenário da baseline para verificar a visibilidade.

**Concluída quando:** um erro ou lentidão pode ser rastreado da entrada HTTP até banco, job ou integração correspondente.

## Fase 7 — Filas e workers

**Objetivo:** mover trabalho adequado para execução assíncrona com segurança.

- [ ] 7.1 Selecionar o primeiro caso concreto, começando pelo job de delivery já separado do servidor HTTP; definir o contrato do job e seu ciclo de vida.
- [ ] 7.2 Executar worker independente com fila, retries, backoff, limites de concorrência e tratamento de falhas persistentes.
- [ ] 7.3 Garantir idempotência do consumidor e publicação confiável quando houver alteração de banco seguida de envio à fila, avaliando outbox no caso real.
- [ ] 7.4 Expandir gradualmente para notificações, reconciliação ou relatórios somente após validar o primeiro caso.

**Concluída quando:** reinícios, duplicatas e falhas de worker não produzem efeitos de negócio duplicados ou perda silenciosa de trabalho.

## Fase 8 — Cache

**Objetivo:** reduzir o custo dos caminhos de leitura identificados na baseline.

- [ ] 8.1 Escolher um endpoint com ganho mensurável e estabelecer chaves, TTL e regra de invalidação.
- [ ] 8.2 Implementar cache-aside com comportamento definido para indisponibilidade do cache e contenção de requisições simultâneas.
- [ ] 8.3 Medir acertos, erros, latência e carga no banco antes/depois; expandir apenas para novos casos justificados.

**Concluída quando:** o ganho e o custo de consistência do cache estão medidos e documentados.

## Fase 9 — Resiliência de integrações

**Objetivo:** exercitar falhas de provedores externos sem duplicar efeitos financeiros.

- [ ] 9.1 Criar cenários controlados no provider simulado: lentidão, recusa definitiva, timeout e resultado desconhecido.
- [ ] 9.2 Aplicar timeout, retry seletivo, backoff e circuit breaker onde o comportamento do provider permitir.
- [ ] 9.3 Validar idempotência e reconciliação de pagamentos/refunds sob respostas ambíguas; medir falhas e recuperação.

**Concluída quando:** cada tipo de falha tem resposta, recuperação e teste reproduzíveis.

## Fase 10 — Escalabilidade horizontal

**Objetivo:** executar múltiplas instâncias sem quebrar sessão, consistência ou jobs.

- [ ] 10.1 Verificar ausência de estado local indispensável na API e dimensionar conexões com o banco.
- [ ] 10.2 Subir duas ou mais instâncias da API atrás de um load balancer; validar autenticação, checkout e rate limiting.
- [ ] 10.3 Executar workers concorrentes; testar reinícios, graceful shutdown e falha de uma instância durante carga.
- [ ] 10.4 Comparar resultados com a baseline, identificando o próximo limite de escala.

**Concluída quando:** a aplicação mantém resultados corretos e disponibilidade com instâncias concorrentes e falhas controladas.

## Fase 11 — Segurança e operação

**Objetivo:** tornar execução e entrega repetíveis em ambientes distintos.

- [ ] 11.1 Organizar variáveis de ambiente e secrets para dev, teste e produção; revisar autenticação, CORS, rate limiting e exposição de dados.
- [ ] 11.2 Criar imagens e configuração de execução para API, frontend e worker; definir health checks e migração em deploy.
- [ ] 11.3 Adicionar CI para build, testes e validação de migration; preparar homologação, backup e procedimento de recuperação.
- [ ] 11.4 Documentar deploy e operação; executar smoke test após entrega.

**Concluída quando:** uma mudança pode ser validada, implantada e recuperada por um procedimento documentado.

## Próximo handoff

Fase 2.2: jornada de login, sessão, perfil e erros validada no navegador local; resta obter e testar o hostname e a conectividade de `BACKEND_API_URL` a partir do runtime Next de produção. SSR autenticado está adiado até uma tela justificar sua implementação.
