import { expect, test } from "@playwright/test";

test("smoke: shows the mobile-first roster experience", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Your court, organised.")).toBeVisible();
});

test("runs a persistent race-to-three session and exposes stats", async ({
  page,
}) => {
  await page.goto("/");
  for (const name of ["Youssef", "Saif", "Uthman", "Todimu"]) {
    await page
      .getByText(name, { exact: true })
      .locator("..")
      .getByRole("checkbox")
      .check();
  }
  await page.getByRole("button", { name: "teams" }).click();
  await page.getByLabel("Preset").selectOption("RACE_TO_3");
  await page.getByLabel("Input").selectOption("GAMES");
  await page.getByRole("button", { name: "Auto-balance" }).click();
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(
    page.getByRole("button", { name: /wins game/i }).first(),
  ).toBeVisible();
  await page.evaluate(async () => {
    const sessions = await fetch(
      "/api/sessions?listId=default-roster&status=ACTIVE",
    ).then((response) => response.json());
    const matchId = sessions[0].matches.find(
      (match: { status: string }) => match.status === "LIVE",
    ).id;
    for (let game = 0; game < 3; game += 1) {
      const match = await fetch(`/api/matches/${matchId}`).then((response) =>
        response.json(),
      );
      const response = await fetch(`/api/matches/${matchId}/score`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          revision: match.revision,
          action: "TEAM_GAME",
          winner: 0,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
    }
  });
  await page.reload();
  await expect(page.getByText(/LIVE|AWAITING CONFIRMATION/i)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm result" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm result" }).click();
  await page.getByRole("button", { name: "stats" }).click();
  await expect(page.getByText("Player statistics")).toBeVisible();
  await expect(
    page
      .getByText(/Youssef/)
      .locator("..")
      .getByText(/\d+–\d+|\d+-\d+/)
      .first(),
  ).toBeVisible();
});
