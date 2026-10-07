import { test, expect, ids } from "./fixtures.mjs";

test("catalog: combined backend filters and pagination preserve URL", async ({
  page,
}) => {
  await page.goto("/products?limit=2");
  await page.getByLabel("Buscar produtos", { exact: true }).fill("E2E Book");
  await page.getByLabel("Categoria", { exact: true }).selectOption("BOOKS");
  await page.getByLabel("ID do seller", { exact: true }).fill(ids.seller);
  await page
    .getByLabel("Disponibilidade", { exact: true })
    .selectOption("true");
  await page
    .getByRole("button", { name: "Aplicar filtros", exact: true })
    .click();
  await expect(
    page.getByText(/3 produto\(s\) correspondente\(s\)/),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: /^E2E Book/ })).toHaveCount(2);
  await page.getByRole("button", { name: "Próxima", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  const query = new URL(page.url()).searchParams;
  expect(query.get("search")).toBe("E2E Book");
  expect(query.get("category")).toBe("BOOKS");
  expect(query.get("sellerId")).toBe(ids.seller);
  expect(query.get("inStock")).toBe("true");
  await expect(
    page.getByRole("heading", { name: "E2E Book 1", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: /^E2E Book/ })).toHaveCount(1);
  await page.reload();
  await expect(page.getByText(/página 2 de 2/)).toBeVisible();
});

test("catalog: available and unavailable product details", async ({ page }) => {
  await page.goto("/products?search=E2E%20Book%201");
  await page.getByRole("heading", { name: "E2E Book 1", exact: true }).click();
  await expect(
    page.getByText("5 unidades disponíveis", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Adicionar ao carrinho" }),
  ).toBeEnabled();
  await page.goto("/products?search=E2E%20Book%204");
  await expect(page.getByText("Indisponível", { exact: true })).toBeVisible();
  await page.getByRole("heading", { name: "E2E Book 4", exact: true }).click();
  await expect(
    page.getByText("Produto indisponível no momento", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Adicionar ao carrinho" }),
  ).toBeDisabled();
});
