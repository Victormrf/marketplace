# Carga sintética isolada — etapa 4.3

## Destino e pré-requisitos

Executar os comandos abaixo em `nodejs-backend`, com dependências instaladas pelo lockfile, Node e Docker Desktop Linux/WSL disponíveis. Não é preciso iniciar a aplicação, jobs, gateways ou o seed de desenvolvimento.

Destino fixo: container `marketplace-scale-postgres`, PostgreSQL `16-alpine`, host `127.0.0.1`, porta `5435`, banco/usuário `marketplace_scale`. A senha do Compose é exclusivamente local e não é credencial de produção. `SCALE_DATABASE_URL` opcional deve corresponder exatamente ao destino autorizado; `DATABASE_URL` da aplicação não é utilizada pelo gerador.

Volume estável `marketplace_scale_data`, montado em `/var/lib/postgresql/data`; PGDATA em `/var/lib/postgresql/data/pgdata`. O diretório `/var/lib/docker/volumes/marketplace_scale_data/_data` pertence à VM Docker, não é uma pasta Windows.

Nesta máquina, o armazenamento está no VHDX compartilhado `C:\Users\Principal\AppData\Local\Docker\wsl\disk\docker_data.vhdx`, unidade `C:`. O relatório identifica o caminho efetivamente encontrado e mede o espaço livre dessa unidade com `DriveInfo`. O comprimento do VHDX não equivale ao espaço exclusivo da escala, nem mede sua alocação física exata.

## Comandos operacionais

```powershell
# Verificações sem banco
npm.cmd run test:scale-profiles
npm.cmd run test:scale-distributions
npm.cmd run test:scale-loader

# Provisionar somente o ambiente exclusivo e aplicar a baseline existente
npm.cmd run scale:prepare

# Planejar small e validar SQL/medições, sem escrever registros ou consumir autorização
npm.cmd run scale:dry-run -- --profile small

# DESTRUTIVO: esvazia apenas as tabelas de negócio de escala e autoriza UMA carga
npm.cmd run scale:purge -- --confirm marketplace_scale@127.0.0.1:5435

# Escrita: executar somente com autorização do responsável
npm.cmd run scale:load -- --profile small --confirm marketplace_scale@127.0.0.1:5435

# Consultas sem alterações de negócio; disponíveis inclusive após interrupção
npm.cmd run scale:status
npm.cmd run scale:report
npm.cmd run scale:verify
```

O dry-run exige o banco já preparado para validar as consultas e medições reais; não altera `scale_ops.control`. Não executar `medium`/`large` nesta etapa. Futuras execuções desses perfis exigem uma medição small concluída e confirmação manual específica `--approve-profile medium` ou `--approve-profile large`, além do perfil e destino. Nunca há avanço automático.

Após erro, timeout, perda de conexão ou resultado desconhecido, **não repetir a carga nem fazer purge corretivo**: consultar somente status/relatório, preservar os registros e informar o responsável. Não há retry integral, retomada automática ou inserção sobre dados existentes.

## Autorização persistente e exclusão mútua

`scale_ops.control` é metadado operacional fora das 22 tabelas de negócio, inicializado pelo Compose; não é migration da aplicação. O banco recebe também um marcador de identidade. A carga/limpeza verifica URL, identidade SQL, container, labels do volume e binding loopback. Nenhum cleaner de desenvolvimento/E2E é reutilizado.

O primeiro estado é `interrupted`: somente um purge explícito pode preparar `ready`. A carga exige todas as tabelas vazias e consome `ready → loading` atomicamente antes da primeira escrita de negócio. Um advisory lock PostgreSQL comum impede carga/carga e carga/purge concorrentes. Cada lote e seu progresso são confirmados juntos. O resultado persistido é `completed` ou `interrupted`.

Em encerramento abrupto, `loading` permanece no disco. Sem o lock ativo, status o apresenta como interrupção órfã, sem liberar autorização ou corrigir silenciosamente. Mesmo sem registros inseridos, uma autorização consumida não pode ser reutilizada. Um novo purge requer decisão explícita posterior.

O purge usa `TRUNCATE` das tabelas enumeradas em `records.js`, em uma única instrução com `RESTRICT`, sem `CASCADE`. Preserva `_prisma_migrations`, schema e controle operacional; só prepara `ready` depois de conferir contagens zero. Não executar um purge final após a carga aprovada.

## Planejamento, lotes e coerência

Configuração v2, gerador v1.0.0, seed `410401`, data-base `2026-01-01T00:00:00.000Z`. Quotas são planejadas integralmente antes de escrever; IDs, seleção de relações, datas, referências simuladas e snapshots são determinísticos. Um hash SHA-256 dos registros planejados permite comparar futuras gerações com as mesmas versões; ele não é um hash relido do banco.

Mantém-se um plano compacto de relações/quotas em memória; as linhas completas são produzidas por iteradores e inseridas em lotes de até 500, na ordem das FKs. Não é streaming de memória constante: o plano de Orders/itens cresce com o perfil. Nenhum binário de imagem, chamada externa ou job é executado.

São verificados contagens, totais financeiros, autoria/ownership, pagamento integral e exclusividade, limite de refunds, elegibilidade de reviews, reservas/movimentos/saldos, endereços, idempotência, sequência/estado final de históricos e janela de datas. Constraints únicas do banco continuam ativas.

Preservam-se as decisões da 4.2: SellerOrders avançadas são **snapshots históricos**, não novas transições da API; reservas permanecem `ACTIVE`, inclusive em compras entregues. Orders pagas permanecem `CONFIRMED`. Carrinhos atuais/abandonados são independentes dos snapshots históricos de checkout. Estes dados não representam liberação de reservas, expiração automática, conclusão agregada ou gateway real.

## Limites e armazenamento

Small: 30.349 registros planejados; limite de 50.000 e 300.000 ms. Política geral: alvo preventivo de 5 GiB e teto de 10 GiB; não são reserva pré-alocada ou quota automática do Docker.

Antes da carga e entre lotes são medidos `pg_database_size` (tabelas/índices e demais arquivos do banco), ocupação de PGDATA/volume por `du` (incluindo WAL/temporários presentes), WAL separado, camada gravável e espaço livre **real da unidade Windows**. Logs do container têm rotação de 10 MB × 3. O cálculo preventivo inclui margem de 128 MiB + 64 KiB por próxima linha e pelo menos 2 GiB livres no Windows; medições indispensáveis ausentes bloqueiam a execução. Há margem de tempo de 5 s; chamadas externas de medição têm timeout próprio, portanto não são um limite de tempo de precisão absoluta.

Medições são amostras, não garantem ausência de picos entre lotes ou crescimento causado por outros containers. O VHDX compartilhado e o espaço livre do Windows não são atribuídos integralmente à escala. O relatório persiste no próprio ambiente, com limite de 256 KiB, sem dumps ou arquivos intermediários ilimitados.

`scale:report` informa execução/perfil/seed/versões, contagens previstas/inseridas por tabela, duração, resultado, invariantes e medidas antes/depois. `scale:status` inclui medições atuais. Preservar essa distinção: a ocupação atual pode mudar após checkpoints.

**Purge** esvazia/trunca as relações e permite reutilização de espaço pelo PostgreSQL; o volume e o VHDX podem continuar ocupando espaço no Windows. Recuperação física pode exigir procedimento separado específico do Docker Desktop/WSL, com backup e autorização. Esta ferramenta não compacta discos, remove volumes ou executa limpeza global do Docker.
