# Marketplace — roteiro da próxima fase do revamp

Última atualização: 30/09/2026
Estado atual: **2.6E e 2.8 concluídas; validação integrada final da 2.7 permanece pendente**

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
- [x] 2.2 Migrar autenticação, sessão e perfis de customer/seller usando a ponte de mesma origem no navegador. Validar em navegador real login, cookie HttpOnly, `/users/me`, perfil após refresh, logout, acesso protegido e respostas 401/403; validar proteção/cache das rotas intermediárias localmente.
- Revisão da decisão 2.1: adotar o fluxo principal `Componente → hook opcional → service → lib/http.ts → app/api → backend`. Perfil autenticado nesta fatia é carregado pelo navegador; SSR autenticado fica adiado até uma tela justificar. Ver a seção “Revisão da decisão arquitetural” em `FRONTEND_PHASE_2_1_MIGRATION_MAP.md`.
- Validação local em navegador real (26/09/2026): login CUSTOMER e SELLER, cookie de sessão não legível por `document.cookie`, `/users/me`, perfil após refresh, edição de user/perfil, logout, acesso direto a `/profile` sem sessão (redireciona para login), credenciais inválidas e resposta 403 para ação de CUSTOMER sem permissão. Foi corrigida uma incompatibilidade comprovada: GET `/customers` e `/sellers` responde `{ profile: DTO }`; os services agora extraem `profile`, e os dados de telefone/nome da loja/descrição aparecem corretamente. `npx tsc --noEmit`, `next build` e `test:auth` (18/18) passaram; smokes HTTP locais também passaram. Limite conhecido, não bloqueante para a migração local: o hostname e a conectividade de `BACKEND_API_URL` no runtime Next de produção (DNS, rota/egress e TLS) ainda não foram verificados; validar na preparação do deploy (fase 11).
- [x] 2.3 Migrar catálogo, filtros paginados, detalhes e disponibilidade; migrar criação/edição de produtos e inventário do seller.
- [x] 2.4 Migrar endereços e carrinho, preservando ownership e mensagens de indisponibilidade.
- Validação local em navegador real (26/09/2026): CUSTOMER criou dois endereços, trocou o default, editou e desativou endereço; tentativa de outro customer em endereço alheio recebeu 404. Carrinho v2 validado com inclusão pelo catálogo, alteração de quantidade, persistência após navegação/refresh, remoção e limpeza; insuficiência de estoque foi exibida após ajuste de inventário. SELLER recebeu 403 ao consultar carrinho e manteve sua sessão; sem sessão, a tela pede login e a API responde 401. Fixtures locais foram removidos e verificados. `npx tsc --noEmit`, `npm run build`, `test:addresses` (12/12) e `test:cart` (5/5) passaram.
- Limite mantido da 2.4: carrinho anônimo legado não é importado nem enviado ao checkout. O fluxo autenticado de checkout schema-v2 está sendo integrado na 2.5; pagamento permanece na 2.6.
- [x] 2.5 Integrar checkout idempotente, leitura de pedidos e SellerOrders conforme os contratos v2.
- Validação local em navegador (28/09/2026): CUSTOMER criou checkout e consultou o pedido persistido; resposta perdida simulada após commit foi recuperada após refresh com a mesma chave/endereço e retornou o mesmo pedido; concorrência com a mesma chave produziu 201/200 e um único pedido; endereço divergente retornou 409; estoque insuficiente retornou 409; pedido alheio retornou 404; ausência de sessão retornou 401; CUSTOMER recebeu 403 em SellerOrders; SELLER listou e abriu SellerOrder e recebeu 409 visível ao tentar PENDING → CONFIRMED enquanto a Order pai estava PENDING_PAYMENT. Rotas legadas redirecionaram sem criar pedidos. Fixtures foram removidas e a disponibilidade do inventário seed voltou a 10. O smoke adicional de 409 PROCESSING foi aprovado com refresh e retry: a mesma Idempotency-Key e o mesmo addressId foram reenviados; o registro temporário local foi removido e não houve criação de Order. `npx tsc --noEmit`, `npm run build`, `test:checkout` (15/15) e `test:orders` (14/14) passaram. A transição positiva de SellerOrder, dependente de Order CONFIRMED, permanece como validação integrada futura e não bloqueia o fechamento desta fatia.
- [x] 2.6A Pagamentos no frontend: criar/listar/consultar PaymentAttempt sem simular captura ou pagamento concluído.
- Validação local (28/09/2026): pedido PENDING_PAYMENT temporário permitiu iniciar uma tentativa PIX via UI; BFF preservou 201 e o POST enviou somente `{ method }`. Valor integral (56,00 BRL), `CREATED` e referência do simulador vieram da resposta real. GET da coleção e da tentativa individual responderam 200; refresh manteve exatamente uma tentativa e não enviou novo POST. Order/tentativa alheia retornaram 404, ausência de sessão 401, SELLER recebeu 403 sem perder a sessão, e mudança concorrente do pedido resultou em 409 exibido pela UI. Fixtures locais foram removidas e verificadas; nenhum estado seed foi alterado. `npx tsc --noEmit`, `npm run build` e `nodejs-backend/npm run test:payments` (14/14) passaram. Limite: o simulador deixa a tentativa em CREATED; captura/confirmação não possui ação pública e não foi simulada. Aguardar revisão antes de iniciar a próxima fatia.
- [x] 2.6B Refunds no frontend.
- Validação local (28/09/2026): customer consultou refunds por PaymentAttempt, criou um refund parcial pela UI (201), viu status COMPLETED, valor, motivo, timestamps e referência; refresh e consulta individual mantiveram o mesmo registro. Saldo excedido retornou 409 visível; payload inválido 400; sem sessão 401; SELLER 403; refund inexistente 404. Fixture de Order/PaymentAttempt capturado/refund foi removida e conferida vazia; dados seed não foram alterados. `npx tsc --noEmit`, `npm run build` e `test:refunds` (8/8) passaram. Nenhuma captura foi simulada no frontend.
- Ajuste de navegação (28/09/2026): o menu do customer possui um único link “Meus pedidos” para `/orders`; a rota provisória `/refunds` redireciona para `/orders`, onde refunds ficam no detalhe do pedido, por tentativa de pagamento.
- [x] 2.6C Deliveries e tracking no frontend: DTO e service v2, leitura individual por SellerOrder para customer, gestão de criação/tracking/transições para seller e rotas dedicadas na ponte Next. Smoke Playwright local: seller criou delivery, atualizou tracking e avançou status; customer consultou status/histórico e confirmou persistência após refresh. Customer sem sessão recebeu 401; escrita por customer recebeu 403; seller de outro perfil recebeu 404; transição obsoleta recebeu 409 e a UI recarregou o estado real. Fixture Order/SellerOrder/Delivery local foi removida e verificada. `npx tsc --noEmit`, `npm run build` e `test:deliveries` (13/13) passaram. Chamadas antigas do dashboard seller ainda geram 404 no console e permanecem fora do escopo da 2.6C.
- Correção pontual 2.6C (28/09/2026): campo `datetime-local` converte ISO/UTC para o fuso local e volta a ISO sem deslocar previsão inalterada; PATCH omite campo intacto e envia `estimatedDelivery: null` ao remover; motivo limitado a 255 caracteres. Playwright confirmou edição, payload UTC, remoção e persistência após refresh; fixture local removida e verificada. Type-check e build passaram.
- [x] 2.6D Reviews no frontend: leitura pública paginada e filtrada por produto/seller com reputação do endpoint; criação contextual no SellerOrder entregue; edição somente para review cujo ID foi criado e retido na sessão do customer. A rota provisória `/reviews` redireciona para `/orders`, sem criar listagem global.
- Validação local em navegador real (29/09/2026): customer criou reviews de produto e seller em uma compra entregue, editou a própria review e recuperou a edição após refresh; listagem pública mostrou reputação/distribuição, paginação do backend e filtro rating; tentativa duplicada 409, compra não entregue 403, edição por outro customer 403, seller/admin sem permissão 403 e sem sessão 401. `/reviews` encaminhou para `/orders`. Fixtures locais foram removidas e verificadas sem resíduos. `npx tsc --noEmit`, `npm run build` e backend `test:reviews` (10/10) passaram. Limitação observada no backend: POST sem a propriedade `comment` responde 400; o frontend envia `comment: null` quando vazio, sem alteração do backend.
- [x] 2.6E Dashboard de seller no frontend: métricas, gráficos, filtros temporais e SellerOrders migrados para os contratos schema-v2; seller é resolvido pelo backend e as oito leituras passam pela ponte same-origin.
- Validação local (29/09/2026): Playwright autenticou seller e verificou intervalo sem dados e período com a SellerOrder entregue do seed (R$ 40,00/4.000 centavos), alternância diário/mensal mantendo from/to, filtro de status e refresh. Para paginação, foram criadas 11 SellerOrders pendentes descartáveis: página 1 exibiu 10/11, página 2 exibiu 1/11 e o filtro foi enviado ao backend; fixtures foram removidas e a ausência dos IDs confirmada. Sem sessão, a tela bloqueou e a API respondeu 401; customer viu bloqueio de papel e a API respondeu 403. `npx tsc --noEmit`, `npm run build` e `test:dashboard` (7/7) passaram. O `storeId` da rota não é usado para autorização. Receita segue bruta, sem desconto de refunds.
- [~] 2.7 Limpeza de tipos/fluxos legados e validação das jornadas v2 nos três papéis.
- Limpeza confirmada (30/09/2026): removidos cinco arquivos de tipos sem consumidores, o tipo v1 `Product` sem consumidores e `DashboardHeader` abandonado. O menu não aponta mais para Favoritos/Clientes; essas páginas agora explicam que a funcionalidade não está disponível no backend. Redirecionamentos de `/refunds`, `/reviews` e rotas antigas de checkout/pagamento foram preservados. Não foram encontrados fetches de página diretamente ao backend: as chamadas permanecem no cliente HTTP, BFF ou handlers de sessão.
- Concorrência do dashboard: `nextjs-frontend npm run test:dashboard` passou 6/6. Os seis casos cobrem respostas de períodos fora de ordem, erros/loading obsoletos, dependências de status/página/intervalo, respostas concorrentes do gráfico, refresh que substitui requisições pendentes e invalidação/re-habilitação da consulta.
- Validação desta revisão da 2.7: type-check, build, `test:dashboard` (6/6) e `test:checkout` (2/2) passaram. A disponibilidade anterior impediu o smoke integrado; a revisão Playwright da 2.8 abaixo confirmou leituras principais nos três papéis, mas não repetiu todas as jornadas mutáveis e limpezas com fixtures. Portanto, a validação integrada completa da 2.7 continua pendente. Também foi observado um link de categoria da home que envia rótulo visual (`Office`) em vez do enum aceito pela API (`OFFICE`); corrigir na fatia de catálogo, fora da consolidação da ponte.
- [x] 2.8 Consolidar a ponte Next de API: o encaminhamento comum em `lib/server/route-proxy.ts` é usado por handlers dedicados e pela rota dinâmica, que mantém sua allowlist. Testes controlados passaram 10/10 para status/body (incluindo 409 e 204), cookies, JSON, multipart, origem, indisponibilidade, checkout/idempotência e PaymentAttempt/refunds. Type-check, build, `test:checkout` e `test:dashboard` passaram. Playwright local confirmou login por cookie HttpOnly, logout/401 e SELLER/403; CUSTOMER percorreu perfil, catálogo/detalhe/reviews, carrinho, checkout sem envio, pedido com payments/refunds/delivery; SELLER percorreu produtos, inventário, SellerOrders e dashboard; ADMIN recebeu 403 no dashboard seller. Nenhuma fixture ou mutação de domínio foi executada. Um filtro de categoria pela etiqueta visual `Office` retornou 400 por incompatibilidade já existente entre link e enum; a ponte preservou corretamente a resposta. Ver [mapa de integração](FRONTEND_PHASE_2_1_MIGRATION_MAP.md).

**Concluída quando:** as jornadas principais funcionam de ponta a ponta sem depender dos campos e da orquestração v1 no navegador.

**Fechamento da 2.1:** mapa de telas, chamadas e DTOs em [FRONTEND_PHASE_2_1_MIGRATION_MAP.md](FRONTEND_PHASE_2_1_MIGRATION_MAP.md). Decisão revisada em 24/09/2026 para simplificar a integração à ponte BFF no browser e remover a divisão client/server sem necessidade atual.

## Pendências transversais do revamp

- [ ] Recuperar reviews próprias sem depender de `sessionStorage`: definir no backend uma consulta autenticada e limitada ao customer atual para localizar sua review por produto ou seller; adaptar o frontend para carregar o ID persistido antes de oferecer criação/edição. Hoje, em outra aba, navegador ou dispositivo, a review existente não é descoberta e uma nova tentativa recebe 409. Validar ownership, ausência de review e atualização após refresh. Planejar após a conclusão da 2.7, sem ampliar o escopo atual.

**Fechamento da fase 2 (03/10/2026):** fase concluída por decisão do responsável. A validação integrada completa da 2.7 continua registrada como pendência transversal; esse fechamento administrativo não substitui essa validação.

## Fase 3 — Contratos e testes ponta a ponta

**Objetivo:** criar uma referência estável de comportamento antes dos experimentos de escala.

- [x] 3.1 Publicar contratos de API OpenAPI 3.0.3 para as rotas de negócio atuais: 53 caminhos e 71 operações; Swagger UI em `/docs` (assets CDN 5.33.1, Try it out e validador remoto desativados), restrito a ambiente não-production; `npm run validate:openapi` validou sintaxe, referências locais, parâmetros e contagem. Build, type-check e `test:db` (12/12) passaram; Playwright confirmou endpoints/schemas visíveis sem executar mutações. Resumo: [Etapa 3.1](STEP_3_1_API_CONTRACTS_SUMMARY.md).
- [~] 3.2 Cobrir com testes E2E as jornadas críticas: login, busca, carrinho, checkout, pagamento e consulta de pedido; incluir ao menos um fluxo de seller.
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

Fase 2.7: concluir o smoke integrado das jornadas v2 nos três papéis após iniciar PostgreSQL, backend e frontend locais. A consolidação 2.8 também aguarda smoke de regressão no mesmo ambiente. A conectividade de `BACKEND_API_URL` em produção segue como verificação de deploy na fase 11; SSR autenticado está adiado até uma tela justificar sua implementação.
