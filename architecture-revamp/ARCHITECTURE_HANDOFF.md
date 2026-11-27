# Marketplace Architecture Revamp — Schema Foundation Handoff

## Purpose

This document is the implementation brief for the first milestone of the marketplace architecture revamp. The Codex desktop conversation remains the architecture orchestrator: architectural decisions are discussed there, and the CLI/IDE agent implements one approved adjustment at a time.

The first milestone is a schema-centered foundation for a modular monolith that can later support synthetic load, caching, queues, background jobs, observability, resilience patterns, and selective service extraction.

Do not introduce Redis, message brokers, microservices, circuit breakers, or Kubernetes during this milestone. Establish a correct transactional model first.

## Current System

### Backend

- Express and TypeScript, not NestJS.
- Prisma with PostgreSQL.
- Organized into controllers, services, and static model/repository classes.
- One API process also runs the delivery cron job.
- Main domains: identity, customers, sellers, catalog, cart, orders, payments, delivery, refunds, reviews, and seller dashboards.

### Frontend

- Next.js 15 App Router and React 19.
- Most application pages are client components.
- Components and pages call the backend directly through repeated `fetch` operations.
- The browser currently orchestrates the checkout/order/delivery/cart-clear workflow.

## Milestone Goal

Create a normalized and migration-ready Prisma write model that supports:

- multi-seller orders;
- precise monetary values;
- immutable purchase snapshots;
- enforceable ownership relationships;
- safe inventory updates and future reservations;
- multiple payment attempts and partial refunds;
- explicit lifecycle states and histories;
- idempotent checkout;
- realistic synthetic datasets and indexed access patterns.

This milestone is successful when the schema and its documented invariants form a stable foundation for the subsequent checkout rewrite. It is not successful merely because a new Prisma schema compiles.

## Main Problems in the Current Model

### 1. Multi-seller orders lack a fulfillment boundary

An order can contain products from multiple sellers, but it currently has one status and one delivery. In a marketplace, each seller may fulfill, ship, fail, cancel, or refund its portion independently.

This also affects analytics. Queries that find an order containing a seller's product can accidentally attribute the entire order total to that seller.

Desired direction:

```text
Order
  ├── SellerOrder (Seller A)
  │     ├── OrderItem[]
  │     └── Delivery
  └── SellerOrder (Seller B)
        ├── OrderItem[]
        └── Delivery
```

Use `SellerOrder` as the initial name unless repository conventions strongly justify another explicit name. It represents the independently fulfillable seller portion of a customer order.

### 2. Monetary values use floating point

Product prices, order totals, order-item prices, payments, and refunds use `Float`. Floating-point arithmetic is unsuitable for authoritative monetary calculations.

Desired direction:

- Prefer integer minor units with explicit names such as `priceInCents`, `unitPriceInCents`, `totalInCents`, and `amountInCents`.
- Add a currency field where monetary data is persisted. Defaulting to `BRL` is acceptable for the first version, but the stored value must be explicit.
- Preserve the price captured at purchase time on each order item.
- Never calculate an authoritative order total from the current product price.

If the implementation agent believes Prisma `Decimal` is materially better for this project, stop and present the trade-off before changing the agreed representation.

### 3. Checkout has no persistent idempotency model

The frontend uses an in-memory React ref to reduce repeated order creation. That does not protect against refreshes, multiple tabs, network retries, or concurrent requests.

Desired direction:

- Add an `IdempotencyKey` model owned by a user and scoped to an operation such as checkout.
- Store request identity/fingerprint, processing state, resource/result reference, timestamps, and expiration where appropriate.
- Enforce uniqueness for the intended scope, for example `(userId, operation, key)`.
- The later checkout service must return the original result when the same request is replayed.

The schema should enable idempotency; implementing the complete checkout endpoint belongs to the next vertical-slice milestone.

### 4. Cart uniqueness is enforced only by application logic

The application checks for an existing cart item before inserting it. Concurrent requests can still create duplicate rows.

Desired direction:

- Introduce an explicit `Cart` aggregate associated with the customer/user.
- Add a database unique constraint for one product per cart: `@@unique([cartId, productId])`.
- The later application implementation should use atomic `upsert` behavior.
- Decide and document whether a user has exactly one active cart or whether historical/converted carts are retained. Prefer an explicit cart status if carts will be retained after checkout.

### 5. Inventory has no reservation or audit model

The product has a mutable `stock` counter, but order creation does not atomically reserve or decrement inventory. Concurrent checkouts can oversell, and stock adjustments have no durable history.

Desired direction:

- Separate catalog information from inventory state.
- Add an `Inventory` record with available and reserved quantities, or an equivalently explicit representation.
- Add an append-only `InventoryMovement` audit model for restock, reservation, sale/commit, release, return, and manual correction.
- Design relationships so an `InventoryReservation` can be added now or in the checkout milestone without another structural rewrite.
- Add database-level non-negative checks through SQL migration when Prisma schema syntax cannot express them.

Do not build a warehouse-management system. The initial model supports one logical inventory pool per product unless a multi-warehouse requirement is explicitly approved.

### 6. Customer address is an unstructured mutable string

The customer currently has one address string. Customers need saved addresses, while orders need an immutable record of the delivery address used at checkout.

Desired direction:

- Add structured `CustomerAddress` records.
- Add an immutable `OrderAddress` snapshot owned by the order.
- Updating a saved customer address must not alter historical orders.
- Include fields appropriate for Brazilian addresses, but avoid making optional address components mandatory without a domain requirement.

### 7. Payment is modeled as one record per order

The current one-to-one relationship prevents realistic retries and multiple provider attempts.

Desired direction:

- Replace the single conceptual payment with `PaymentAttempt[]` belonging to an order.
- Include provider, provider reference, method, status, amount, currency, idempotency/reference data, failure details, and lifecycle timestamps.
- Provider references must be unique when present.
- Keep provider-specific raw responses out of core columns; an optional JSON metadata field is acceptable if bounded and non-sensitive.
- Never store raw card numbers, CVV, or equivalent payment credentials.

### 8. Refunds cannot model multiple or partial refunds well

The existing one-to-one payment/refund relationship prevents repeated or partial refunds.

Desired direction:

- Allow multiple refunds per captured payment attempt.
- Persist amount, currency, reason, status, provider reference, and timestamps.
- The application layer must later enforce that completed refunds do not exceed the successfully captured amount.

### 9. Lifecycle transitions are weakly constrained

Several status updates accept strings and do not implement an explicit state machine. Order, seller-order, payment, delivery, and refund lifecycles have different meanings and should not be conflated.

Desired direction:

- Use Prisma enums for bounded operational states.
- Add status history where it has operational or audit value, especially order/seller-order and delivery histories.
- Do not create lookup tables merely to replace stable enums.
- State-transition validation belongs to domain/application services in the next milestone, but the schema must make invalid ownership and relationship combinations difficult.

### 10. Indexes and lifecycle timestamps are incomplete

The current schema has no explicit access-pattern indexes and does not apply `createdAt`/`updatedAt` consistently.

Desired direction:

- Add consistent lifecycle timestamps to mutable operational entities.
- Add indexes for demonstrated and planned access paths, not every column.
- Likely initial indexes include customer order history, seller fulfillment queues, product category/seller listings, cart loading, delivery status processing, payment lookup, review lookup, and chronological scans.
- Use compound indexes when query filters and ordering naturally use the same leading columns.

### 11. Referential actions and deletion behavior are implicit

Historical commerce data should not disappear because a user, seller, or product is deleted.

Desired direction:

- Choose `onDelete` behavior deliberately for every important relationship.
- Prefer soft deactivation for users, sellers, and products referenced by transactions.
- Preserve order items, payment attempts, refunds, deliveries, and audit histories.
- Cascade only for dependent data that has no independent historical meaning, such as selected ephemeral cart relationships.

### 12. Naming is inconsistent

Current Prisma models mix snake_case and PascalCase, and generated client usage reflects database table naming directly.

Desired direction:

- Use singular PascalCase Prisma model names and camelCase fields.
- Preserve snake_case database naming with `@@map` and `@map` only if that convention is deliberately chosen.
- Use consistent relation-field names.
- Avoid exposing migration-era naming compromises throughout application code.

## Domain Invariants

The revised schema and later application services must support these rules:

1. A user email is unique after normalization of the application's chosen email comparison behavior.
2. A customer can have no more than one active cart unless a different policy is explicitly approved.
3. A cart contains no more than one row for a given product.
4. An order belongs to the authenticated customer that created it.
5. An order has at least one seller order.
6. A seller order belongs to exactly one seller and one parent order.
7. Every order item belongs to exactly one seller order, and its product belongs to that seller at purchase time.
8. Purchased product name, SKU/reference, seller identity, unit price, and currency are immutable snapshots where needed for historical correctness.
9. Authoritative monetary arithmetic never uses floating point.
10. Available and reserved inventory cannot become negative.
11. Replaying the same checkout idempotency key with the same request returns the same logical result.
12. Reusing an idempotency key for a materially different request is rejected.
13. An order can have multiple payment attempts, but captured value must not exceed the amount due without an explicit adjustment model.
14. Completed refund value must not exceed captured payment value.
15. A delivery belongs to one seller order, not directly to a multi-seller parent order.
16. Updating a customer address does not alter an order-address snapshot.
17. Historical transactional records are not removed by catalog or account deactivation.
18. Status changes follow explicit state machines implemented above the repository layer.

## Proposed Minimum Write Model

The implementation agent should refine exact field names and relations while preserving these boundaries:

```text
Identity
  User
  CustomerProfile
  Seller
  CustomerAddress

Catalog and inventory
  Product
  Inventory
  InventoryMovement
  [InventoryReservation — now or checkout milestone]

Cart
  Cart
  CartItem

Ordering
  Order
  SellerOrder
  OrderItem
  OrderAddress
  OrderStatusHistory and/or SellerOrderStatusHistory

Payments
  PaymentAttempt
  Refund

Fulfillment
  Delivery
  DeliveryStatusHistory

Reputation
  Review

Reliability
  IdempotencyKey
```

`OutboxEvent`, processed-message/inbox tables, queue-job tables, read projections, and cache-specific structures are deferred until their corresponding architecture milestone unless the orchestrator explicitly approves them.

## Starting Sequence and Desired Adjustment Approach

### Step 1 — Inventory the existing behavior

Desired approach:

- Read the complete current Prisma schema, every migration, seed scripts, and all backend queries touching affected models.
- Trace the frontend checkout and order-history payload expectations.
- Produce an impact map showing current model/field → consumers → proposed replacement.
- Identify existing production or user-owned data that must be preserved. Do not assume the database may be reset.
- Do not edit code or schema during this step.

Expected deliverable:

- A concise impact report and a list of conflicts or decisions that require orchestrator approval.

### Step 2 — Propose the normalized schema before applying it

Desired approach:

- Draft a complete candidate `schema.prisma` or a focused schema diff.
- Explain each new aggregate boundary and important constraint.
- Include intended referential actions, uniqueness constraints, indexes, timestamps, and mapped database names.
- Show how multi-seller orders, precise money, payment retries, address snapshots, and inventory are represented.
- Keep the design implementable as a modular monolith with one PostgreSQL database.
- Stop for review before generating or applying a migration.

Expected deliverable:

- Proposed schema/diff plus a short decision log.

### Step 3 — Decide migration mode

Desired approach:

- If no valuable environment data must survive, recommend a clean version-2 baseline migration and recreate deterministic seed data.
- If data must survive, use expand–migrate–contract:
  1. add compatible tables/nullable fields;
  2. backfill and validate;
  3. switch application reads/writes;
  4. enforce required constraints;
  5. remove obsolete structures only in a later approved change.
- Never reset, drop, truncate, or destructively rewrite a database without explicit user approval.

Expected deliverable:

- A migration plan naming reversible and destructive operations separately.

### Step 4 — Add the schema and migration in an isolated change

Desired approach:

- Modify only the schema, migrations, and directly necessary database configuration or generated types.
- Use hand-authored SQL additions where Prisma cannot express required checks.
- Do not silently edit older applied migrations.
- Do not refactor controllers, services, frontend code, or introduce infrastructure in the same change.
- Ensure Prisma formatting and validation pass.

Expected deliverable:

- Reviewable schema and migration change with commands/results used for verification.

### Step 5 — Build deterministic seed profiles

Desired approach:

- Replace ad hoc random generation with a seeded generator.
- Provide at least `small`, `medium`, and `large` profiles, but initially execute only a safe local profile.
- Model skewed marketplace behavior: popular products, concentrated sellers, repeat customers, abandoned carts, payment failures, inventory pressure, delivery failures, and refunds.
- Insert in bounded batches; do not issue millions of sequential Prisma operations.
- Keep large generation opt-in and parameterized.

Expected deliverable:

- Reproducible seeds with documented record counts and execution commands.

### Step 6 — Add database-boundary tests

Desired approach:

- Test against a real disposable PostgreSQL database rather than mocking Prisma.
- Verify uniqueness, referential actions, required relations, monetary representation, and database check constraints.
- Include concurrency-oriented cases for cart uniqueness and inventory updates when the corresponding implementation exists.
- Treat schema invariants and application invariants separately; document what PostgreSQL enforces and what the later domain layer must enforce.

Expected deliverable:

- Integration tests and an invariant enforcement matrix.

### Step 7 — Verify compatibility impact and hand back to the orchestrator

Desired approach:

- Run Prisma validation/generation, backend type-checking, and relevant database tests.
- Identify every backend and frontend consumer that will break when application code migrates to the new schema.
- Do not hide expected compile failures if this is intentionally a schema-only intermediate commit; enumerate them precisely.
- Recommend the smallest next vertical slice, expected to be catalog → cart → checkout → order.

Expected deliverable:

- Verification report, known breakages, and proposed next handoff scope.

## Migration Safety Rules

- Preserve unrelated user changes in the working tree.
- Inspect Git status before editing.
- Do not reset, discard, or overwrite existing modifications.
- Do not run destructive Prisma commands such as `migrate reset` without explicit approval.
- Do not modify an already-applied migration to simulate a new migration.
- Back up or use a disposable database before testing destructive SQL.
- Keep schema design, data migration, application migration, and infrastructure introduction as separate reviewable changes.
- Prefer reversible additions before destructive removals.

## Deliberate Denormalization

Normalization does not mean eliminating all duplication. The following snapshots are desirable:

- order-item product name/reference at purchase time;
- order-item unit price and currency;
- seller identity/display name where required for durable invoices or history;
- order delivery-address snapshot;
- future read projections for dashboards and search.

The normalized transactional model is the source of truth. Read models may later be denormalized deliberately and rebuilt from source data/events.

## Out of Scope for This Milestone

- Full NestJS migration.
- Microservice extraction.
- Redis caching.
- BullMQ, RabbitMQ, or Kafka integration.
- Transactional outbox implementation unless separately approved.
- OpenTelemetry stack deployment.
- Circuit breakers and remote-provider simulators.
- Frontend redesign.
- Complete checkout endpoint implementation.
- Dashboard/read-model optimization beyond documenting compatibility impact.

## Acceptance Criteria

Before this milestone is considered complete:

- [ ] The orchestrator has approved the proposed schema and migration mode.
- [ ] Multi-seller orders have an explicit seller fulfillment boundary.
- [ ] No authoritative monetary field uses floating point.
- [ ] Purchased prices and delivery addresses are immutable snapshots.
- [ ] Cart item uniqueness is enforced by PostgreSQL.
- [ ] Inventory has a clear consistency and audit model.
- [ ] Multiple payment attempts and partial refunds are representable.
- [ ] Delivery belongs to the seller-level fulfillment boundary.
- [ ] Idempotency keys are persistently representable and scoped.
- [ ] Important foreign keys, uniqueness rules, referential actions, and access-pattern indexes are explicit.
- [ ] Prisma validation and generation succeed.
- [ ] Database-level invariant tests pass.
- [ ] Seed data is deterministic and safe by default.
- [ ] Migration risks and expected application incompatibilities are documented.
- [ ] No unrelated application or user changes were overwritten.

## Instructions to the CLI/IDE Agent

Start with **Step 1 only**. Read this document completely, inspect the repositories, and return the impact report and decision list to the user. Do not modify `schema.prisma`, migrations, application code, or seed files until the proposed schema has been reviewed and approved through the architecture orchestrator.

When a design choice is not settled here, present alternatives with consequences rather than silently choosing a materially broader architecture.
