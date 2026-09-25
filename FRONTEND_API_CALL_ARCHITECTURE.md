# Marketplace — arquitetura das chamadas de API no frontend

25/09/2026

Type: #project

Tags: [[Next.js]], [[Marketplace project]]

---

## Ideia central

O frontend usa uma API Express separada. No fluxo principal, o navegador chama rotas `/api` do próprio Next.js; essas rotas encaminham a operação ao backend e preservam a sessão por cookie HTTP-only.

```text
Componente → hook opcional → service → cliente HTTP → app/api → backend
```

As camadas têm responsabilidades diferentes:

| Parte | Responsabilidade |
| --- | --- |
| Componente | Exibir dados e receber ações do usuário. |
| Hook opcional | Gerenciar estado de uma interação client-side, como `loading`, erro e atualização da tela. Não é obrigatório para chamar a API. |
| Service (`services/`) | Nomear a operação e definir entrada/saída: `login()`, `getCurrentUser()`, `updateMySellerProfile()`. Não guarda estado React. |
| Cliente HTTP (`lib/http.ts`) | Executar `fetch`, serializar JSON, interpretar respostas e preservar status/erros HTTP. |
| Rotas Next.js (`app/api/**/route.ts`) | Receber requisições HTTP do navegador no mesmo domínio do frontend e encaminhá-las ao backend. Na autenticação, cuidar do cookie. |
| Auxiliar de proxy (`lib/api/bff.ts`) | Compartilhar apenas o código repetido entre as rotas `app/api`, como destino fixo, encaminhamento do cookie e proteção de origem. É um detalhe de implementação das rotas, não uma etapa adicional que o componente chama. |
| Backend | Autenticar, autorizar, aplicar regras de negócio e acessar o PostgreSQL. |

`app/api` **recebe** HTTP; `lib/http.ts` **envia** HTTP. O service chama a URL `/api/...` por meio do cliente HTTP; ele não importa um arquivo `route.ts`.

No projeto atual, a justificativa concreta para `app/api` é a ponte de autenticação: o navegador envia ao Next o cookie `HttpOnly` do domínio do frontend, e a rota encaminha a credencial ao backend. Isso não torna a ponte obrigatória para toda requisição. Uma leitura feita no servidor Next pode chamar o backend diretamente, evitando o salto de volta pela própria `/api`.

## Sessão e autorização

O login passa por `/api/session/login`. O Next.js recebe `Set-Cookie` do backend e estabelece o cookie `token` como HTTP-only no domínio do frontend. O JavaScript não lê o token. `/users/me` informa a identidade atual; o backend continua decidindo se cada operação é permitida para a role do usuário.

Uma resposta `401` indica ausência de autenticação válida; `403` indica falta de permissão e não deve, por si só, apagar a sessão visual. Leituras privadas não devem ser compartilhadas por cache.

## Exemplo client-side — salvar o perfil com hook

Este é um exemplo didático de um hook **futuro**; atualmente a edição do perfil chama o service diretamente, sem hook de API próprio.

```text
ProfileForm (clique em “Salvar”)
  → useUpdateProfile (loading, erro, atualização da UI)
  → userService.updateCurrentUser({ name })
  → lib/http.ts: PUT /api/users/me com JSON
  → app/api/users/me/route.ts: encaminha cookie e payload
  → backend: PUT /users, valida usuário e salva
  → resposta retorna pelo mesmo caminho
```

O hook não autoriza a operação; ele apenas controla o comportamento da tela. O backend valida a identidade e as permissões.

## Exemplo server-side — catálogo público sem hook

Este caminho é uma **opção para a migração futura do catálogo**; não descreve a implementação atual dessa tela. Uma página Server Component pode consultar a API antes de renderizar:

```text
app/products/page.tsx (Server Component)
  → catalogService.listProducts(filtros da URL)
  → fetch no servidor Next.js
  → backend: GET /products
  → página recebe produtos e renderiza a primeira lista
```

Aqui não há hook nem passagem por `app/api`: o código já executa no servidor Next.js. Filtros e paginação podem ser representados na URL para gerar uma nova leitura. Componentes interativos, como o botão “Adicionar ao carrinho”, continuam no navegador e seguem o fluxo principal.

Se uma leitura server-side futura exigir autenticação, o Next.js poderá ler o cookie que recebeu na própria requisição e encaminhá-lo ao backend. Isso não exige outro login nem uma chamada a `/users/me` apenas para obter o cookie. Esse caminho autenticado está adiado até uma tela realmente precisar dele.

## Regra prática

Use o service para expressar **o que** a tela quer fazer; o cliente HTTP cuida de JSON e erros, e a rota Next.js faz a ponte quando a chamada vem do navegador e precisa da sessão. Na primeira leitura server-side real, reutilizar o tratamento HTTP comum com destino explícito: `/api/...` no navegador ou URL do backend no servidor. Não inferir o ambiente automaticamente nem criar versões browser/server de todo service por antecipação. Crie um hook quando ele simplificar uma interação real.
