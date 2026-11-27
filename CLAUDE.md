@AGENTS.md

## Fluxo do architecture revamp

- A sessão principal do Claude Code atua como orquestradora do revamp: decide, revisa e emite os handoffs. Agentes de código executam um handoff aprovado por vez.
- Handoffs são entregues no chat, prontos para colar no agente. Nunca salve handoffs como arquivo no repositório.
- Decisões de arquitetura, novas dependências ou containers e a marcação `[x]` no roteiro (`architecture-revamp/ARCHITECTURE_REVAMP_ROADMAP.md`) ficam com o orquestrador e o usuário.

## Diagrama de fechamento de fase

Responsabilidade do orquestrador, não do agente de código. Depois de revisar e aprovar o último step de uma fase:

1. Leia o código entregue na fase e os resumos em `architecture-revamp/NN-<fase>/`. Desenhe o que foi implementado, não o plano original: um mecanismo aplicado em uma única camada aparece só nessa camada.
2. Escolha o tipo pelo guia abaixo e use a skill `diagram-design`. Prefira um diagrama por fase; use dois (visão geral + detalhe) só se o conteúdo passar de 9 nós.
3. Use o estilo padrão da skill. O arquivo `.diagram-design` na raiz fixa `profile: default`, então não pergunte sobre personalização.
4. Salve em `docs/diagrams/fase-NN-<slug>.html` (por exemplo, `fase-08-cache.html`). Para um segundo diagrama, acrescente um sufixo como `-detalhe`.
5. Rode `scripts/self_check.py` e `scripts/verify_geometry.py` da skill. Nesta máquina o comando é `python`, não `python3`.
6. Liste o diagrama na tabela `Arquivo | Responsabilidade` do fechamento.

### Qual tipo de diagrama usar

| O que a fase precisa mostrar | Tipo da skill | Exemplo no projeto |
| --- | --- | --- |
| Troca de mensagens no tempo entre componentes, com caminhos alternativos (acerto/falha, sucesso/erro) | Sequence (até 5 participantes) | Cache-aside: leitura com hit e miss, gravação no banco e invalidação |
| Componentes e conexões num instantâneo, sem ordem temporal | Architecture | Visão geral da API, Redis, PostgreSQL, workers e frontend |
| A mesma topologia antes e depois de uma mudança estrutural | Architecture delta | Uma instância da API passando para várias atrás de um load balancer |
| Em quais camadas da aplicação um mecanismo foi aplicado | Layer stack | Timeout, retry, backoff e circuit breaker por camada (controller, service, client do provider) |
| Estados de uma entidade ou mecanismo, com transições e condições | State machine | Delivery, pedido, pagamento ou o circuit breaker (fechado, aberto, semiaberto) |
| Processo com responsabilidade dividida entre atores ou processos | Swimlane | Progressão assíncrona de deliveries (fase 7) |
| Decisão com ramificações | Flowchart | Classificar uma falha como transitória (retry) ou terminal |
| Onde cada coisa roda: hosts, containers, portas e réplicas | Deployment | Imagens de API, frontend e worker; health checks; ambientes |
| Fronteiras de confiança e caminhos permitidos ou bloqueados | Architecture (padrão secure paved road) | Autenticação, CORS, rate limiting e exposição de dados |
| Fluxo de dados com fila, capacidade finita ou gargalo | Data flow | Publicação e consumo de jobs com limite de concorrência |
| Etapas ordenadas de um processo operacional | Process ou Steps | Pipeline de CI: build, testes, migration e deploy |
| Tabelas, colunas e relacionamentos do banco | Database schema ou ER | Mudanças de schema, se uma fase alterar o modelo |

### Sugestão para as fases restantes

| Fase | Diagrama principal | Detalhe opcional |
| --- | --- | --- |
| 8 — Cache | Sequence do cache-aside (hit, miss, invalidação e cache indisponível) | Architecture mostrando onde o cache fica em relação à API e ao Redis da fila |
| 9 — Resiliência | Layer stack com os mecanismos aplicados em cada camada | State machine do circuit breaker ou sequence de uma chamada com timeout e retry |
| 10 — Escala horizontal | Architecture delta de uma instância para várias | Deployment com instâncias, load balancer, workers e conexões com o banco |
| 11 — Segurança e operação | Deployment dos ambientes e das imagens | Architecture com fronteiras de confiança, ou Process do pipeline de CI |
