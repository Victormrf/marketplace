import { test, expect, login, password } from "./fixtures.mjs";

for (const role of ["customer", "seller"]) {
  test(`auth: ${role} login, HttpOnly, refresh and logout`, async ({
    page,
    context,
  }) => {
    await login(page, role);
    const cookie = (await context.cookies()).find(
      (item) => item.name === "token",
    );
    expect(cookie?.httpOnly).toBe(true);
    expect(await page.evaluate(() => document.cookie)).not.toContain("token=");
    await page.reload();
    await expect(
      page.getByText(`${role}@e2e.local.invalid`, { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: role === "customer" ? "E2E Customer" : "E2E Seller",
        exact: true,
      })
      .click();
    await page.getByRole("button", { name: "Sair", exact: true }).click();
    await expect(
      page.getByRole("navigation").getByRole("button", {
        name: "Entrar",
        exact: true,
      }),
    ).toBeVisible();
    expect(
      (await context.cookies()).some((item) => item.name === "token"),
    ).toBe(false);
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/login\?returnTo=/);
  });
}

test("auth: invalid credentials and direct protected access", async ({
  page,
}) => {
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/login\?returnTo=/);
  await page
    .getByLabel("E-mail", { exact: true })
    .fill("customer@e2e.local.invalid");
  await page.getByLabel("Senha", { exact: true }).fill(`${password}-wrong`);
  await page
    .getByRole("button", { name: "Entrar", exact: true })
    .last()
    .click();
  await expect(
    page.getByText("E-mail ou senha inválidos.", { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
