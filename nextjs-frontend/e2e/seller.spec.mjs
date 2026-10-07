import { test, expect, login, ids } from "./fixtures.mjs";

test("seller: products, inventory restock and own SellerOrder transition", async ({
  page,
  database,
}) => {
  await login(page, "seller");
  await page.goto(`/store/${ids.seller}/products`);
  await expect(page.getByText("E2E Book 1", { exact: true })).toBeVisible();
  await page.goto(`/store/${ids.seller}/inventory`);
  await page.getByLabel("Produto", { exact: true }).selectOption(ids.product);
  await expect(
    page.getByRole("button", { name: "Registrar reposição" }),
  ).toBeVisible();
  await page
    .getByLabel("Quantidade inteira positiva", { exact: true })
    .fill("3");
  await page
    .getByLabel("Motivo (opcional)", { exact: true })
    .fill("E2E restock");
  await page
    .getByRole("button", { name: "Registrar reposição", exact: true })
    .click();
  await expect(
    page.getByText("Físico 8 · Reservado 0", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Estoque físico (on hand)", { exact: true }).locator(".."),
  ).toContainText("8");
  expect(
    (
      await database.inventory.findUniqueOrThrow({
        where: { productId: ids.product },
      })
    ).onHandQuantity,
  ).toBe(8);
  await page.goto(`/store/${ids.seller}/orders/${ids.sellerOrder}`);
  await page
    .getByRole("button", { name: "Avançar para CONFIRMED", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Avançar para PROCESSING", exact: true }),
  ).toBeVisible();
  expect(
    (
      await database.sellerOrder.findUniqueOrThrow({
        where: { id: ids.sellerOrder },
      })
    ).status,
  ).toBe("CONFIRMED");
  expect(
    await database.sellerOrderStatusHistory.count({
      where: { sellerOrderId: ids.sellerOrder },
    }),
  ).toBe(1);
});

test("seller: another seller cannot edit the fixture product", async ({
  page,
  database,
}) => {
  await login(page, "other-seller");
  await page.goto(`/store/${ids.seller}/products`);
  // Route storeId is not an ownership credential: only the authenticated store is loaded.
  await expect(page.getByText("E2E Book 5", { exact: true })).toBeVisible();
  await expect(page.getByText("E2E Book 1", { exact: true })).toHaveCount(0);
  const denied = await page.evaluate(async (productId) => {
    const response = await fetch(`/api/products/${productId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceInCents: 1 }),
    });
    return response.status;
  }, ids.product);
  expect(denied).toBe(403);
  await page.goto(`/store/${ids.seller}/orders/${ids.sellerOrder}`);
  await expect(
    page.getByRole("alert").filter({
      hasText: "não encontrado para esta loja",
    }),
  ).toBeVisible();
  expect(
    (await database.product.findUniqueOrThrow({ where: { id: ids.product } }))
      .priceInCents,
  ).toBe(2500);
  expect(
    (
      await database.inventory.findUniqueOrThrow({
        where: { productId: ids.product },
      })
    ).onHandQuantity,
  ).toBe(5);
});
