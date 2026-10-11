import {
  test,
  expect,
  login,
  checkout,
  captureViaSimulatedCallback,
} from "./fixtures.mjs";

test("payment: integral UI creation and real simulated callback capture persist", async ({
  page,
  database,
}) => {
  await login(page);
  const orderId = await checkout(page);
  await page
    .getByRole("combobox", { name: "Método de pagamento", exact: true })
    .selectOption("PIX");
  const created = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/orders/${orderId}/payment-attempts`) &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Iniciar tentativa", exact: true })
    .click();
  const response = await created;
  expect(response.status()).toBe(201);
  expect(response.request().postDataJSON()).toEqual({ method: "PIX" });
  const attempt = await response.json();
  expect(attempt.amountInCents).toBe(2500);
  expect(attempt.provider).toBe("DEV_SIMULATOR");
  await expect(
    page.getByRole("heading", { name: "PIX · CREATED", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Iniciar tentativa", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "PIX · CREATED", exact: true }),
  ).toBeVisible();
  expect(await database.paymentAttempt.count()).toBe(1);

  await captureViaSimulatedCallback(attempt.id);
  await page
    .getByRole("button", { name: "Consultar status", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "PIX · CAPTURED", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Iniciar tentativa", exact: true }),
  ).toBeDisabled();
  const reloadResponses = [];
  const onReloadResponse = (response) => {
    const path = new URL(response.url()).pathname;
    const url = new URL(response.url());
    if (
      path === `/api/orders/${orderId}` ||
      (path === `/api/orders/${orderId}/payment-attempts` &&
        !url.searchParams.has("status"))
    ) {
      reloadResponses.push(response);
    }
  };
  page.on("response", onReloadResponse);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "PIX · CAPTURED", exact: true }),
  ).toBeVisible();
  page.off("response", onReloadResponse);
  const orderResponse = reloadResponses.find(
    (response) => new URL(response.url()).pathname === `/api/orders/${orderId}`,
  );
  const attemptsResponse = reloadResponses.find((response) =>
    new URL(response.url()).pathname.endsWith("/payment-attempts"),
  );
  expect(orderResponse?.status()).toBe(200);
  expect(attemptsResponse?.status()).toBe(200);
  const persistedAttempts = await attemptsResponse.json();
  expect(persistedAttempts.data).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: attempt.id, status: "CAPTURED" }),
    ]),
  );
  await expect(
    page.getByRole("button", { name: "Iniciar tentativa", exact: true }),
  ).toHaveCount(0);
  expect(
    (await database.order.findUniqueOrThrow({ where: { id: orderId } })).status,
  ).toBe("CONFIRMED");
  expect(await database.paymentAttempt.count()).toBe(1);
  expect(
    await database.orderStatusHistory.count({
      where: { orderId, toStatus: "CONFIRMED" },
    }),
  ).toBe(1);
});
