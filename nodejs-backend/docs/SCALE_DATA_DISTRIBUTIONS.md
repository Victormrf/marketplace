# Distribuições e relacionamentos — etapa 4.2

Regras de experimento em `config/scale-profiles.json`, compartilhadas pelos três perfis. Não são estatísticas do mercado. Esta etapa configura e valida contagens; não gera objetos, acessa bancos ou provisiona serviços. Seed `410401` e data-base `2026-01-01T00:00:00.000Z` permanecem fixas.

## Bases das proporções

| Grupo | Base e regra |
|---|---|
| Concentração de sellers | 20% dos sellers recebem 60% dos produtos e 60% das SellerOrders; o restante é distribuído entre os outros sellers. |
| Popularidade | Em cada seller, 10% dos seus produtos recebem 70% das linhas de OrderItem, não 70% da receita ou das unidades. Esses produtos pertencem ao grupo com reservas. |
| Compras repetidas | Entre todos os customers: 10% sem compras, 30% com exatamente uma e 60% com pelo menos duas. Após uma compra por customer do segundo grupo, todas as Orders restantes são atribuídas ao grupo repetido. |
| Carrinhos | Entre os carrinhos explicitamente previstos: 60% ACTIVE e 40% ABANDONED. CONVERTED tem zero: são snapshots de carrinhos atuais/abandonados; o perfil não pretende preservar todos os carrinhos históricos usados para criar Orders. Não há FK entre Cart e Order. |
| Orders pagas | Captura integral em 70%/75%/80% das Orders de small/medium/large, respectivamente. Mantidas as exceções já previstas em 4.1. O restante permanece PENDING_PAYMENT. |
| Pagamentos ainda não capturados | Na tentativa final de cada Order não paga: CREATED 40%, PROCESSING 20%, AUTHORIZED 20%, FAILED 10%, CANCELLED 10%. Uma falha não cancela a Order. |
| Retries | Contagem de eventos, não probabilidade: `paymentAttempts - orders` tentativas extras (150/2.500/15.000), no máximo uma por Order paga. A tentativa anterior termina FAILED em 80% e CANCELLED em 20%; a tentativa final captura integralmente. |
| Estoque | Entre produtos: 10% sem estoque físico/reserva; 15% sem reserva e disponibilidade 1–3; 30% com reserva positiva e disponibilidade 0–3; 45% sem reserva e disponibilidade pelo menos 4. Todas as linhas históricas de compra usam o grupo reservado. |
| Refunds | Contagem: capturas × `refundsPerCapturedAttemptAverage` (105/1.350/8.000), não fração das Orders. Entre os refunds: REQUESTED 10%, PROCESSING 10%, COMPLETED 60%, DECLINED 10%, FAILED 10%. No máximo dois por pagamento, cada valor positivo até 25% do capturado. |
| Reviews | Alvos quantitativos herdados de 4.1 usam todas as Orders como base de contagem. A elegibilidade usa exclusivamente SellerOrders DELIVERED: selecionar pares únicos autor/produto ou autor/seller dentre compras entregues, nunca preencher a meta com compras não entregues. Ratings 1/2/3/4/5: 5%/10%/15%/30%/40%. |

As proporções acima são quotas de **estado final**. Retries são eventos planejados em quantidade, anteriores à tentativa final. A única probabilidade de evento configurada é replay de checkout (10% das Orders): repetir a mesma chave/endereço não adiciona registros físicos. Ela não entra na soma de estados nem altera `totalRows`.

## Cenários relacionados de SellerOrder

A base é **SellerOrders de Orders pagas**, com a mesma média de sellers por Order nas duas populações paga/não paga. Nas não pagas, todas as SellerOrders permanecem PENDING e não têm Delivery. Os cenários pagos são:

| Fração | SellerOrder final | Delivery final | Histórico de SellerOrder / Delivery (inclui entrada inicial) |
|---:|---|---|---:|
| 20% | CONFIRMED | ausente | 2 / 0 |
| 10% | PROCESSING | SEPARATED | 3 / 1 |
| 10% | PROCESSING | PROCESSING | 3 / 2 |
| 10% | SHIPPED | SHIPPED | 4 / 3 |
| 5% | SHIPPED | COLLECTED | 4 / 4 |
| 5% | SHIPPED | ARRIVED_AT_CENTER | 4 / 5 |
| 35% | DELIVERED | DELIVERED | 5 / 6 |
| 3% | PROCESSING | FAILED, após PROCESSING | 3 / 3 |
| 2% | RETURNED | RETURNED, após DELIVERED | 6 / 7 |

As sequências completas estão em `distributions.sellerOrders.scenarios`. Não sortear estados de Order, SellerOrder, PaymentAttempt e Delivery independentemente. Derivar histórico, timestamps e estado final do cenário escolhido.

**Limite atual dos services:** a máquina pública de SellerOrder só permite PENDING → CONFIRMED → PROCESSING, com Order CONFIRMED. SHIPPED/DELIVERED/RETURNED são snapshots históricos a materializar deliberadamente pelo futuro gerador isolado, como fixtures, e não promessas de transições públicas. Isso permite preparar consultas de reputação/receita sem alterar a aplicação. Delivery continua independente. A Order paga permanece CONFIRMED, inclusive em cenários entregues; não fabricar conclusão agregada ou cancelamento.

## Invariantes para a 4.3

- `User` separado para cada CustomerProfile/Seller; e-mails normalizados únicos e referências de produto únicas por seller. Apenas URLs/referências de imagens.
- Distribuir produtos dentro de cada seller antes de selecionar itens; `Product.sellerId = SellerOrder.sellerId`. Uma SellerOrder por `(orderId, sellerId)`; produtos distintos por carrinho/compra. Respeitar os máximos de sellers e linhas definidos no perfil. As quotas de concentração cedem apenas por impossibilidade de unicidade/capacidade, nunca silenciosamente: registrar desvio ou recusar a carga.
- Dinheiro inteiro em centavos, BRL, preços sintéticos pelo menos 100 centavos e valores dentro de Int PostgreSQL. `lineTotalInCents = quantity * unitPriceInCents`; SellerOrder soma suas linhas; Order soma suas SellerOrders. Shipping/tax/discount inicialmente zero. Snapshots capturam nome/referência/preço do momento da compra e o endereço estruturado, sem recomputar pelo catálogo atual.
- Cada PaymentAttempt cobra exatamente `Order.totalInCents` e usa sua moeda. No máximo uma ativa (CREATED/PROCESSING/AUTHORIZED) e uma CAPTURED por Order. Tentativa extra é retry sequencial depois de FAILED/CANCELLED; referências do simulador estáveis por attempt e únicas por provider. Falha definitiva permite retry; resultado desconhecido permanece ativo e bloqueia nova tentativa. Os cenários de erro desconhecido podem usar CREATED/PROCESSING, sem marcar FAILED indevidamente.
- Refund somente após captura e referência original disponível; REQUESTED/PROCESSING/COMPLETED comprometem saldo, DECLINED/FAILED não. Valores arredondados para baixo em centavos, positivos; soma comprometida ≤ capturado. A regra conservadora de dois refunds até 25% também limita o total solicitado a 50%. COMPLETED preenche apenas completedAt; FAILED preenche failedAt; DECLINED não preenche nenhum dos dois. Refund não altera automaticamente Order, SellerOrder ou estoque.
- Delivery única por SellerOrder. Criar seu histórico com null → SEPARATED quando a SellerOrder já estiver em condição compatível; seguir a máquina real da Delivery, incluindo FAILED/RETURNED. `deliveredAt` nasce ao entrar em DELIVERED e continua preservado depois de RETURNED. Tracking não cria histórico. Reviews somente após compra com SellerOrder DELIVERED; um alvo por review, rating 1–5, autor CUSTOMER, unicidade autor/alvo. Reservar explicitamente pares elegíveis distintos para atingir as metas; se faltarem, recusar e relatar, sem duplicar reviews.
- Uma Inventory por produto e uma InventoryReservation por OrderItem. No comportamento atual, checkout reserva e captura/Delivery não confirmam nem liberam reservas: os cenários conservam ACTIVE; não inventar SALE_COMMIT/RELEASE/RETURN. `reservedQuantity = soma das quantidades ACTIVE`, `availableQuantity = onHandQuantity - reservedQuantity ≥ 0`. Fazer reposições antes das reservas, com estoque suficiente para todas as quantidades. Cada RESERVATION tem onHandDelta=0 e reservedDelta=quantity; movimentos extras RESTOCK/MANUAL_CORRECTION mantêm os saldos válidos em cada passo, e o saldo final é a soma dos deltas desde zero. Produtos sem estoque físico não recebem OrderItems históricos nesse recorte. A carga deve validar tanto saldos finais quanto valores After em todos os movimentos.
- Datas dentro de 365 dias a partir da base fixa; eventos separados por pelo menos 60 segundos e sequências que cabem na janela. Reservas após checkout; captura após autorização, confirmação da Order na captura; operações de seller após confirmação; entrega após envio; reviews após entrega; refund após captura. Delivery usa entrada do status no histórico (4 h para sair de SEPARATED e 24 h para os demais passos normais), sem usar updatedAt como relógio. O último histórico corresponde ao status atual; null somente na entrada inicial. Histórico empatado usa id como desempate estável.
- Uma CustomerAddress ativa default por customer; extras não default. Uma OrderAddress por Order. No máximo um Cart ACTIVE por customer e produto distinto em cada CartItem; ABANDONED tem abandonedAt, ACTIVE não tem convertedAt. Uma IdempotencyKey COMPLETED por Order, pertencente ao seu User customer, operação CHECKOUT_V1, fingerprint/endereço corretos, resultado contendo o DTO do checkout original. Replays não criam chaves; falhas com rollback não deixam PROCESSING. expiresAt é metadado, não gatilho de limpeza automática.

As reservas ACTIVE mesmo em compras históricas entregues refletem uma limitação explícita do fluxo atual. O checkout define expiresAt após 15 minutos; reservas históricas podem continuar ACTIVE com essa data passada porque não existe expiração automática nesse fluxo. Não alterar datas/status para esconder essa condição. Qualquer dataset que represente confirmação/liberação de estoque exigirá uma decisão separada; 4.3 não deve corrigir regras de negócio durante a carga.

## Arredondamento e compatibilidade

Médias da 4.1 usam `Math.round`. Categorias exclusivas usam maiores restos: piso de cada quota e distribuição do resto por parte fracionária decrescente, com empate pela ordem declarada. Assim a soma é sempre a base. Grupos de concentração usam teto, mínimo um; perfis pequenos podem ter categorias com zero registros. Não forçar todas as categorias a aparecer nem exceder o total. Popularidade tem base local por seller; estoque tem quotas globais, a distribuir entre sellers preservando os totais, sem re-arredondar cada catálogo de forma independente. Selecionar membros em ordem determinística pela seed/IDs, sem implementar isso nesta etapa.

As estimativas de entregas e históricos foram corrigidas: antes eram médias independentes, inclusive entregas acima da população elegível. Agora incluem a entrada inicial e cada passo do cenário:

SellerOrders por Order e linhas por SellerOrder devem usar contagens inteiras entre um e o máximo do perfil, distribuindo pisos/tetos da média até atingir o total planejado. Dividir também a população paga/não paga mantendo a mesma média e os limites; não sortear essas quantidades sem reconciliar os totais. A reprodutibilidade futura depende de registrar perfil, seed, versão da configuração e versão do gerador, com IDs e ordem de seleção determinísticos.

| Perfil | Orders pagas | SellerOrders pagas / entregues | Deliveries | Históricos Order / SellerOrder / Delivery | Total físico | Teto de registros |
|---|---:|---:|---:|---:|---:|---:|
| small | 700 | 980 / 343 | 784 | 1.700 / 4.106 / 3.314 | 30.349 | 50.000 |
| medium | 7.500 | 12.000 / 4.200 | 9.600 | 17.500 / 49.120 / 40.560 | 403.330 | 500.000 |
| large | 40.000 | 72.000 / 25.200 | 57.600 | 90.000 / 288.720 / 243.360 | 2.176.580 | 2.500.000 |

Contagens principais, médias de itens/sellers por Order, users, addresses, pagamentos, refunds, reviews, reservas, movimentos, seed/data-base e limites permanecem. `paidSellerOrders`, `deliveredSellerOrders` e `capturedPaymentAttempts` são indicadores, não linhas adicionais. Metas de review cabem até usando apenas uma oportunidade por SellerOrder entregue; o gerador deverá garantir pares únicos e propriedade correta, não apenas limites teóricos.

## Dois exemplos concretos (planejamento, nenhum registro criado)

**Compra entregue:** customer compra 2 unidades de um produto de 1.000 centavos e 1 unidade de outro de 3.000, do mesmo seller. Uma Order e uma SellerOrder totalizam 5.000 BRL em centavos; duas linhas guardam os snapshots e uma OrderAddress guarda o endereço. Um PaymentAttempt de 5.000 segue CREATED → PROCESSING → AUTHORIZED → CAPTURED. A Order segue PENDING_PAYMENT → CONFIRMED (2 históricos). O snapshot histórico do seller segue PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED (5 históricos), e sua Delivery segue as seis etapas até DELIVERED (6 históricos). As duas reservas continuam ACTIVE; se o primeiro produto tinha onHand=12, fica reserved=2 e available=10. Depois da entrega, reviews distintas podem avaliar um produto e o seller. Um refund opcional de 1.000 pode terminar COMPLETED sem mudar os estados ou o inventário.

**Falha de pagamento:** mesma compra de 5.000 cria Order PENDING_PAYMENT, SellerOrder PENDING, endereço snapshot, reservas ACTIVE e movimentos RESERVATION. Uma tentativa integral segue CREATED → PROCESSING → FAILED, com failedAt e código seguro; Order e SellerOrder têm somente seus históricos iniciais, sem Delivery/review/refund. Um retry posterior, se previsto, usa outro attempt/referência e os mesmos 5.000, nunca uma parcela. Só uma captura bem-sucedida o move ao cenário pago.

## Execução futura obrigatória na 4.3

1. **Primeiras cargas exclusivamente com small.** Medir small; medium e large exigem autorização posterior explícita. Não avançar automaticamente nem interpretar esta etapa como autorização de carga.
2. Provisionar somente ambiente exclusivo `marketplace_scale`, separado de dev/E2E/produção; verificar destino autorizado por host, porta, banco e identificação do ambiente antes de escrever/limpar. Não reaproveitar limpeza E2E, não iniciar carga/limpeza no startup.
3. Orçamento total 5–10 GB de ambiente (dados, índices, WAL e temporários), com margem livre e interrupção controlada por registros, tempo e armazenamento. Parar no alvo de 5 GiB antes de se aproximar do teto rígido de 10 GiB; verificar espaço restante também durante lotes. Tamanhos previstos continuam hipóteses até medição.
4. Relatar registros por tabela, total, duração e armazenamento antes/depois. Separar `pg_database_size` da ocupação do ambiente, que inclui WAL/temporários/volume. Identificar container, banco, volume ou bind mount, caminho interno e localização no host quando identificável. Em Docker Desktop, volume pode residir no disco virtual; explicar essa condição sem inventar uma pasta Windows ou atribuir todo o disco compartilhado exclusivamente à escala.
5. Definir procedimento de limpeza restrito ao destino de escala confirmado, com ordem das FKs e verificação posterior. Interrupção deve deixar execução identificável para recuperação/limpeza controlada, preservando dev/E2E/produção.

Validação sem banco, na pasta do backend: `npm.cmd run test:scale-profiles` e `npm.cmd run test:scale-distributions`. Testes fazem apenas aritmética de quotas e leitura de configuração/schema; não são o gerador da 4.3.
