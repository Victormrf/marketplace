import { test, expect, login, addProduct, ids } from "./fixtures.mjs";

test("cart: add, quantity, backend totals, refresh and removal", async ({
  page,
  database,
}) => {
  await login(page);
  await addProduct(page);
  await page.goto("/cart");
  await expect(page.getByLabel("Quantidade 1", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Aumentar quantidade de E2E Book 1" })
    .click();
  await expect(page.getByLabel("Quantidade 2", { exact: true })).toBeVisible();
  await expect(page.locator("aside strong")).toHaveText(/50,00/);
  expect((await database.cartItem.findFirstOrThrow()).quantity).toBe(2);
  await page.reload();
  await expect(page.getByLabel("Quantidade 2", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  const removal = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/cart/items/${ids.product}`) &&
      response.request().method() === "DELETE",
  );
  await page.getByRole("button", { name: "Remover", exact: true }).click();
  expect((await removal).status()).toBe(204);
  await expect(page.getByText(/Seu carrinho está vazio/)).toBeVisible();
  expect(await database.cartItem.count()).toBe(0);
});

test("cart: stock changes reject excessive quantity without changing cart", async ({
  page,
  database,
}) => {
  await login(page);
  await addProduct(page);
  await page.goto("/cart");
  await expect(page.getByLabel("Quantidade 1", { exact: true })).toBeVisible();
  // Make displayed availability stale; the real UI still submits quantity 2.
  await database.inventory.update({
    where: { productId: ids.product },
    data: { onHandQuantity: 1 },
  });
  const response = page.waitForResponse(
    (item) =>
      item.url().endsWith(`/api/cart/items/${ids.product}`) &&
      item.request().method() === "PUT",
  );
  await page
    .getByRole("button", { name: "Aumentar quantidade de E2E Book 1" })
    .click();
  expect((await response).status()).toBe(409);
  await expect(
    page.getByRole("alert").filter({
      hasText: "Estoque insuficiente",
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Quantidade 1", { exact: true })).toBeVisible();
  expect((await database.cartItem.findFirstOrThrow()).quantity).toBe(1);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Aumentar quantidade de E2E Book 1" }),
  ).toBeDisabled();
});
