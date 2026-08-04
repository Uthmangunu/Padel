import { expect, test } from "@playwright/test";

test("introduces the app before opening the roster", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your whole club night, in one place." }),
  ).toBeVisible();
  for (let step = 0; step < 3; step += 1)
    await page.getByRole("button", { name: "Show me" }).click();
  await page.getByRole("button", { name: "Let's play" }).click();
  await expect(page.getByText("Your court, organised.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit rating for Youssef" }),
  ).toBeVisible();
});

test("runs a persistent race-to-three session and exposes stats", async ({
  page,
}) => {
  await page.addInitScript(() =>
    window.localStorage.setItem("padel-onboarding-v1", "done"),
  );
  await page.goto("/");
  for (const name of ["Youssef", "Saif", "Uthman", "Todimu"]) {
    await page.getByRole("checkbox", { name, exact: true }).check();
  }
  await page.getByRole("button", { name: "teams", exact: true }).click();
  await page.getByLabel("Format").selectOption("LEAGUE");
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
  await expect(
    page.getByText(/LIVE|AWAITING CONFIRMATION/i).first(),
  ).toBeVisible();
  await expect(page.getByText(/wins 3–0!/i)).toBeVisible();
  await expect(page.getByText(/result is saved/i)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm result" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm result" }).click();
  await expect(page.getByText("LEAGUE progress")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Share session" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("table")
      .getByText(/Youssef|Saif/)
      .first(),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "score", exact: true }).click();
  await expect(page.getByText("Recent sessions")).toBeVisible();
  await page
    .getByText(/Friday Padel session/i)
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Share session" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "history", exact: true }).click();
  await expect(page.getByText("Past games", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Friday Padel session history" })
    .click();
  await expect(
    page.getByRole("button", { name: "Open session" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "stats", exact: true }).click();
  await expect(page.getByText("Player statistics")).toBeVisible();
  await expect(
    page
      .getByText(/Youssef/)
      .locator("..")
      .getByText(/\d+–\d+|\d+-\d+/)
      .first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "league", exact: true }).click();
  await expect(page.getByText("League standings")).toBeVisible();
  await expect(page.getByRole("table").getByText("Youssef")).toBeVisible();
});

test("stops a live session and retains cancelled history", async ({ page }) => {
  await page.addInitScript(() =>
    window.localStorage.setItem("padel-onboarding-v1", "done"),
  );
  await page.goto("/");
  for (const name of ["Youssef", "Saif", "Uthman", "Todimu"]) {
    await page.getByRole("checkbox", { name, exact: true }).check();
  }
  await page.getByRole("button", { name: "teams", exact: true }).click();
  await page.getByRole("button", { name: "Auto-balance" }).click();
  await page.getByRole("button", { name: "Start session" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Stop live scoring" }).click();
  await expect(page.getByText(/partial session is saved as cancelled/i)).toBeVisible();
  await expect(page.getByText("cancelled").first()).toBeVisible();
});

test("starts a saved quick kickoff with four players", async ({ page }) => {
  await page.addInitScript(() =>
    window.localStorage.setItem("padel-onboarding-v1", "done"),
  );
  await page.goto("/");
  for (const name of ["Youssef", "Saif", "Uthman", "Todimu"]) {
    await page.getByRole("checkbox", { name, exact: true }).check();
  }
  await page.getByRole("button", { name: /Kick off now/i }).click();
  await expect(page.getByText("Every tap saves")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /wins game/i }).first(),
  ).toBeVisible();
});
