# Handoff — Etapa 8.1: seleção do primeiro endpoint para cache

Emitido em 26/11/2026 pelo orquestrador de arquitetura do revamp.
Roteiro: [ARCHITECTURE_REVAMP_ROADMAP.md](../ARCHITECTURE_REVAMP_ROADMAP.md), Fase 8, item 8.1.

## 1. Seu papel nesta etapa

Você é o **agente de código no papel de analista técnico**. A 8.1 é uma etapa de
**decisão**, não de implementação.

- Você **investiga e propõe**. O orquestrador **decide**.
- Sua entrega é **um documento de proposta** e um relatório curto. Nenhum código
  de produção muda nesta etapa.
- A implementação do cache é a 8.2 e só começa depois que o orquestrador aprovar
  a proposta, num handoff próprio.

"Não recomendar cache agora" é um resultado válido. Se a evidência não
justificar nenhum endpoint, diga isso e explique por quê.

## 2. Objetivo

Propor **um único** endpoint de leitura para receber cache, com:

1. a evidência de que ele tem ganho mensurável;
2. o formato das chaves;
3. o TTL e a tolerância a dados desatualizados;
4. a regra de invalidação (quais escritas afetam a entrada);
5. o comportamento esperado quando o cache estiver indisponível;
6. a estratégia contra requisições simultâneas na falta de cache (*stampede*);
7. o plano de medição antes/depois para a 8.3.

## 3. Leitura obrigatória antes de começar

- `architecture-revamp/ARCHITECTURE_REVAMP_ROADMAP.md`: Fase 8 e seção
  "Próximo handoff".
- `nodejs-backend/docs/LOAD_BASELINE_ANALYSIS.md` e `LOAD_BASELINE_REPORT.md`:
  resultados e limites da fase 5.
- `architecture-revamp/06-observabilidade/STEP_6_2_BASIC_METRICS_SUMMARY.md` e
  `STEP_6_3_LOCAL_OBSERVABILITY_SUMMARY.md`: métricas e tracing que já existem.
- `nodejs-backend/docs/DELIVERY_QUEUE.md` e `docker-compose.delivery-queue.yml`:
  o Redis atual da fila.
- Controllers, services e repositories dos candidatos (seção 5).
- `AGENTS.md`: regras de formatação e formato do relatório final.

## 4. Limite de escopo

### Permitido

- Ler qualquer arquivo do repositório.
- Ler o código dos caminhos de escrita para mapear invalidações.
- Rodar `EXPLAIN` (sem `ANALYZE`) das consultas candidatas **somente** no banco
  local `marketplace_dev`, se ele já estiver de pé. Não suba containers só
  para isso.
- Rodar suítes de teste existentes, se ajudar a entender o comportamento atual.
- Criar **um único arquivo**:
  `architecture-revamp/08-cache/STEP_8_1_CACHE_SELECTION_PROPOSAL.md`.

### Proibido nesta etapa

- Alterar qualquer arquivo em `src/`, `tests/`, `load/`, `prisma/` ou `scripts/`.
- Instalar dependências ou alterar `package.json` e `package-lock.json`.
- Criar ou alterar arquivos `docker-compose*`, ou mudar a configuração de
  qualquer Redis, inclusive o da fila de deliveries.
- Rodar testes de carga, k6, `load:*` ou qualquer acesso a `marketplace_scale`.
  Uma nova rodada de carga exige autorização própria.
- Alterar schema, migrations ou seed.
- Marcar itens no roteiro, editar `ARCHITECTURE_REVAMP_ROADMAP.md` ou mover o
  `[~]`. Isso é responsabilidade do orquestrador.
- Fazer commit, push ou abrir PR.
- Começar a 8.2, mesmo que parcialmente ("só um esqueleto").

Se em algum momento parecer necessário sair desses limites, **pare e registre a
necessidade como pergunta** na proposta, em vez de agir.

## 5. Candidatos a avaliar

Avalie pelo menos estes, com referência de arquivo e linha:

| Candidato | Por que está na lista |
| --- | --- |
| `GET /products/:productIds` (detalhe) | Indicado pela baseline como o experimento a reaproveitar para cache. |
| `GET /products`, `/search`, `/category/:category`, `/seller/:sellerId` | Listagens públicas paginadas, potencialmente com alto volume de leitura. |
| `GET /products/:productId/reviews` (reputação e distribuição) | Leitura pública com agregação. |
| Dashboard summary do seller | Agregação medida na baseline; dado privado por seller. |

Você pode incluir outro candidato se o código justificar.

Para cada candidato, registre:

- se o dado é público ou depende do usuário ou papel;
- o custo da consulta (joins, agregações, plano do `EXPLAIN`, se disponível);
- a volatilidade: com que frequência e por quais escritas o dado muda;
- o risco de servir dado desatualizado.

## 6. Pontos de atenção obrigatórios

1. **Estoque e disponibilidade.** O checkout e a reserva de inventário devem
   continuar lendo o PostgreSQL. Se o endpoint escolhido expõe disponibilidade,
   diga exatamente o que pode ficar em cache, o que não pode e qual é a
   consequência de mostrar um estoque desatualizado na interface.
2. **Redis da fila.** O Redis de deliveries usa `noeviction` e `maxmemory`
   de 64 MiB. Não proponha compartilhá-lo com o cache sem tratar esse conflito.
   Compare as opções (instância dedicada, política de expiração, banco lógico
   separado) e recomende uma, sem implementar.
3. **Invalidação.** Liste cada caminho de escrita que afeta a entrada (service,
   método e arquivo). Diga se a invalidação acontece depois do commit e qual
   proteção o TTL oferece se uma invalidação falhar.
4. **Chaves.** Use prefixo versionado, parâmetros normalizados e nenhum dado
   pessoal na chave. Dados dependentes de sessão não podem cair em chave
   compartilhada.
5. **Evidência honesta.** A baseline tem 5 leituras por endpoint, no dataset
   `small` e em máquina compartilhada, e não declara gargalo. Separe o que foi
   medido do que é hipótese.

## 7. Estrutura esperada de `STEP_8_1_CACHE_SELECTION_PROPOSAL.md`

1. **Recomendação:** o endpoint escolhido, ou a recomendação de não fazer cache
   agora, em até 5 linhas.
2. **Comparação dos candidatos:** uma tabela com os critérios da seção 5.
3. **Desenho proposto:** chaves, TTL, invalidação, armazenamento,
   indisponibilidade e *stampede*.
4. **Plano de medição para a 8.3:** métricas (acertos, erros, latência, consultas
   evitadas), como reaproveitar o cenário de produto da fase 5 e as métricas da
   6.2, e o que exigiria autorização de carga.
5. **Riscos e custo de consistência.**
6. **Decisões reservadas ao orquestrador:** a lista do que precisa de aprovação
   antes da 8.2 (endpoint, tecnologia, nova dependência ou container, TTL).
7. **Perguntas em aberto.**

Mantenha o documento curto, objetivo e em português, no mesmo tom dos arquivos
`STEP_*_SUMMARY.md` existentes.

## 8. Critério de conclusão da 8.1

- A proposta existe e responde às sete partes da seção 7.
- `git status` mostra **apenas** o arquivo de proposta como novo, além deste
  handoff.
- O relatório final segue o `AGENTS.md`: a tabela `Arquivo | Responsabilidade`,
  as validações executadas e as limitações, separadas.

Depois da entrega, **pare**. O orquestrador revisa a proposta, registra a
decisão no roteiro e emite o handoff da 8.2.
