# Perfis de dados sintéticos — fase 4.1

Esta configuração define volumes-alvo para experimentos futuros. Ela **não gera nem insere dados**. Seed aleatória fixa `410401` e data-base UTC `2026-01-01T00:00:00.000Z` permanecem. Distribuições compartilhadas e revisão dos volumes por cenários estão em [SCALE_DATA_DISTRIBUTIONS.md](SCALE_DATA_DISTRIBUTIONS.md), etapa 4.2; a implementação de carga fica para 4.3.

## Perfis propostos

Contagens em `exact` são alvos exatos: `customers` representa `CustomerProfile`, `sellers` representa `Seller`, e os demais nomes representam seus modelos homônimos. Volumes em `estimated` são contagens de registros físicos derivados, arredondadas ao inteiro mais próximo. `totalRows` soma explicitamente os 22 modelos Prisma; não soma indicadores/subconjuntos.

| Perfil | Customers | Sellers | Products | Orders | Carts | SellerOrders estimadas | OrderItems estimados | Registros estimados | Limite de registros | Armazenamento hipotético |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| small | 100 | 10 | 500 | 1.000 | 40 | 1.400 | 3.500 | 30.349 | 50.000 | 0,1 GB |
| medium | 1.000 | 50 | 5.000 | 10.000 | 400 | 16.000 | 56.000 | 403.330 | 500.000 | 0,75 GB |
| large | 5.000 | 200 | 20.000 | 50.000 | 2.000 | 90.000 | 315.000 | 2.176.580 | 2.500.000 | 2,5 GB |

| Perfil | Users | CustomerAddresses | OrderAddresses | IdempotencyKeys | Capturadas (subconjunto, não somado) |
|---|---:|---:|---:|---:|---:|
| small | 110 | 150 | 1.000 | 1.000 | 700 |
| medium | 1.050 | 1.500 | 10.000 | 10.000 | 7.500 |
| large | 5.200 | 7.500 | 50.000 | 50.000 | 40.000 |

O segundo quadro completa a composição: `users = customers + sellers`; `OrderAddress` e `IdempotencyKey` são estimados em um por Order; endereços de customer usam média de 1,5 por customer. `capturedPaymentAttempts` é um indicador de subconjunto de `paymentAttempts`, apresentado para planejamento, mas não é registro adicional. `adminUsers` tem contagem explícita zero em `notGenerated`: contas administrativas são operacionais, não dados de cenário. Os demais 22 modelos do schema possuem contagem física exata ou estimada; `Review` é a soma das reviews de produto e seller.

Premissas importantes: no máximo um SellerOrder por seller em cada Order (constraint única); cada Delivery pertence a um SellerOrder e é única; PaymentAttempts capturadas não excedem Orders; Reviews respeitam unicidade por customer e alvo; reservas estimadas correspondem a OrderItems. A 4.2 deriva entregas e históricos dos cenários pagos, substituindo médias independentes; seus indicadores de SellerOrders pagas/entregues não são linhas adicionais.

| Perfil | CartItems | Reviews produto / seller | PaymentAttempts / capturadas / refunds | Deliveries | Históricos Order / SellerOrder / Delivery | Inventories / Reservations / Movements |
|---|---:|---:|---:|---:|---:|---:|
| small | 80 | 200 / 100 | 1.150 / 700 / 105 | 784 | 1.700 / 4.106 / 3.314 | 500 / 3.500 / 6.000 |
| medium | 1.000 | 2.500 / 1.200 | 12.500 / 7.500 / 1.350 | 9.600 | 17.500 / 49.120 / 40.560 | 5.000 / 56.000 / 96.000 |
| large | 4.000 | 10.000 / 5.000 | 65.000 / 40.000 / 8.000 | 57.600 | 90.000 / 288.720 / 243.360 | 20.000 / 315.000 / 475.000 |

O seed de desenvolvimento é intencionalmente minúsculo (1 customer, 2 sellers, 3 products, 1 cart e 1 Order com 2 SellerOrders e 3 itens); `small` aumenta o volume o bastante para consultas e agregações sem se aproximar do orçamento de disco. Os valores hipotéticos de armazenamento são apenas ordem de grandeza para planejamento do footprint da carga; a medição real deve contabilizar tabelas, índices, WAL e temporários.

## Orçamento e limites

O orçamento total local para escala é **5–10 GB**, incluindo tabelas, índices, WAL e arquivos temporários. Os tamanhos da tabela são hipóteses iniciais, não garantias: formato das linhas, índices, WAL, retenção e distribuição alteram o resultado. Não se tenta ocupar o orçamento. Política versionada no JSON: alvo de parada em 5 GiB, limite rígido em 10 GiB e limite global de 30 minutos; cada perfil também limita registros e duração. As primeiras cargas da 4.3 serão exclusivamente `small`. `medium` e `large` exigem autorização posterior explícita, sem avanço automático, após medição de `small`.

Tamanho de dataset não é intensidade da carga. Hot spots e concorrência poderão ser medidos com poucos registros; volume não deve ser usado como substituto de concorrência.

## Isolamento e segurança

O ambiente futuro deverá usar banco exclusivo chamado `marketplace_scale`, separado de `marketplace_dev`, `marketplace_e2e` e produção. Nenhum banco foi provisionado ou acessado nesta etapa. A configuração não contém URL de conexão. Geradores/limpadores futuros deverão confirmar explicitamente host, porta e nome autorizados antes de qualquer escrita destrutiva; não poderão reaproveitar o cleaner E2E. Geração e limpeza nunca serão disparadas no startup da aplicação. Para mídia, armazenar somente referências/URLs, nunca arquivos binários.

## Ambientes não intercambiáveis

- **Seed de desenvolvimento:** pequeno conjunto determinístico para uso local cotidiano, protegido para `localhost:5433/marketplace_dev`.
- **Fixtures E2E:** dados mínimos e descartáveis no banco isolado `marketplace_e2e`, preparados e limpos pelo runner E2E com proteção própria.
- **Dataset de escala:** perfis desta configuração em banco exclusivo `marketplace_scale`; ainda não há gerador nem rotina de limpeza.

## Reproduzir a validação sem banco

Na pasta `nodejs-backend`, execute:

```powershell
npm run test:scale-profiles
```

O teste usa apenas Node.js e verifica os três perfis, coerência dos derivados, limites relacionais, crescimento e valores de reprodutibilidade. Ele não conecta ao PostgreSQL.

## Próximas decisões

- **4.2:** distribuições e cenários definidos em [SCALE_DATA_DISTRIBUTIONS.md](SCALE_DATA_DISTRIBUTIONS.md), com testes sem banco.
- **4.3:** implementar geração em lotes e checkpoints, verificar destino exclusivo, medir primeiro `small`, observar tabelas/índices/WAL/temporários, impor limites de registros/tempo/armazenamento e validar invariantes após a carga.

Os valores estimados permanecem hipóteses até a primeira medição real em ambiente isolado.
