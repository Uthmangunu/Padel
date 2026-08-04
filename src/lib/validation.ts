import { z } from "zod";
export const listSchema = z.object({ name: z.string().trim().min(1).max(80) });
export const playerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  rating: z.number().min(1).max(10).multipleOf(0.1),
});
export const sessionSchema = z.object({
  listId: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  format: z.enum([
    "WINNER_STAYS",
    "KNOCKOUT",
    "ROUND_ROBIN",
    "GROUPS_KNOCKOUT",
    "LEAGUE",
  ]),
  gameRule: z.enum(["ADVANTAGE", "GOLDEN_POINT"]),
  inputMode: z.enum(["POINTS", "GAMES"]),
  scoringPreset: z.enum(["RACE_TO_3", "RACE_TO_6", "BEST_OF_3_STANDARD"]),
  playerIds: z.array(z.string()).min(4),
  teams: z.array(z.tuple([z.string(), z.string()])).optional(),
  benchedIds: z.array(z.string()).optional(),
  constraints: z
    .array(
      z.object({
        type: z.enum(["FORCE", "BLOCK"]),
        playerA: z.string(),
        playerB: z.string(),
      }),
    )
    .optional(),
});
export const clearHistorySchema = z.object({
  confirmation: z.literal("CLEAR HISTORY"),
});
export const importHistorySchema = z.object({
  rows: z
    .array(
      z.object({
        date: z.string().datetime(),
        matchType: z.enum(["CASUAL", "LEAGUE"]),
        homePlayer1: z.string().trim().min(1).max(80),
        homePlayer2: z.string().trim().min(1).max(80),
        awayPlayer1: z.string().trim().min(1).max(80),
        awayPlayer2: z.string().trim().min(1).max(80),
        homeGames: z.number().int().min(0),
        awayGames: z.number().int().min(0),
      }),
    )
    .min(1)
    .max(500),
});
export const scoreActionSchema = z.object({
  revision: z.number().int().nonnegative(),
  action: z.enum([
    "POINT",
    "TEAM_GAME",
    "TIEBREAK_GAME",
    "TIEBREAK_WINNER",
    "UNDO",
    "CONFIRM",
  ]),
  winner: z.union([z.literal(0), z.literal(1)]).optional(),
});
