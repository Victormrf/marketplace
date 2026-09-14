const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { PrismaClient, UserRole } = require("@prisma/client");

process.env.JWT_SECRET = "step4-auth-test-secret";
const { AuthService } = require("../dist/services/authService.js");
const { UserService } = require("../dist/services/userService.js");
const { CustomerService } = require("../dist/services/customerService.js");
const { SellerService } = require("../dist/services/sellerService.js");
const { ProductService, ProductForbiddenError } = require("../dist/services/productService.js");
const { InventoryService } = require("../dist/services/inventoryService.js");
const { authMiddleware } = require("../dist/middlewares/authMiddleware.js");
const { ConflictError, ExistingProfileError, ForbiddenError, ObjectNotFoundError, ValidationError, InvalidCredentialsError } = require("../dist/utils/customErrors.js");

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://marketplace_dev:marketplace_dev_password@localhost:5433/marketplace_dev";
const databaseUrl = new URL(DATABASE_URL);
if (
  !["localhost", "127.0.0.1"].includes(databaseUrl.hostname) ||
  databaseUrl.port !== "5433" ||
  databaseUrl.pathname !== "/marketplace_dev"
) {
  throw new Error("Auth tests require localhost:5433/marketplace_dev");
}
process.env.DATABASE_URL = DATABASE_URL;

const prisma = new PrismaClient();
const auth = new AuthService();
const users = new UserService();
const customers = new CustomerService();
const sellers = new SellerService();
const products = new ProductService();
const inventory = new InventoryService();
const PREFIX = "step4-auth-";
const adminActor = { id: "00000000-0000-0000-0000-000000000001", role: "ADMIN" };
let sequence = 0;

function email(label) {
  sequence += 1;
  return `${PREFIX}${label}-${sequence}@local.invalid`;
}

async function createUser(label, role = UserRole.CUSTOMER) {
  return users.create({ name: `Step 4 ${label}`, email: email(label), password: "local-password", role });
}

async function cleanup() {
  const testUsers = await prisma.user.findMany({ where: { normalizedEmail: { startsWith: PREFIX } }, select: { id: true } });
  const ids = testUsers.map((user) => user.id);
  if (!ids.length) return;
  const testSellers = await prisma.seller.findMany({ where: { userId: { in: ids } }, select: { id: true } });
  const sellerIds = testSellers.map((seller) => seller.id);
  const testProducts = sellerIds.length
    ? await prisma.product.findMany({ where: { sellerId: { in: sellerIds } }, select: { id: true } })
    : [];
  const productIds = testProducts.map((product) => product.id);
  if (productIds.length) {
    await prisma.inventoryMovement.deleteMany({ where: { inventory: { productId: { in: productIds } } } });
    await prisma.inventory.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  }
  if (sellerIds.length) await prisma.seller.deleteMany({ where: { id: { in: sellerIds } } });
  await prisma.customerProfile.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

function requestFor(token) {
  const response = { code: 0, body: null };
  return {
    req: {
      header: (name) => name === "Authorization" ? `Bearer ${token}` : undefined,
      cookies: {},
    },
    res: {
      status(code) { response.code = code; return this; },
      json(body) { response.body = body; return this; },
    },
    response,
  };
}

before(cleanup);
after(async () => { await cleanup(); await prisma.$disconnect(); });

test("registers CUSTOMER and SELLER with safe DTOs", async () => {
  const customer = await createUser("customer", UserRole.CUSTOMER);
  const seller = await createUser("seller", UserRole.SELLER);
  assert.equal(customer.role, UserRole.CUSTOMER);
  assert.equal(seller.role, UserRole.SELLER);
  assert.equal("password" in customer, false);
});

test("rejects public ADMIN registration and unknown fields", async () => {
  await assert.rejects(() => users.create({ name: "Admin", email: email("admin"), password: "local-password", role: UserRole.ADMIN }), ValidationError);
  await assert.rejects(() => users.create({ name: "User", email: email("unknown"), password: "local-password", role: UserRole.CUSTOMER, isActive: true }), ValidationError);
});

test("persists normalizedEmail and rejects case-insensitive duplicates", async () => {
  const created = await users.create({ name: "Normalized", email: `  ${PREFIX}Case.User@Example.com `, password: "local-password", role: UserRole.CUSTOMER });
  const row = await prisma.user.findUnique({ where: { id: created.id } });
  assert.equal(row.email, `${PREFIX}case.user@example.com`);
  assert.equal(row.normalizedEmail, `${PREFIX}case.user@example.com`);
  await assert.rejects(() => users.create({ name: "Duplicate", email: `${PREFIX}CASE.USER@EXAMPLE.COM`, password: "local-password", role: UserRole.CUSTOMER }), ConflictError);
});

test("concurrent duplicate registration creates only one user", async () => {
  const address = email("concurrent");
  const results = await Promise.allSettled([
    users.create({ name: "Concurrent A", email: address, password: "local-password", role: UserRole.CUSTOMER }),
    users.create({ name: "Concurrent B", email: address.toUpperCase(), password: "local-password", role: UserRole.CUSTOMER }),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.equal(await prisma.user.count({ where: { normalizedEmail: address } }), 1);
});

test("stores a bcrypt hash and never exposes it", async () => {
  const created = await createUser("hash");
  const row = await prisma.user.findUnique({ where: { id: created.id } });
  assert.notEqual(row.password, "local-password");
  assert.equal(await bcrypt.compare("local-password", row.password), true);
  assert.equal("normalizedEmail" in created, false);
});

test("login is case-insensitive and token contains only subject identity", async () => {
  const created = await createUser("login");
  const token = await auth.login(`  ${created.email.toUpperCase()} `, "local-password");
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  assert.equal(payload.sub, created.id);
  assert.equal(payload.email, undefined);
  await assert.rejects(() => auth.login(created.email, "wrong-password"), InvalidCredentialsError);
});

test("inactive users cannot log in and middleware rejects invalid or expired tokens", async () => {
  const created = await createUser("inactive");
  await users.deactivate(created.id, adminActor);
  await assert.rejects(() => auth.login(created.email, "local-password"), InvalidCredentialsError);
  const expired = jwt.sign({ sub: created.id }, process.env.JWT_SECRET, { expiresIn: -1 });
  const invalidRequest = requestFor("not-a-token");
  await authMiddleware(invalidRequest.req, invalidRequest.res, () => { throw new Error("next must not run"); });
  assert.equal(invalidRequest.response.code, 401);
  const expiredRequest = requestFor(expired);
  await authMiddleware(expiredRequest.req, expiredRequest.res, () => { throw new Error("next must not run"); });
  assert.equal(expiredRequest.response.code, 401);
});

test("middleware uses current database role and blocks deactivated identity", async () => {
  const created = await createUser("role", UserRole.CUSTOMER);
  const token = jwt.sign({ sub: created.id, role: "ADMIN" }, process.env.JWT_SECRET);
  const request = requestFor(token);
  let nextCalled = false;
  await authMiddleware(request.req, request.res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(request.req.user.role, UserRole.CUSTOMER);
  await users.deactivate(created.id, adminActor);
  const blocked = requestFor(token);
  await authMiddleware(blocked.req, blocked.res, () => { throw new Error("next must not run"); });
  assert.equal(blocked.response.code, 401);
});

test("updates name, normalized email and password without protected fields", async () => {
  const created = await createUser("update");
  const updated = await users.update(created.id, { name: "Updated Name", email: ` ${PREFIX}New@Example.com `, password: "new-password" });
  assert.equal(updated.name, "Updated Name");
  assert.equal(updated.email, `${PREFIX}new@example.com`);
  const row = await prisma.user.findUnique({ where: { id: created.id } });
  assert.equal(row.normalizedEmail, `${PREFIX}new@example.com`);
  assert.equal(await bcrypt.compare("new-password", row.password), true);
  await assert.rejects(() => users.update(created.id, { role: UserRole.ADMIN }), ValidationError);
  await assert.rejects(() => users.update(created.id, { isActive: false }), ValidationError);
});

test("logical user deactivation preserves user and deactivates seller in one policy", async () => {
  const created = await createUser("deactivate-seller", UserRole.SELLER);
  const profile = await sellers.createSellerProfile(created.id, { storeName: "Deactivation Store" });
  await users.deactivate(created.id, adminActor);
  const user = await prisma.user.findUnique({ where: { id: created.id } });
  const seller = await prisma.seller.findUnique({ where: { id: profile.id } });
  assert.equal(user.isActive, false);
  assert.equal(seller.isActive, false);
  assert.ok(seller.deactivatedAt);
  assert.ok(user.deactivatedAt);
  assert.equal(user.deactivatedAt.getTime(), seller.deactivatedAt.getTime());
  const userTimestamp = user.deactivatedAt.getTime();
  await users.deactivate(created.id, adminActor);
  const repeatedUser = await prisma.user.findUnique({ where: { id: created.id } });
  const repeatedSeller = await prisma.seller.findUnique({ where: { id: profile.id } });
  assert.equal(repeatedUser.deactivatedAt.getTime(), userTimestamp);
  assert.equal(repeatedSeller.deactivatedAt.getTime(), userTimestamp);
});

test("seller deactivation is idempotent and preserves its original timestamp", async () => {
  const created = await createUser("seller-idempotent", UserRole.SELLER);
  const profile = await sellers.createSellerProfile(created.id, { storeName: "Seller Idempotent" });
  await sellers.deactivateSeller(created.id, adminActor);
  const first = await prisma.seller.findUnique({ where: { id: profile.id } });
  const timestamp = first.deactivatedAt.getTime();
  await sellers.deactivateSeller(created.id, adminActor);
  const second = await prisma.seller.findUnique({ where: { id: profile.id } });
  assert.equal(second.isActive, false);
  assert.equal(second.deactivatedAt.getTime(), timestamp);
});

test("authorization is checked before an idempotent deactivation return", async () => {
  const user = await createUser("auth-before-user-idempotent", UserRole.CUSTOMER);
  await users.deactivate(user.id, adminActor);
  await assert.rejects(() => users.deactivate(user.id, { id: user.id, role: UserRole.CUSTOMER }), ForbiddenError);
  const sellerUser = await createUser("auth-before-seller-idempotent", UserRole.SELLER);
  await sellers.createSellerProfile(sellerUser.id, { storeName: "Auth Before Seller" });
  await sellers.deactivateSeller(sellerUser.id, adminActor);
  await assert.rejects(() => sellers.deactivateSeller(sellerUser.id, { id: "other", role: UserRole.SELLER }), ForbiddenError);
});

test("an inactive User with an active Seller deactivates only the Seller", async () => {
  const created = await createUser("inconsistent-state", UserRole.SELLER);
  const profile = await sellers.createSellerProfile(created.id, { storeName: "Inconsistent State" });
  const originalTimestamp = new Date("2026-09-14T12:34:56.000Z");
  await prisma.user.update({ where: { id: created.id }, data: { isActive: false, deactivatedAt: originalTimestamp } });
  await users.deactivate(created.id, adminActor);
  const user = await prisma.user.findUnique({ where: { id: created.id } });
  const seller = await prisma.seller.findUnique({ where: { id: profile.id } });
  assert.equal(user.deactivatedAt.getTime(), originalTimestamp.getTime());
  assert.equal(seller.isActive, false);
  assert.ok(seller.deactivatedAt);
});

test("CUSTOMER creates only CustomerProfile and duplicate profiles are rejected", async () => {
  const created = await createUser("profile-customer", UserRole.CUSTOMER);
  const profile = await customers.createCustomerProfile(created.id, { phone: "5511999999999" });
  assert.equal(profile.userId, created.id);
  assert.equal("address" in profile, false);
  await assert.rejects(() => customers.createCustomerProfile(created.id, { phone: "x" }), ExistingProfileError);
  await assert.rejects(() => sellers.createSellerProfile(created.id, { storeName: "Not allowed" }), ForbiddenError);
});

test("SELLER creates only Seller and duplicate profiles are rejected", async () => {
  const created = await createUser("profile-seller", UserRole.SELLER);
  const profile = await sellers.createSellerProfile(created.id, { storeName: "Seller Store", description: "Description" });
  assert.equal(profile.userId, created.id);
  assert.equal("rating" in profile, false);
  await assert.rejects(() => sellers.createSellerProfile(created.id, { storeName: "Duplicate" }), ExistingProfileError);
  await assert.rejects(() => customers.createCustomerProfile(created.id, { phone: "x" }), ForbiddenError);
});

test("profiles use ownership-scoped service inputs and reject legacy fields", async () => {
  const customer = await createUser("ownership-customer", UserRole.CUSTOMER);
  const seller = await createUser("ownership-seller", UserRole.SELLER);
  await customers.createCustomerProfile(customer.id, { phone: "one" });
  await sellers.createSellerProfile(seller.id, { storeName: "One" });
  assert.equal((await customers.getCustomerProfile(customer.id)).userId, customer.id);
  assert.equal((await sellers.getSellerProfile(seller.id)).userId, seller.id);
  await assert.rejects(() => customers.updateCustomerProfile(customer.id, { address: "legacy" }), ValidationError);
  await assert.rejects(() => sellers.updateSellerProfile(seller.id, { userId: "other" }), ValidationError);
});

test("inactive seller cannot operate product or inventory", async () => {
  const created = await createUser("inactive-operations", UserRole.SELLER);
  const seller = await sellers.createSellerProfile(created.id, { storeName: "Inactive Operations" });
  const product = await prisma.product.create({ data: { sellerId: seller.id, name: "Auth Product", reference: "AUTH-INACTIVE-PRODUCT", priceInCents: 100, currency: "BRL", category: "OFFICE" } });
  await prisma.inventory.create({ data: { productId: product.id, onHandQuantity: 1, reservedQuantity: 0 } });
  await sellers.deactivateSeller(created.id, adminActor);
  await assert.rejects(() => products.updateProduct(product.id, created, { name: "Nope" }), ProductForbiddenError);
  await assert.rejects(() => inventory.restock(product.id, created, { quantity: 1 }), ObjectNotFoundError);
});

test("seed account continues to authenticate", async () => {
  const token = await auth.login(" SELLER.ONE.SEED@LOCAL.INVALID ", "dev-seed-password");
  assert.equal(jwt.verify(token, process.env.JWT_SECRET).sub, "00000000-0000-0000-0000-000000000003");
});
