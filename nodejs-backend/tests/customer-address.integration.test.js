const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { PrismaClient, UserRole } = require("@prisma/client");

const { UserService } = require("../dist/services/userService.js");
const { CustomerService } = require("../dist/services/customerService.js");
const { SellerService } = require("../dist/services/sellerService.js");
const { CustomerAddressService } = require("../dist/services/customerAddressService.js");
const { ForbiddenError, ObjectNotFoundError, ValidationError } = require("../dist/utils/customErrors.js");

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://marketplace_dev:marketplace_dev_password@localhost:5433/marketplace_dev";
const databaseUrl = new URL(DATABASE_URL);
if (
  !["localhost", "127.0.0.1"].includes(databaseUrl.hostname) ||
  databaseUrl.port !== "5433" ||
  databaseUrl.pathname !== "/marketplace_dev"
) {
  throw new Error("Address tests require localhost:5433/marketplace_dev");
}
process.env.DATABASE_URL = DATABASE_URL;

const prisma = new PrismaClient();
const users = new UserService();
const customers = new CustomerService();
const sellers = new SellerService();
const addresses = new CustomerAddressService();
const PREFIX = "step5-address-";
let sequence = 0;

function email(label) {
  sequence += 1;
  return `${PREFIX}${label}-${sequence}@local.invalid`;
}

const baseAddress = {
  recipientName: "  Maria da Silva  ",
  postalCode: "01310-100",
  street: "  Avenida Paulista  ",
  number: "1000",
  complement: "  Apt 10  ",
  neighborhood: "Bela Vista",
  city: "São Paulo",
  state: "sp",
  countryCode: "br",
  phone: " 5511999999999 ",
};

async function createCustomer(label = "customer") {
  const user = await users.create({ name: `Step 5 ${label}`, email: email(label), password: "local-password", role: UserRole.CUSTOMER });
  await customers.createCustomerProfile(user.id, { phone: "profile-phone" });
  return user;
}

async function cleanup() {
  const testUsers = await prisma.user.findMany({ where: { normalizedEmail: { startsWith: PREFIX } }, select: { id: true } });
  const ids = testUsers.map((user) => user.id);
  if (!ids.length) return;
  const profiles = await prisma.customerProfile.findMany({ where: { userId: { in: ids } }, select: { id: true } });
  const profileIds = profiles.map((profile) => profile.id);
  if (profileIds.length) await prisma.customerAddress.deleteMany({ where: { customerId: { in: profileIds } } });
  await prisma.customerProfile.deleteMany({ where: { id: { in: profileIds } } });
  await prisma.seller.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

before(cleanup);
after(async () => {
  await cleanup();
  const remaining = await prisma.user.count({ where: { normalizedEmail: { startsWith: PREFIX } } });
  assert.equal(remaining, 0);
  await prisma.$disconnect();
});

test("creates and normalizes a valid address", async () => {
  const user = await createCustomer("create");
  const address = await addresses.create(user.id, baseAddress);
  assert.equal(address.postalCode, "01310100");
  assert.equal(address.state, "SP");
  assert.equal(address.countryCode, "BR");
  assert.equal(address.recipientName, "Maria da Silva");
  assert.equal(address.complement, "Apt 10");
});

test("first address is default and second does not replace it", async () => {
  const user = await createCustomer("defaults");
  const first = await addresses.create(user.id, baseAddress);
  const second = await addresses.create(user.id, { ...baseAddress, recipientName: "Second" });
  assert.equal(first.isDefault, true);
  assert.equal(second.isDefault, false);
  assert.equal((await addresses.list(user.id, { page: 1, limit: 20 })).data.filter((item) => item.isDefault).length, 1);
});

test("isDefault creation and explicit default switch leave one default", async () => {
  const user = await createCustomer("switch");
  const first = await addresses.create(user.id, baseAddress);
  const second = await addresses.create(user.id, { ...baseAddress, recipientName: "Second" , isDefault: true });
  assert.equal(second.isDefault, true);
  assert.equal((await addresses.get(user.id, first.id)).isDefault, false);
  const repeated = await addresses.setDefault(user.id, second.id);
  assert.equal(repeated.isDefault, true);
  const rows = await prisma.customerAddress.findMany({ where: { customerId: (await prisma.customerProfile.findUnique({ where: { userId: user.id } })).id, isActive: true } });
  assert.equal(rows.filter((row) => row.isDefault).length, 1);
});

test("concurrent default switches never leave two defaults", async () => {
  const user = await createCustomer("concurrent");
  const first = await addresses.create(user.id, baseAddress);
  const second = await addresses.create(user.id, { ...baseAddress, recipientName: "Second" });
  const third = await addresses.create(user.id, { ...baseAddress, recipientName: "Third" });
  await Promise.all([addresses.setDefault(user.id, second.id), addresses.setDefault(user.id, third.id)]);
  const profile = await prisma.customerProfile.findUnique({ where: { userId: user.id } });
  const rows = await prisma.customerAddress.findMany({ where: { customerId: profile.id, isActive: true } });
  assert.equal(rows.filter((row) => row.isDefault).length, 1);
  assert.ok([second.id, third.id].includes(rows.find((row) => row.isDefault).id));
  assert.equal(first.isDefault, true);
});

test("lists paginated addresses in default, createdAt and id order", async () => {
  const user = await createCustomer("list");
  await addresses.create(user.id, baseAddress);
  await addresses.create(user.id, { ...baseAddress, recipientName: "Second" });
  await addresses.create(user.id, { ...baseAddress, recipientName: "Third" });
  const page = await addresses.list(user.id, { page: 1, limit: 2 });
  assert.equal(page.pagination.total, 3);
  assert.equal(page.pagination.totalPages, 2);
  assert.equal(page.data.length, 2);
  assert.equal(page.data[0].isDefault, true);
});

test("empty collection succeeds and individual lookup works", async () => {
  const user = await createCustomer("empty");
  const empty = await addresses.list(user.id, { page: 1, limit: 20 });
  assert.deepEqual(empty.data, []);
  const created = await addresses.create(user.id, baseAddress);
  assert.equal((await addresses.get(user.id, created.id)).id, created.id);
});

test("updates allowed fields and rejects empty or protected payloads", async () => {
  const user = await createCustomer("update");
  const created = await addresses.create(user.id, baseAddress);
  const updated = await addresses.update(user.id, created.id, { city: "Campinas", state: "rj", postalCode: "20000-000" });
  assert.equal(updated.city, "Campinas");
  assert.equal(updated.state, "RJ");
  assert.equal(updated.postalCode, "20000000");
  await assert.rejects(() => addresses.update(user.id, created.id, {}), ValidationError);
  await assert.rejects(() => addresses.update(user.id, created.id, { isDefault: true }), ValidationError);
  await assert.rejects(() => addresses.update(user.id, created.id, { customerId: "other" }), ValidationError);
});

test("rejects invalid postal code, country and unknown ownership fields", async () => {
  const user = await createCustomer("validation");
  await assert.rejects(() => addresses.create(user.id, { ...baseAddress, postalCode: "123" }), ValidationError);
  await assert.rejects(() => addresses.create(user.id, { ...baseAddress, countryCode: "US" }), ValidationError);
  await assert.rejects(() => addresses.create(user.id, { ...baseAddress, userId: "other" }), ValidationError);
});

test("customer cannot access, update or deactivate another customer's address", async () => {
  const owner = await createCustomer("owner");
  const other = await createCustomer("other");
  const address = await addresses.create(owner.id, baseAddress);
  await assert.rejects(() => addresses.get(other.id, address.id), ObjectNotFoundError);
  await assert.rejects(() => addresses.update(other.id, address.id, { city: "Other" }), ObjectNotFoundError);
  await assert.rejects(() => addresses.deactivate(other.id, address.id), ObjectNotFoundError);
});

test("seller cannot use customer address operations and customer without profile is rejected", async () => {
  const seller = await users.create({ name: "Step 5 Seller", email: email("seller"), password: "local-password", role: UserRole.SELLER });
  await assert.rejects(() => addresses.list(seller.id, { page: 1, limit: 20 }), ForbiddenError);
  const customer = await users.create({ name: "Step 5 No Profile", email: email("no-profile"), password: "local-password", role: UserRole.CUSTOMER });
  await assert.rejects(() => addresses.list(customer.id, { page: 1, limit: 20 }), ObjectNotFoundError);
  await sellers.getSellerProfile(seller.id).then(() => assert.fail("seller profile should not exist"), (error) => assert.ok(error instanceof ObjectNotFoundError));
});

test("deactivation is logical, hides the address, leaves no default, and is idempotent", async () => {
  const user = await createCustomer("deactivate");
  const first = await addresses.create(user.id, baseAddress);
  const second = await addresses.create(user.id, { ...baseAddress, recipientName: "Second" });
  await addresses.deactivate(user.id, first.id);
  const afterFirst = await prisma.customerAddress.findUnique({ where: { id: first.id } });
  const secondBefore = await prisma.customerAddress.findUnique({ where: { id: second.id } });
  assert.equal(afterFirst.isActive, false);
  assert.equal(afterFirst.isDefault, false);
  assert.equal(secondBefore.isDefault, false);
  await addresses.deactivate(user.id, first.id);
  const secondAfter = await prisma.customerAddress.findUnique({ where: { id: second.id } });
  assert.equal(secondAfter.updatedAt.getTime(), secondBefore.updatedAt.getTime());
  assert.deepEqual((await addresses.list(user.id, { page: 1, limit: 20 })).data.map((item) => item.id), [second.id]);
  await assert.rejects(() => addresses.update(user.id, first.id, { city: "Should not update" }), ObjectNotFoundError);
});

test("partial unique constraint rejects two active defaults and CustomerProfile.phone is unchanged", async () => {
  const user = await createCustomer("constraint");
  const profile = await prisma.customerProfile.findUnique({ where: { userId: user.id } });
  const first = await addresses.create(user.id, baseAddress);
  await assert.rejects(() => prisma.customerAddress.create({ data: { ...baseAddress, customerId: profile.id, isDefault: true }, select: { id: true } }));
  const before = await prisma.customerProfile.findUnique({ where: { id: profile.id } });
  await addresses.update(user.id, first.id, { city: "Changed" });
  const after = await prisma.customerProfile.findUnique({ where: { id: profile.id } });
  assert.equal(after.phone, before.phone);
});
