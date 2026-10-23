# Planejamento dos testes de carga — 5.1

## Decisão e alcance

Ferramenta: **k6 1.3.0 local**, sem cloud, navegador ou plataforma de observabilidade. Oferece VUs, executores com iterações finitas, cookies/headers, checks, percentis e thresholds sem dependências npm. Versão fixada para reprodução, não por ser a mais recente. Artillery seria viável, mas acrescentaria dependências Node; Playwright permanece E2E funcional, não gerador de carga desta baseline.

Referências oficiais: [instalação](https://grafana.com/docs/k6/latest/set-up/install-k6/), [release fixada](https://github.com/grafana/k6/releases/tag/v1.3.0), [iterações compartilhadas](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/shared-iterations/), [thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/). `shared-iterations` limita o total, mas não divide trabalho igualmente entre VUs. Não é um teste de taxa de chegada fixa.

Nesta etapa foram preparados configuração, runner GET e validações estáticas. **Não foram iniciados API, sessões, consultas de banco, geração, purge ou teste real.** Escritas possuem matriz/contratos, mas são recusadas pelo runner; sua implementação só será liberada na 5.2 após fixtures/recuperação aprovadas. Não há scripts que falsifiquem captura ou sucesso financeiro.

## Ambiente isolado

- API Express compilada em **processo próprio, porta 8051**, somente `marketplace_scale` em `127.0.0.1:5435`. Não alterar `.env` ou reiniciar a API de desenvolvimento com outra URL. Next, BFF, TLS, browser e gateway real ficam fora da medição.
- `load:api` recebe confirmação explícita, valida a mesma identidade SQL/container/volume da 4.3, exige baseline `completed/small` e contagens intactas, confere orçamento e inicia `dist/server.js`, `NODE_ENV=production`, pool Prisma de **5** conexões. Segredo JWT aleatório local por processo; nenhuma credencial de produção ou leitura automática de `.env`.
- Destino do script fixo `http://127.0.0.1:8051`, sem redirecionamentos. Runner nativo no Windows evita diferenças de rede/NAT do Docker. A imagem `grafana/k6:1.3.0` é alternativa de distribuição/inspeção; executar carga Docker exigiria uma decisão explícita sobre `host.docker.internal`, hoje recusado. Não usar host/URL remoto.
- O servidor atual escuta na interface padrão do Node; porta exclusiva não equivale a firewall. Executar em máquina/rede local controlada, sem publicar 8051 para a Internet. Não houve alteração do binding do código de produção.
- Banco/volume/controle da 4.3 permanecem: `marketplace-scale-postgres`, `marketplace_scale_data`, PGDATA `/var/lib/postgresql/data/pgdata`. Alvo preventivo **5 GiB**, teto **10 GiB**, espaço livre Windows e margens não são substituídos por espaço livre da VM. Não executar load/purge nem medium/large.

Inventário local observado em 23/10/2026, sem banco: Node **24.21.0**, npm **11.19.0**, Windows x64, AMD Ryzen 5 5600, **12 processadores lógicos**, 17.083.686.912 bytes de RAM total. A amostra de RAM livre foi 1.903.755.264 bytes, abaixo do mínimo de 2 GiB: **adiar execução se persistir**. PostgreSQL **16.15** e Engine Docker **29.7.2** foram observados na 4.3, não revalidados nesta etapa. k6 ainda não está instalado/validado neste host. Na 5.2 registrar versões reais, commit/diff, limites CPU/RAM da VM e do container e recursos disponíveis antes de cada rodada.

API, PostgreSQL e gerador de carga competirão pela mesma CPU, memória e disco. Os números não poderão ser extrapolados para produção ou tratados como capacidade isolada da API.

## Instalação e comandos

Executar na pasta `nodejs-backend`. Dependências Node pelo `npm.cmd ci` e lockfile existente; isso não semeia bancos. Instalação opcional do binário Windows amd64 **v1.3.0**, somente quando preparar a 5.2 (não executada nesta etapa):

```powershell
New-Item -ItemType Directory -Force load/.local
Invoke-WebRequest 'https://github.com/grafana/k6/releases/download/v1.3.0/k6-v1.3.0-windows-amd64.zip' -OutFile load/.local/k6.zip
$archiveHash = (Get-FileHash load/.local/k6.zip -Algorithm SHA256).Hash.ToLowerInvariant()
if ($archiveHash -ne '06a15d69869efb9261e6c132af64078731ad7d048095eaca05198daacb17686d') {
  throw 'Checksum k6 divergente; não executar'
}
Expand-Archive load/.local/k6.zip -DestinationPath load/.local/tools
$env:PATH = "$(Resolve-Path load/.local/tools/k6-v1.3.0-windows-amd64);$env:PATH"
k6 version
```

Checksum publicado na release oficial. Não usar `latest` ou atualizar silenciosamente; manter a ferramenta fora do Git. Não instalar browser/Chromium para estes testes de protocolo.

**Agora — sem banco ou HTTP:**

```powershell
npm.cmd run test:load-plan
npm.cmd run load:plan
```

`load:plan` mostra configuração/recursos locais; não conecta banco nem inicia carga.

**Futura preparação na 5.2 — não faz parte das validações desta etapa:**

```powershell
npm.cmd run build
# Terminal exclusivo: valida destino/baseline/armazenamento e inicia API compilada
npm.cmd run load:api -- --confirm-scale

# Outro terminal, após GET / responder: descoberta SQL somente leitura + dois logins
npm.cmd run load:sessions -- --confirm-scale
```

`load:sessions` não cria carrinhos nem modifica estoque. Descobre cinco produtos mais comprados por agregação de OrderItem, ordenação `count DESC,id ASC`; descobre sellers de maior/menor volume por contagem de SellerOrder, sem IDs copiados. Valida a identidade retornada por `/users/me` contra a descoberta SQL. Logins são feitos **antes da medição**; o contrato atual só consulta credenciais, não grava lastLogin.

Cookies são obtidos de `Set-Cookie`, nunca do body; k6 envia somente `Cookie: token=...` explicitamente por seller. Em produção o cookie é Secure; este harness de protocolo encaminha o header explicitamente por HTTP loopback local, não é uma validação de segurança de browser/TLS. `.local/read-manifest.json` contém cookies e não deve ser versionado/compartilhado. Expira conservadoramente em 45 minutos (JWT 1 h), precisa ser recriado após reiniciar a API. O modo POSIX 0600 não substitui ACLs no Windows: usar perfil de usuário privado. Não imprimir tokens, fazer login por iteração ou salvar credenciais reais.

**Futuras leituras — somente após autorização e monitoramento da 5.2:**

```powershell
$env:AUTHORIZE_READ = 'marketplace_scale-small'
$env:SCENARIO = 'catalog' # catalog | product | dashboard
$env:STAGE = 'smoke'     # smoke | low | gradual; avançar MANUALMENTE
New-Item -ItemType Directory -Force load/results
npm.cmd run load:read -- --summary-export load/results/catalog-smoke.json
```

Trocar nome do resultado em cada rodada; reter apenas resultados agregados limitados, sem bodies, cookies ou export HTTP linha a linha. Uma operação de dashboard contém oito GETs. Para executar um cenário individual, escolher `SCENARIO`; nunca disparar todos automaticamente. Se algum request ou DTO for inesperado, o runner aborta sem retry. Não existe comando de escrita pronto: `SCENARIO=cart/checkout/idempotency/payment` **recusa antes de enviar HTTP**.

Encerramento: Ctrl+C no k6 e no terminal da API; conferir que o processo filho Node/porta 8051 foi encerrado. O runner encaminha SIGINT e não gerencia serviços de desenvolvimento; não usar `taskkill` global. Não parar/remover containers ou volumes de outros ambientes. O PostgreSQL de escala pode ficar ligado para inspeção. Interrupção de escrita exigirá reconciliação somente leitura antes de qualquer recuperação.

## Matriz de cenários e contratos

As variantes rodam separadamente, não misturadas em um único gráfico. Preparação e verificações finais ficam fora do tempo medido, mas seus custos são relatados à parte.

| Cenário | Entrada/preparação | Operação medida e resultado esperado | Efeito/limite |
|---|---|---|---|
| Catálogo | Dataset small intacto; seller/category descobertos | `GET /products` alterna listagem e combinação `search=Scale&sellerId=...&category=...&inStock=true&page=1/2&limit=5`, além de indisponíveis; 200, `{data,pagination}`. Filtros no banco, não filtrar a página em memória. | Sem escrita; 1 GET/operação. Totais/páginas e predicados devem ser comparados ao oráculo SQL antes/depois na 5.2. |
| Produto | Cinco IDs líderes por linhas históricas; janela fixa | `GET /products/:id`, round-robin sobre cinco produtos populares, 200 com centavos/currency/estoque. | Hot spot de leitura; 1 GET/operação, não exige dataset maior. |
| Carrinho | Customers exclusivos de experimento, produto exclusivo por customer com onHand=4, reserved=0, cart vazio | `POST /cart/items {productId,quantity:1}` →201; `PUT /cart/items/:productId {quantity:2}` →200, conferir qty/total/estoque. | Até 2 requests/operação, cada customer usado uma vez; 1 Cart/CartItem por participante. Não usar `GET /cart` de customers-base: ele pode criar carrinho ACTIVE. |
| Checkout compartilhado | Customers/carts/endereço próprios, todos com 1 unidade do MESMO produto experimental; estoque total 2 | `POST /checkout {addressId}`, chave única por compra, 201; após duas reservas, 409 **Cart stock is insufficient**. | Máximo 2 Orders; losers sem Order/reserva; estoque nunca negativo. Preparar todos os carrinhos antes da disputa. |
| Checkout distribuído | Um produto experimental por participante, estoque 1 cada | Mesmo POST com customer/endereço/chave distintos; todos 201. | Até 20 Orders/rodada. Comparar com estoque compartilhado, sem alterar produto-base. |
| Idempotência | Um customer/cart/address experimental e uma chave fixa por grupo/rodada | POST concorrente MESMA chave/body: uma criação 201, replays 200 com `Idempotency-Replayed: true`, ou 409 **Idempotency key is processing**. | Exatamente 1 Order e uma chave concluída por grupo. Comparar TODOS os IDs, não só status. 409 divergente/estoque/vazio não é replay válido. |
| Pagamento | Order experimental PENDING_PAYMENT com total/ownership preparados, sem attempt ativo; sessão do customer | `POST /orders/:id/payment-attempts {method:"PIX"}` →201, valor integral/moeda da Order, CREATED e referência DEV_SIMULATOR; duplicatas 409 **Order already has an active or captured payment attempt**. | Uma tentativa ativa por Order. Variantes: participantes distintos ou concorrência na mesma Order. Nenhum amount/currency/status no payload; sem captura pública ou promessa de Order CONFIRMED. |
| Dashboard | Sessões separadas dos sellers maior/menor volume e período fixo jan–nov/2026 | Oito GETs `/dashboard/seller/{summary,orders,orders/by-status,sales/timeseries,sales/by-category,products/top,customers/new,ratings}`, 200; orders com page/limit/status, série diária padrão. | Sem escrita; **8 GETs/operação**. Comparar perfis em rodadas separadas na 5.2; runner-base alterna identidades. Receita usa DELIVERED/completedAt; contagem/lista usa createdAt; valores em centavos, reputação só seller direto. |

Read runner-base verifica status/estrutura; não substitui oráculos de totais, ownership e filtros previstos na 5.2. Campo inexistente ou enum incorreto é falha, não sucesso vazio. O catálogo tem também `/products/search?q=...` e rotas por seller/category; usa-se a listagem geral para manter uma comparação controlada com todos os filtros.

## Preservação e repetibilidade das escritas (decisão necessária antes de liberar)

Não usar Orders históricas, users-base ou estoque reservado como fixtures descartáveis. Preparar, na 5.2, um **namespace estável de experimento** com manifesto/registro próprio em `scale_ops` (fora de tabelas de negócio, sem migration Prisma): IDs gerados/registrados, usuários `load.<round>.*@local.invalid`, seller próprio, produtos/referências `LOAD-*`, endereços e carts próprios. Descoberta da base só serve para leituras; não converter um usuário-base em participante de escrita.

Por rodada/cenário: **até 20 customers, 1 seller e 21 produtos**, um endereço por customer, até 20 carts/itens, 20 Orders/SellerOrders/OrderItems/reservas/movimentos/chaves e 20 attempts. Idempotência compartilhada usa 1 customer/Order; checkout compartilhado usa um produto. Stock initialization exige movimento correspondente. Quantidades/rodadas são finitas; jamais acrescentar um novo conjunto a cada retry sem resolver o anterior.

Preparação deve registrar/validar: identidade exclusiva, baseline/counters/hash dos registros-base, namespace sem colisão, IDs próprios e FKs sem cruzamento com base ou outro experimento; mesmos limites de armazenamento da 4.3. Não usar purge do gerador. A checagem estrita do launcher/sessions pressupõe base intacta: preparar as sessões de leitura antes de qualquer escrita, e executar leituras-base antes das rodadas de escrita.

**Recuperação proposta, a implementar e testar ANTES da primeira rodada de escrita:** parar API/runner, reconciliar somente por SELECT todos os IDs/efeitos inclusive resposta perdida, adquirir exclusão mútua e executar limpeza transacional apenas do grafo experimental enumerado, na ordem das FKs. Remover conjuntamente reservas, movimentos e inventários/produtos experimentais, históricos, attempts, chaves, endereço snapshot, itens/Orders, carts, endereços, perfis/users próprios. Isso é desmontagem isolada de fixture, **não liberação comercial de reserva** nem cancelamento de pedido real. Se houver relação cruzada, pagamento externo, dados não registrados ou estado ambíguo, abortar e exigir revisão. Não executar DELETE amplo, TRUNCATE/CASCADE global ou editar saldos-base para "corrigir" resultado.

Após recuperação: provar ausência do namespace, contagens/hash-base inalterados e invariantes 4.3 preservadas; só então autorizar rodada seguinte com manifesto limpo. Não implementar retry automático ou cleanup em `teardown` que esconda falhas. Se não for possível provar a desmontagem segura, **não executar cenários de escrita** até decisão do responsável.

## Progressão, métricas e interrupção

| Etapa manual | VUs leitura | Operações leitura / duração máxima | VUs escrita | Operações escrita / duração máxima |
|---|---:|---|---:|---|
| Smoke | 1 | 5 / 30 s | 1 | 2 / 30 s |
| Baixa | 2 | 40 / 90 s | 2 | 10 / 90 s |
| Gradual | 5 | 100 / 180 s | 4 | 20 / 180 s |

Os números são tetos, não duração fixa nem taxa de chegada. Pausa de **1 s/operação**, timeout **10 s/request**, redirects desativados e **zero retry automático**. Requests máximos = operações × requests/operação: leitura simples 5/40/100; dashboard 40/320/800; carrinho 4/20/40. Preparação/logins/oráculos contam separadamente no relatório. Operações adicionais de diagnóstico fora da medição são limitadas e registradas.

Smoke serial não demonstra concorrência. Na 5.2 usar baixa/gradual para disputas, barreira de início dos participantes e dados iguais/controlados; não confundir VUs ativos com prova de simultaneidade no banco. Para idempotência PROCESSING, após resultado incerto permitir no máximo **um replay diagnóstico explícito** com mesma chave/endereço fora da janela medida; persistindo incerteza, parar, sem nova chave/Order.

Medir requests/s e operações/s separadamente, duração da janela, VUs, p50/mediana, p95, p99, `http_req_failed`, timeouts e transporte, `unexpected_results`, checks e `business_results` por resultado. Em escritas adicionar contadores de criação, conflito esperado, replay e invariantes persistidas. Não esconder todo 409 em `expectedStatuses`: o corpo exato e a pós-condição de negócio são necessários. 400/401/403/404/5xx, conflito não previsto, JSON inválido e timeout são inesperados. Não gravar JWT ou IDs por request em logs de alto volume.

Hipóteses locais iniciais: p95 <1.000 ms, p99 <2.000 ms, inesperados <1%; não são SLAs. Read runner interrompe no primeiro resultado inesperado, além dos thresholds; amostras pequenas não sustentam inferência de percentis de cauda. Os conflitos previstos devem ter taxa/latência próprias, nunca inflar throughput de sucesso.

Antes e a cada **5 s**, na futura execução, acompanhar: CPU host/VM/API/container, memória livre, conexões/esperas PostgreSQL, orçamento/disco. Interromper se CPU host >85% por 15 s, memória disponível <2 GiB, conexões >20, espera de lock >10 s, orçamento 4.3/margem Windows comprometidos ou falha técnica/invariante de negócio inesperada. Teto de tempo/operações prevalece. O runner atual faz preflight, **não monitora recursos continuamente**: a 5.2 precisa preparar a coleta/supervisão (PowerShell/Docker stats e queries somente leitura) antes de liberar os comandos; não declarar proteção automática inexistente. Não desabilitar durabilidade, mexer em configuração global ou adicionar observabilidade completa.

## Ordem proposta para 5.2 e pendências concretas

1. Revisar espaço/memória e registrar versões/recursos reais, confirmar small intacto, instalar/verificar k6 fixado e validar o script no runtime k6.
2. Build isolada, API exclusiva, disponibilidade HTTP e sessões fora da medição. Preparar observação/abort de recursos e oráculos de leitura; delimitar aquecimento separado (até uma operação por cenário, registrado).
3. Smoke de catálogo/produto/dashboard; depois baixa e gradual **um cenário por vez**, somente se a rodada anterior estiver íntegra. Separar sellers de maior/menor volume e variantes de filtros/série para comparação.
4. Implementar/testar manifesto, preparação e recuperação de fixture experimental com limites acima. Somente depois liberar scripts de escrita, barreiras e métricas específicas. Não acessar estoque/pedidos-base para obter resultado positivo.
5. Smoke/baixa/gradual de cart, checkout compartilhado/distribuído, idempotência e pagamento. Conferir invariantes e recuperar explicitamente entre cenários; parar em resultado desconhecido. Não executar captura de pagamento.
6. Relatar tamanho do dataset, concorrência, erros técnicos versus resultados de negócio, limites/picos de recursos e condições de máquina compartilhada; guardar apenas agregados em `load/results/` ignorado. Nenhuma conclusão de capacidade ou baseline foi produzida na 5.1.
