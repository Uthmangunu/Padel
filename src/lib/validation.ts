import { z } from "zod";
export const listSchema=z.object({name:z.string().trim().min(1).max(80)});
export const playerSchema=z.object({name:z.string().trim().min(1).max(80),rating:z.number().min(1).max(10).multipleOf(0.1)});
export const sessionSchema=z.object({listId:z.string().min(1),name:z.string().trim().min(1).max(100),format:z.enum(["WINNER_STAYS","KNOCKOUT","ROUND_ROBIN","GROUPS_KNOCKOUT"]),gameRule:z.enum(["ADVANTAGE","GOLDEN_POINT"]),inputMode:z.enum(["POINTS","GAMES"]),scoringPreset:z.enum(["RACE_TO_3","RACE_TO_6","BEST_OF_3_STANDARD"]),playerIds:z.array(z.string()).min(4)});
export const scoreActionSchema=z.object({revision:z.number().int().nonnegative(),action:z.enum(["POINT","TEAM_GAME","TIEBREAK_GAME","UNDO","CONFIRM"]),winner:z.union([z.literal(0),z.literal(1)]).optional()});
