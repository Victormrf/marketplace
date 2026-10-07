import { test, expect, login, checkout, addProduct, ids } from "./fixtures.mjs";

test("checkout: real address snapshot, items, cents and persisted detail", async ({
  page,
  database,
}) => {
  await login(page);
  const orderId = await checkout(page);
  await expect(
    page.getByRole("heading", { name: `Pedido ${orderId}` }),
  ).toBeVisible();
  await expect(
    page.getByText("E2E Book 1 × 1", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText(/E2E Recipient 2/)).toBeVisible();
  await expect(page.getByText(/Total do pedido:.*25,00/)).toBeVisible();
  const order = await database.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { address: true },
  });
  expect(order.totalInCents).toBe(2500);
  expect(order.address.sourceAddressId).toBe(ids.secondAddress);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: `Pedido ${orderId}` }),
  ).toBeVisible();
  expect(await database.order.count()).toBe(2);
});

test("checkout: lost real response, refresh and same-key replay without duplication", async ({
  page,
  database,
}) => {
  await login(page);
  await addProduct(page);
  await page.goto("/cart/checkout");
  await page.getByRole("radio", { name: /E2E Recipient 2/ }).check();
  let firstKey;
  let firstAddress;
  let committedOrder;
  await page.route(
    "**/api/checkout",
    async (route) => {
      firstKey = route.request().headers()["idempotency-key"];
      firstAddress = route.request().postDataJSON().addressId;
      // Forward to Next -> backend -> PostgreSQL, consume the real committed result,
      // and only then lose its delivery to the browser. No mocked success body.
      const upstream = await route.fetch();
      expect(upstream.status()).toBe(201);
      committedOrder = (await upstream.json()).id;
      await route.abort("connectionreset");
    },
    { times: 1 },
  );
  await page.getByRole("button", { name: "Criar pedido", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({
      hasText: "A tentativa foi mantida",
    }),
  ).toBeVisible();
  expect(committedOrder).toBeTruthy();
  expect(await database.order.count()).toBe(2);
  const storageKey = `marketplace.checkout.pending.v2:${ids.customerUser}`;
  const stored = await page.evaluate(
    (key) => sessionStorage.getItem(key),
    storageKey,
  );
  expect(JSON.parse(stored)).toEqual({
    key: firstKey,
    addressId: firstAddress,
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Tentar novamente", exact: true }),
  ).toBeEnabled();
  let replayedOrderId;
  let replayedStatus;
  let replayedHeader;
  await page.route(
    "**/api/checkout",
    async (route) => {
      const upstream = await route.fetch();
      replayedStatus = upstream.status();
      replayedHeader = upstream.headers()["idempotency-replayed"];
      replayedOrderId = (await upstream.json()).id;
      await route.fulfill({ response: upstream });
    },
    { times: 1 },
  );
  const replay = page.waitForResponse((response) =>
    response.url().endsWith("/api/checkout"),
  );
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  const response = await replay;
  expect(replayedStatus).toBe(200);
  expect(replayedHeader).toBe("true");
  expect(response.request().headers()["idempotency-key"]).toBe(firstKey);
  expect(response.request().postDataJSON()).toEqual({
    addressId: firstAddress,
  });
  expect(replayedOrderId).toBe(committedOrder);
  await expect(page).toHaveURL(new RegExp(`/orders/${committedOrder}$`));
  expect(await database.order.count()).toBe(2);
  expect(await database.inventoryReservation.count()).toBe(1);
  expect(await database.inventoryMovement.count()).toBe(1);
});
