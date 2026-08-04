"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleGauge,
  History,
  Info,
  ListPlus,
  LoaderCircle,
  Medal,
  Pencil,
  ShieldAlert,
  Shuffle,
  Sparkles,
  Trophy,
  Trash2,
  Upload,
  UserPlus,
  UsersRound,
  Zap,
} from "lucide-react";
import {
  buildBalancedTeams,
  lineupSignature,
  type Constraint,
} from "@/lib/teams";
import { formatMatchShare, formatSessionShare, whatsappUrl } from "@/lib/share";
import { roundRobinStandings } from "@/lib/formats";
import {
  initialScore,
  reduceScore,
  type GameRule as ScoringGameRule,
  type MatchScore,
  type Preset as ScoringPreset,
  type ScoreEvent,
} from "@/lib/scoring";
type List = { id: string; name: string };
type Player = { id: string; name: string; rating: number };
type Score = MatchScore;
type Match = {
  id: string;
  status: string;
  revision: number;
  startedAt?: string;
  endedAt?: string;
  score?: Score;
  homeTeam: { name: string };
  awayTeam: { name: string };
  session: {
    id: string;
    status: string;
    gameRule: string;
    inputMode: string;
    scoringPreset: string;
    format?: string;
    progression?: { queue?: string[] };
    teams?: Array<{ id: string; name: string; seed: number }>;
    matches?: Array<{
      id: string;
      homeTeamId: string;
      awayTeamId: string;
      round: number;
      group?: string | null;
      status: string;
      winnerTeamId: string | null;
      homeGames: number;
      awayGames: number;
      homeTeam: { id: string; name: string };
      awayTeam: { id: string; name: string };
    }>;
  };
};
type Format =
  "WINNER_STAYS" | "KNOCKOUT" | "ROUND_ROBIN" | "GROUPS_KNOCKOUT" | "LEAGUE";
type SavedSession = {
  id: string;
  name: string;
  status: "SETUP" | "ACTIVE" | "COMPLETE" | "CANCELLED";
  format: Format;
  inputMode: "POINTS" | "GAMES";
  scoringPreset: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  teams: Array<{ id: string; name: string; seed: number }>;
  matches: Array<{
    id: string;
    sequence: number;
    round: number;
    status: string;
    homeTeamId: string;
    awayTeamId: string;
    winnerTeamId: string | null;
    homeGames: number;
    awayGames: number;
  }>;
};
type ImportRow = {
  date: string;
  matchType: "CASUAL" | "LEAGUE";
  homePlayer1: string;
  homePlayer2: string;
  awayPlayer1: string;
  awayPlayer2: string;
  homeGames: number;
  awayGames: number;
};
const call = async <T,>(url: string, init?: RequestInit) => {
  const response = await fetch(url, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  if (!response.ok)
    throw new Error((await response.json()).error ?? "Request failed");
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
};
const tennis = (own: number, other: number) =>
  own < 3
    ? ["0", "15", "30"][own]
    : own === other || (own === 3 && other < 3)
      ? "40"
      : own > other
        ? "AD"
        : "40";
export function PadelApp({ initialLists }: { initialLists: List[] }) {
  const [lists, setLists] = useState(initialLists);
  const [listId, setListId] = useState(initialLists[0]?.id ?? "");
  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [tab, setTab] = useState<
    "roster" | "teams" | "score" | "history" | "league" | "stats"
  >("roster");
  const [teams, setTeams] = useState<ReturnType<
    typeof buildBalancedTeams
  > | null>(null);
  const [previous, setPrevious] = useState<string[][]>([]);
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [constraintA, setConstraintA] = useState("");
  const [constraintB, setConstraintB] = useState("");
  const [manual, setManual] = useState<string[][]>([]);
  const [format, setFormat] = useState<Format>("ROUND_ROBIN");
  const [preset, setPreset] = useState<
    "RACE_TO_3" | "RACE_TO_6" | "BEST_OF_3_STANDARD"
  >("BEST_OF_3_STANDARD");
  const [gameRule, setGameRule] = useState<"ADVANTAGE" | "GOLDEN_POINT">(
    "ADVANTAGE",
  );
  const [inputMode, setInputMode] = useState<"POINTS" | "GAMES">("POINTS");
  const [match, setMatch] = useState<Match | null>(null);
  const [recentSessions, setRecentSessions] = useState<SavedSession[]>([]);
  const [historyFilter, setHistoryFilter] = useState<
    "ALL" | "ACTIVE" | "COMPLETE" | "CANCELLED"
  >("ALL");
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [stats, setStats] = useState<{
    coverage: { pointModeMatches: number; totalMatches: number };
    players: Array<{
      id: string;
      name: string;
      wins: number;
      losses: number;
      gamesDifferential: number;
      performanceVsExpected: number;
      currentStreak: number;
      bestStreak: number;
      clutch: { wins: number; opportunities: number; eligibleMatches: number };
      winRate: number;
      bestPartner: { name: string; wins: number; games: number } | null;
      worstPartner: { name: string; wins: number; games: number } | null;
      headToHead: Record<string, { wins: number; losses: number }>;
      rolling10: boolean[];
    }>;
  } | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [notice, setNotice] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [scoreSaveState, setScoreSaveState] = useState<
    "idle" | "saving" | "saved"
  >("idle");
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importError, setImportError] = useState("");
  const importInput = useRef<HTMLInputElement>(null);
  const active = useMemo(
    () => lists.find((list) => list.id === listId),
    [listId, lists],
  );
  const visibleSessions = useMemo(
    () =>
      recentSessions.filter(
        (session) =>
          historyFilter === "ALL" || session.status === historyFilter,
      ),
    [historyFilter, recentSessions],
  );
  const leagueTable = useMemo(
    () =>
      [...(stats?.players ?? [])].sort(
        (a, b) =>
          b.wins - a.wins ||
          b.gamesDifferential - a.gamesDifferential ||
          b.winRate - a.winRate ||
          a.name.localeCompare(b.name),
      ),
    [stats],
  );
  const roster = players.filter((player) => selected.includes(player.id));
  useEffect(() => {
    if (window.localStorage.getItem("padel-onboarding-v1") !== "done")
      setShowOnboarding(true);
  }, []);
  const loadPlayers = () => {
    if (listId)
      void call<Player[]>(`/api/lists/${listId}/players`)
        .then(setPlayers)
        .catch((error: Error) => setNotice(error.message));
  };
  const loadHistory = () => {
    if (listId)
      void call<SavedSession[]>(`/api/sessions?listId=${listId}`)
        .then(setRecentSessions)
        .catch((error: Error) => setNotice(error.message));
  };
  useEffect(() => {
    if (listId)
      void call<Player[]>(`/api/lists/${listId}/players`)
        .then(setPlayers)
        .catch((error: Error) => setNotice(error.message));
  }, [listId]);
  useEffect(() => {
    if (!match?.startedAt || match.endedAt) return;
    const timer = window.setInterval(
      () =>
        setSeconds(
          Math.floor(
            (Date.now() - new Date(match.startedAt!).getTime()) / 1000,
          ),
        ),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [match?.startedAt, match?.endedAt]);
  useEffect(() => {
    if (!listId) return;
    void call<Array<{ matches: Array<{ id: string; status: string }> }>>(
      `/api/sessions?listId=${listId}&status=ACTIVE`,
    )
      .then((sessions) => {
        const live = sessions
          .flatMap((session) => session.matches)
          .find(
            (item) =>
              item.status === "LIVE" || item.status === "AWAITING_CONFIRMATION",
          );
        if (live) void openMatch(live.id);
      })
      .catch(() => undefined);
    void call<SavedSession[]>(`/api/sessions?listId=${listId}`)
      .then(setRecentSessions)
      .catch(() => undefined);
  }, [listId]);
  const addList = async () => {
    const name = prompt("List name");
    if (!name) return;
    const list = await call<List>("/api/lists", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    setLists((value) => [...value, list]);
    setListId(list.id);
  };
  const renameList = async () => {
    if (!active) return;
    const name = prompt("List name", active.name);
    if (!name) return;
    const item = await call<List>(`/api/lists/${active.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
    setLists((value) =>
      value.map((list) => (list.id === item.id ? item : list)),
    );
  };
  const archiveList = async () => {
    if (!active || !confirm(`Archive ${active.name}?`)) return;
    await call(`/api/lists/${active.id}`, { method: "DELETE" });
    setLists((value) => value.filter((list) => list.id !== active.id));
    setListId("");
  };
  const addPlayer = async () => {
    const name = prompt("Player name");
    const rating = Number(prompt("Rating (1.0–10.0)", "6.0"));
    if (!name) return;
    try {
      await call(`/api/lists/${listId}/players`, {
        method: "POST",
        body: JSON.stringify({ name, rating }),
      });
      loadPlayers();
    } catch (error) {
      setNotice((error as Error).message);
    }
  };
  const editPlayer = async (player: Player) => {
    const name = prompt("Player name", player.name);
    if (!name) return;
    const rating = Number(prompt("Rating", String(player.rating)));
    try {
      await call(`/api/players/${player.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, rating }),
      });
      loadPlayers();
    } catch (error) {
      setNotice((error as Error).message);
    }
  };
  const editRating = async (player: Player) => {
    const rating = Number(
      prompt(`${player.name}'s rating (1.0–10.0)`, player.rating.toFixed(1)),
    );
    if (!Number.isFinite(rating)) return;
    try {
      await call(`/api/players/${player.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: player.name, rating }),
      });
      loadPlayers();
      setNotice(`${player.name}'s rating is now ${rating.toFixed(1)}.`);
    } catch (error) {
      setNotice((error as Error).message);
    }
  };
  const deletePlayer = async (player: Player) => {
    if (!confirm(`Archive ${player.name}? Historical results remain intact.`))
      return;
    await call(`/api/players/${player.id}`, { method: "DELETE" });
    setSelected((ids) => ids.filter((id) => id !== player.id));
    loadPlayers();
  };
  const generate = (reshuffle = false) => {
    try {
      const built = buildBalancedTeams(
        roster,
        constraints,
        reshuffle ? previous : [],
      );
      setTeams(built);
      setManual(
        built.teams.map((team) => team.members.map((member) => member.id)),
      );
      setPrevious((value) => [...value, lineupSignature(built)]);
      setNotice("");
    } catch (error) {
      setNotice((error as Error).message);
    }
  };
  const addConstraint = (type: Constraint["type"]) => {
    if (!constraintA || !constraintB || constraintA === constraintB) {
      setNotice("Choose two different players for the constraint.");
      return;
    }
    setConstraints((value) => [
      ...value,
      { type, playerA: constraintA, playerB: constraintB },
    ]);
  };
  const createSession = async () => {
    if (!teams || !manual.length) return;
    const memberIds = manual.flat();
    if (new Set(memberIds).size !== memberIds.length) {
      setNotice("A player cannot be in more than one team.");
      return;
    }
    try {
      const session = await call<{ matches: Array<{ id: string }> }>(
        "/api/sessions",
        {
          method: "POST",
          body: JSON.stringify({
            listId,
            name: `${active?.name ?? "Padel"} session`,
            format,
            gameRule,
            inputMode,
            scoringPreset: preset,
            playerIds: selected,
            teams: manual.map((pair) => [pair[0], pair[1]]),
            benchedIds: selected.filter((id) => !memberIds.includes(id)),
            constraints,
          }),
        },
      );
      setNotice(
        "Session started. Team snapshots and live score are now persisted.",
      );
      if (session.matches[0]) await openMatch(session.matches[0].id);
      void call<SavedSession[]>(`/api/sessions?listId=${listId}`).then(
        setRecentSessions,
      );
    } catch (error) {
      setNotice((error as Error).message);
    }
  };
  const startQuickKickoff = async () => {
    if (roster.length !== 4) {
      setNotice("Quick Kickoff needs exactly four selected players.");
      return;
    }
    try {
      const quickTeams = buildBalancedTeams(roster);
      const session = await call<{ matches: Array<{ id: string }> }>(
        "/api/sessions",
        {
          method: "POST",
          body: JSON.stringify({
            listId,
            name: `Quick kickoff · ${new Intl.DateTimeFormat(undefined, {
              dateStyle: "medium",
            }).format(new Date())}`,
            format: "ROUND_ROBIN",
            gameRule: "GOLDEN_POINT",
            inputMode: "GAMES",
            scoringPreset: "RACE_TO_3",
            playerIds: selected,
            teams: quickTeams.teams.map((team) => [
              team.members[0].id,
              team.members[1].id,
            ]),
            benchedIds: [],
          }),
        },
      );
      setNotice("Quick Kickoff is live. Every game is saved automatically.");
      if (session.matches[0]) await openMatch(session.matches[0].id);
      void call<SavedSession[]>(`/api/sessions?listId=${listId}`).then(
        setRecentSessions,
      );
    } catch (error) {
      setNotice((error as Error).message);
    }
  };
  const openMatch = async (id: string) => {
    try {
      setMatch(await call<Match>(`/api/matches/${id}`));
      setTab("score");
    } catch (error) {
      setNotice((error as Error).message);
    }
  };
  const score = async (
    action:
      | "POINT"
      | "TEAM_GAME"
      | "TIEBREAK_GAME"
      | "TIEBREAK_WINNER"
      | "UNDO"
      | "CONFIRM",
    winner?: 0 | 1,
  ) => {
    if (!match || scoreSaveState === "saving") return;
    const before = match;
    setScoreSaveState("saving");
    if (action !== "UNDO" && action !== "CONFIRM" && winner !== undefined) {
      const optimistic = reduceScore(
        match.score ?? initialScore(),
        { type: action as ScoreEvent["type"], winner },
        match.session.scoringPreset as ScoringPreset,
        match.session.gameRule as ScoringGameRule,
      );
      setMatch({
        ...match,
        score: optimistic,
        status:
          optimistic.winner === undefined ? "LIVE" : "AWAITING_CONFIRMATION",
      });
    }
    try {
      const updated = await call<Match>(`/api/matches/${before.id}/score`, {
        method: "POST",
        body: JSON.stringify({ revision: before.revision, action, winner }),
      });
      setMatch({ ...before, ...updated });
      setScoreSaveState("saved");
      window.setTimeout(() => setScoreSaveState("idle"), 1200);
      if (action !== "CONFIRM" && updated.score?.winner !== undefined) {
        const winnerName =
          updated.score.winner === 0
            ? before.homeTeam.name
            : before.awayTeam.name;
        setNotice(
          `${winnerName} wins ${updated.score.totalGames[0]}–${updated.score.totalGames[1]}. Result saved — confirm it to finish.`,
        );
      }
      if (action === "CONFIRM") {
        const sessions = await call<
          Array<{ matches: Array<{ id: string; status: string }> }>
        >(`/api/sessions?listId=${listId}&status=ACTIVE`);
        const next = sessions
          .flatMap((session) => session.matches)
          .find((item) => item.status === "LIVE");
        if (next) await openMatch(next.id);
        else {
          await openMatch(before.id);
          setNotice(
            "Session complete — final standings and sharing remain available.",
          );
        }
        void call<SavedSession[]>(`/api/sessions?listId=${listId}`).then(
          setRecentSessions,
        );
      }
    } catch (error) {
      setMatch(before);
      setScoreSaveState("idle");
      setNotice((error as Error).message);
    }
  };
  const loadStats = (leagueOnly = false) => {
    if (listId)
      void call<typeof stats>(
        `/api/stats?listId=${listId}&from=${from}&to=${to}${leagueOnly ? "&format=LEAGUE" : ""}`,
      )
        .then(setStats)
        .catch((error: Error) => setNotice(error.message));
  };
  const share = async () => {
    if (
      !match ||
      (match.status !== "AWAITING_CONFIRMATION" && match.status !== "CONFIRMED")
    )
      return;
    const text = formatMatchShare({
      session: active?.name ?? "Padel session",
      home: match.homeTeam.name,
      away: match.awayTeam.name,
      score: match.score?.totalGames.join("–") ?? "0–0",
      winner:
        match.score?.winner === 0 ? match.homeTeam.name : match.awayTeam.name,
    });
    if (navigator.share) await navigator.share({ title: "Padel result", text });
    else {
      await navigator.clipboard.writeText(text);
      window.open(whatsappUrl(text), "_blank", "noopener");
      setNotice("Copied result and opened WhatsApp sharing.");
    }
  };
  const shareSession = async () => {
    if (!match?.session.matches) return;
    const text = formatSessionShare({
      session: active?.name ?? "Padel session",
      format: match.session.format?.replaceAll("_", " ") ?? "Session",
      fixtures: match.session.matches
        .filter((item) => item.status === "CONFIRMED")
        .map((item) => ({
          home: item.homeTeam.name,
          away: item.awayTeam.name,
          score: `${item.homeGames}–${item.awayGames}`,
          winner:
            item.winnerTeamId === item.homeTeam.id
              ? item.homeTeam.name
              : item.winnerTeamId === item.awayTeam.id
                ? item.awayTeam.name
                : undefined,
        })),
    });
    if (navigator.share)
      await navigator.share({ title: "Padel session", text });
    else {
      await navigator.clipboard.writeText(text);
      window.open(whatsappUrl(text), "_blank", "noopener");
    }
  };
  const finishOnboarding = () => {
    window.localStorage.setItem("padel-onboarding-v1", "done");
    setShowOnboarding(false);
    setOnboardingStep(0);
  };
  const shareSavedSession = async (session: SavedSession) => {
    if (session.status !== "COMPLETE") return;
    const teamNames = new Map(
      session.teams.map((team) => [team.id, team.name]),
    );
    const text = formatSessionShare({
      session: session.name,
      format: session.format.replaceAll("_", " "),
      fixtures: session.matches
        .filter((item) => item.status === "CONFIRMED")
        .map((item) => ({
          home: teamNames.get(item.homeTeamId) ?? "Home",
          away: teamNames.get(item.awayTeamId) ?? "Away",
          score: `${item.homeGames}–${item.awayGames}`,
          winner: item.winnerTeamId
            ? teamNames.get(item.winnerTeamId)
            : undefined,
        })),
    });
    if (navigator.share) await navigator.share({ title: session.name, text });
    else {
      await navigator.clipboard.writeText(text);
      window.open(whatsappUrl(text), "_blank", "noopener");
      setNotice("Session recap copied and ready to share.");
    }
  };
  const stopLiveScoring = async () => {
    if (
      !match?.session.id ||
      !confirm(
        "Stop scoring? The partial score will be kept as cancelled history.",
      )
    )
      return;
    try {
      await call(`/api/sessions/${match.session.id}/cancel`, {
        method: "POST",
      });
      setMatch(null);
      setTab("history");
      loadHistory();
      setNotice(
        "Live scoring stopped. The partial session is saved as cancelled history.",
      );
    } catch (error) {
      setNotice((error as Error).message);
    }
  };
  const deleteSession = async (session: SavedSession) => {
    if (!confirm(`Delete ${session.name}? This cannot be undone.`)) return;
    try {
      await call(`/api/sessions/${session.id}`, { method: "DELETE" });
      setExpandedSession(null);
      loadHistory();
      loadStats();
      setNotice("Session deleted.");
    } catch (error) {
      setNotice((error as Error).message);
    }
  };
  const clearHistory = async () => {
    if (
      prompt(
        "Type CLEAR HISTORY to delete completed and cancelled sessions.",
      ) !== "CLEAR HISTORY"
    )
      return;
    try {
      const result = await call<{ removed: number }>(
        `/api/lists/${listId}/history`,
        {
          method: "DELETE",
          body: JSON.stringify({ confirmation: "CLEAR HISTORY" }),
        },
      );
      setExpandedSession(null);
      loadHistory();
      loadStats();
      setNotice(
        `${result.removed} historical session${result.removed === 1 ? "" : "s"} deleted. Active scoring was left alone.`,
      );
    } catch (error) {
      setNotice((error as Error).message);
    }
  };
  const downloadImportTemplate = () => {
    const csv =
      "date,match_type,home_player_1,home_player_2,away_player_1,away_player_2,home_games,away_games\\n2026-08-04,LEAGUE,Youssef,Saif,Uthman,Todimu,3,1\\n";
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = "padel-history-template.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const readImport = async (file?: File) => {
    if (!file) return;
    const lines = (await file.text())
      .replace(/^\uFEFF/, "")
      .trim()
      .split(/\r?\n/);
    const expected =
      "date,match_type,home_player_1,home_player_2,away_player_1,away_player_2,home_games,away_games";
    if (!lines.length || lines[0].trim().toLowerCase() !== expected) {
      setImportRows([]);
      setImportError(
        "Use the downloaded CSV template and keep its header unchanged.",
      );
      return;
    }
    const parsed: ImportRow[] = [];
    for (const [index, line] of lines.slice(1).entries()) {
      const cells = line.split(",").map((cell) => cell.trim());
      if (cells.length !== 8 || cells.some((cell) => !cell)) {
        setImportRows([]);
        setImportError(
          `Row ${index + 2} needs all eight comma-separated values.`,
        );
        return;
      }
      const [
        date,
        kind,
        homePlayer1,
        homePlayer2,
        awayPlayer1,
        awayPlayer2,
        homeGames,
        awayGames,
      ] = cells;
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !["CASUAL", "LEAGUE"].includes(kind.toUpperCase()) ||
        !/^\d+$/.test(homeGames) ||
        !/^\d+$/.test(awayGames)
      ) {
        setImportRows([]);
        setImportError(`Row ${index + 2} has an invalid date, type, or score.`);
        return;
      }
      parsed.push({
        date: new Date(`${date}T12:00:00.000Z`).toISOString(),
        matchType: kind.toUpperCase() as "CASUAL" | "LEAGUE",
        homePlayer1,
        homePlayer2,
        awayPlayer1,
        awayPlayer2,
        homeGames: Number(homeGames),
        awayGames: Number(awayGames),
      });
    }
    setImportError("");
    setImportRows(parsed);
  };
  const importHistory = async () => {
    if (!importRows.length) return;
    try {
      const result = await call<{ imported: number }>(
        `/api/lists/${listId}/history/import`,
        {
          method: "POST",
          body: JSON.stringify({ rows: importRows }),
        },
      );
      setImportRows([]);
      if (importInput.current) importInput.current.value = "";
      loadPlayers();
      loadHistory();
      loadStats();
      setNotice(
        `${result.imported} historical match${result.imported === 1 ? "" : "es"} imported.`,
      );
    } catch (error) {
      setImportError((error as Error).message);
    }
  };
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const onboardingSlides = [
    {
      icon: UsersRound,
      kicker: "WELCOME TO PADEL PARTY",
      title: "Your whole club night, in one place.",
      copy: "Keep an open-ended roster, choose who's playing tonight and leave the spreadsheet at home.",
    },
    {
      icon: Shuffle,
      kicker: "BALANCE THE CHAOS",
      title: "Fair teams without the politics.",
      copy: "Ratings, forced pairs, blocked pairs and genuine reshuffles help you build matchups everyone can argue about equally.",
    },
    {
      icon: Trophy,
      kicker: "RUN THE COURT",
      title: "Score live. Undo mistakes. Keep moving.",
      copy: "Every tap is saved, refresh-safe and undoable until you confirm the result. The next fixture is handled for you.",
    },
    {
      icon: History,
      kicker: "KEEP THE RECEIPTS",
      title: "Every session becomes club history.",
      copy: "Come back to past fixtures, scores and formats whenever you want—then share the recap with the group chat.",
    },
  ];
  const onboarding = onboardingSlides[onboardingStep];
  const OnboardingIcon = onboarding.icon;
  return (
    <main className="shell">
      {showOnboarding && (
        <div className="onboarding-backdrop">
          <section
            className="onboarding-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-title"
          >
            <button className="skip-intro" onClick={finishOnboarding}>
              Skip intro
            </button>
            <div className="onboarding-art" data-step={onboardingStep}>
              <OnboardingIcon size={52} strokeWidth={2.4} />
              <span>{String(onboardingStep + 1).padStart(2, "0")}</span>
            </div>
            <div className="onboarding-copy">
              <span className="kicker">{onboarding.kicker}</span>
              <h2 id="onboarding-title">{onboarding.title}</h2>
              <p>{onboarding.copy}</p>
            </div>
            <div className="onboarding-dots" aria-label="Onboarding progress">
              {onboardingSlides.map((slide, index) => (
                <span
                  key={slide.kicker}
                  data-active={index === onboardingStep}
                />
              ))}
            </div>
            <div className="onboarding-actions">
              {onboardingStep > 0 ? (
                <button
                  className="btn btn-secondary"
                  onClick={() => setOnboardingStep((step) => step - 1)}
                >
                  <ArrowLeft size={18} /> Back
                </button>
              ) : (
                <span />
              )}
              <button
                className="btn btn-coral"
                onClick={() =>
                  onboardingStep === onboardingSlides.length - 1
                    ? finishOnboarding()
                    : setOnboardingStep((step) => step + 1)
                }
              >
                {onboardingStep === onboardingSlides.length - 1
                  ? "Let's play"
                  : "Show me"}
                <ArrowRight size={18} />
              </button>
            </div>
          </section>
        </div>
      )}
      <div className="topbar">
        <div className="brand-lockup">
          <span className="brand-ball">P</span>
          <span>
            <b>PADEL PARTY</b>
            <small>Match night, minus the admin drama.</small>
          </span>
        </div>
        <div className="list-tools">
          <button
            className="btn btn-secondary"
            onClick={() => {
              setOnboardingStep(0);
              setShowOnboarding(true);
            }}
          >
            <Info size={18} /> How it works
          </button>
          <select
            className="field list-picker"
            aria-label="Active list"
            value={listId}
            onChange={(event) => {
              setListId(event.target.value);
              setSelected([]);
            }}
          >
            <option value="">Choose list</option>
            {lists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name}
              </option>
            ))}
          </select>
          <button
            className="icon-btn"
            aria-label="Rename list"
            title="Rename list"
            onClick={renameList}
          >
            <Pencil size={18} />
          </button>
          <button
            className="icon-btn"
            aria-label="Archive list"
            title="Archive list"
            onClick={archiveList}
          >
            <Archive size={18} />
          </button>
          <button className="btn btn-coral" onClick={addList}>
            <ListPlus size={18} /> New list
          </button>
        </div>
      </div>
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <Sparkles size={16} /> THE GROUP CHAT&apos;S NEW CAPTAIN
          </p>
          <h1>Your court, organised.</h1>
          <p className="hero-lede">
            Pick the crew, split the talent, settle the score. No spreadsheets.
            No suspiciously convenient team selections.
          </p>
          <div className="hero-chips">
            <span>
              <UsersRound size={17} /> Roster grows with you
            </span>
            <span>
              <Zap size={17} /> {selected.length} ready to cook
            </span>
          </div>
        </div>
        <span className="hero-sticker">
          NO BORING
          <br />
          TEAMS
        </span>
      </header>
      <p className="public-note">
        <ShieldAlert size={19} />
        <span>
          <b>Open court.</b> Anyone with this link can edit the roster and
          results. Keep sensitive records off it.
        </span>
      </p>
      <nav className="app-nav">
        {(
          [
            ["roster", UsersRound, "The crew"],
            ["teams", Shuffle, "Team chaos"],
            ["score", Trophy, "Score it"],
            ["history", History, "History"],
            ["league", Medal, "League"],
            ["stats", BarChart3, "Receipts"],
          ] as const
        ).map(([item, Icon, label]) => (
          <button
            key={item}
            className="tab"
            aria-label={item}
            data-active={tab === item}
            onClick={() => {
              setTab(item);
              if (item === "stats" || item === "league")
                loadStats(item === "league");
            }}
          >
            <Icon size={19} /> <span>{label}</span>
          </button>
        ))}
      </nav>
      {notice && (
        <p role="status" className="bg-mint mb-4 rounded-xl p-3 text-sm">
          {notice}
        </p>
      )}
      {tab === "roster" && (
        <section className="card roster-section">
          <div className="section-heading">
            <div>
              <span className="kicker">STEP 01 · CHOOSE YOUR FIGHTERS</span>
              <h2>Who&apos;s causing trouble tonight?</h2>
              <p>
                Tap everyone who&apos;s actually turning up. Bold of us to trust
                the group chat.
              </p>
            </div>
            <div className="roster-actions">
              <button
                className="btn btn-coral"
                disabled={selected.length !== 4}
                onClick={startQuickKickoff}
              >
                <Zap size={18} /> Quick Kickoff · pick 4
              </button>
              <button className="btn" onClick={addPlayer}>
                <UserPlus size={18} /> Add player
              </button>
            </div>
          </div>
          {selected.length > 0 && (
            <div className="selection-strip">
              <span>
                <b>{selected.length} picked.</b> Enough talent? We&apos;ll see.
              </span>
              <div className="selection-actions">
                {selected.length === 4 && (
                  <button className="btn btn-coral" onClick={startQuickKickoff}>
                    Kick off now <Zap size={17} />
                  </button>
                )}
                <button
                  className="btn btn-lime"
                  onClick={() => setTab("teams")}
                >
                  Make the teams <Shuffle size={17} />
                </button>
              </div>
            </div>
          )}
          <div className="player-grid">
            {players.map((player, index) => (
              <div
                key={player.id}
                className="player-card"
                data-selected={selected.includes(player.id)}
                data-tone={index % 6}
              >
                <label className="player-main">
                  <input
                    type="checkbox"
                    aria-label={player.name}
                    checked={selected.includes(player.id)}
                    onChange={() =>
                      setSelected((ids) =>
                        ids.includes(player.id)
                          ? ids.filter((id) => id !== player.id)
                          : [...ids, player.id],
                      )
                    }
                  />
                  <span className="avatar" aria-hidden="true">
                    {player.name.slice(0, 1)}
                  </span>
                  <span className="player-name">
                    <b>{player.name}</b>
                    <small>Player rating</small>
                  </span>
                </label>
                <span className="player-actions">
                  <span className="rating">
                    <CircleGauge size={15} /> {player.rating.toFixed(1)}
                  </span>
                  <button
                    className="rating-edit"
                    aria-label={`Edit rating for ${player.name}`}
                    onClick={() => editRating(player)}
                  >
                    Edit rating
                  </button>
                  <button
                    aria-label={`Edit name for ${player.name}`}
                    onClick={() => editPlayer(player)}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    aria-label={`Archive ${player.name}`}
                    onClick={() => deletePlayer(player)}
                  >
                    ×
                  </button>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
      {tab === "teams" && (
        <section className="arena-layout grid-2 grid">
          <div className="card team-builder">
            <span className="kicker">STEP 02 · LET THE MATH COOK</span>
            <h2 className="mt-1">Build the court</h2>
            <p className="section-copy">
              Fair teams, spicy matchups, absolutely no picking your best mate
              just because he drove.
            </p>
            <div className="grid-2 grid">
              <label>
                Format
                <select
                  className="field"
                  value={format}
                  onChange={(event) => setFormat(event.target.value as Format)}
                >
                  <option value="ROUND_ROBIN">Round robin</option>
                  <option value="LEAGUE">League (official standings)</option>
                  <option value="WINNER_STAYS">Winner stays on</option>
                  <option value="KNOCKOUT">Knockout</option>
                  <option value="GROUPS_KNOCKOUT">Groups + knockout</option>
                </select>
              </label>
              <label>
                Preset
                <select
                  className="field"
                  value={preset}
                  onChange={(event) =>
                    setPreset(event.target.value as typeof preset)
                  }
                >
                  <option value="RACE_TO_3">Race to 3</option>
                  <option value="RACE_TO_6">Race to 6</option>
                  <option value="BEST_OF_3_STANDARD">Best of 3 sets</option>
                </select>
              </label>
              <label>
                Games
                <select
                  className="field"
                  value={gameRule}
                  onChange={(event) =>
                    setGameRule(event.target.value as typeof gameRule)
                  }
                >
                  <option value="ADVANTAGE">Advantage</option>
                  <option value="GOLDEN_POINT">Golden point</option>
                </select>
              </label>
              <label>
                Input
                <select
                  className="field"
                  value={inputMode}
                  onChange={(event) =>
                    setInputMode(event.target.value as typeof inputMode)
                  }
                >
                  <option value="POINTS">Point by point</option>
                  <option value="GAMES">Game winner only</option>
                </select>
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn" onClick={() => generate()}>
                <Zap size={18} /> Auto-balance
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => generate(true)}
              >
                <Shuffle size={18} /> Genuine reshuffle
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => addConstraint("FORCE")}
              >
                Force pair
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => addConstraint("BLOCK")}
              >
                Block pair
              </button>
            </div>
            <div className="grid-2 mt-3 grid">
              <select
                className="field"
                aria-label="First constrained player"
                value={constraintA}
                onChange={(event) => setConstraintA(event.target.value)}
              >
                <option value="">First player</option>
                {roster.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
              <select
                className="field"
                aria-label="Second constrained player"
                value={constraintB}
                onChange={(event) => setConstraintB(event.target.value)}
              >
                <option value="">Second player</option>
                {roster.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </div>
            {constraints.length > 0 && (
              <div className="text-sm">
                Constraints:{" "}
                {constraints.map((item, index) => (
                  <button
                    key={`${item.type}-${index}`}
                    className="pill mr-2"
                    onClick={() =>
                      setConstraints((value) =>
                        value.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    {item.type.toLowerCase()}{" "}
                    {roster.find((player) => player.id === item.playerA)?.name}{" "}
                    /{" "}
                    {roster.find((player) => player.id === item.playerB)?.name}{" "}
                    ×
                  </button>
                ))}
              </div>
            )}
            {teams && (
              <>
                <p className="balance-readout">
                  <Sparkles size={17} /> Rating spread:{" "}
                  <b>{teams.imbalance.toFixed(1)}</b>. The algorithm has spoken.
                </p>
                <div className="team-stack grid">
                  {teams.teams.map((team, index) => (
                    <div
                      key={index}
                      className="team-card"
                      data-team-tone={index % 4}
                    >
                      <span className="team-number">TEAM {index + 1}</span>
                      <span className="rating float-right">
                        {team.total.toFixed(1)}
                      </span>
                      <p className="team-names">
                        {team.members.map((member) => member.name).join(" + ")}
                      </p>
                      <select
                        className="field"
                        value={manual[index]?.[0] ?? ""}
                        onChange={(event) =>
                          setManual((value) =>
                            value.map((pair, pairIndex) =>
                              pairIndex === index
                                ? [event.target.value, pair[1]]
                                : pair,
                            ),
                          )
                        }
                      >
                        {roster.map((player) => (
                          <option key={player.id} value={player.id}>
                            {player.name}
                          </option>
                        ))}
                      </select>
                      <select
                        className="field mt-2"
                        value={manual[index]?.[1] ?? ""}
                        onChange={(event) =>
                          setManual((value) =>
                            value.map((pair, pairIndex) =>
                              pairIndex === index
                                ? [pair[0], event.target.value]
                                : pair,
                            ),
                          )
                        }
                      >
                        {roster.map((player) => (
                          <option key={player.id} value={player.id}>
                            {player.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                {teams.benched.length > 0 && (
                  <p>
                    Benched:{" "}
                    {teams.benched.map((player) => player.name).join(", ")}
                  </p>
                )}
                <button className="btn btn-coral mt-4" onClick={createSession}>
                  <Trophy size={18} /> Start session
                </button>
              </>
            )}
          </div>
          <aside className="card house-rules">
            <span className="house-emoji">🏓</span>
            <span className="kicker">HOUSE RULES</span>
            <h2>Once the ball&apos;s live, no funny business.</h2>
            <p>
              Teams, participant snapshots and scoring configuration freeze when
              a session starts. An odd player is explicitly benched.
            </p>
            <div className="sassy-note">
              “But I wanted Saif!” — denied by the algorithm.
            </div>
          </aside>
        </section>
      )}
      {tab === "score" && (
        <section>
          {!match ? (
            <div className="card empty-court">
              <span className="empty-ball">●</span>
              <span className="kicker">THE COURT IS SUSPICIOUSLY QUIET</span>
              <h2>No live match</h2>
              <p>
                Build the teams, start the session, then let the arguments
                begin.
              </p>
              {recentSessions.length > 0 && (
                <div className="mt-4">
                  <b>Recent sessions</b>
                  <div className="mt-2 grid">
                    {recentSessions.slice(0, 5).map((session) => {
                      const last = [...session.matches].sort(
                        (a, b) => b.sequence - a.sequence,
                      )[0];
                      return (
                        <button
                          key={session.id}
                          className="btn btn-secondary text-left"
                          disabled={!last}
                          onClick={() => last && openMatch(last.id)}
                        >
                          {session.name} ·{" "}
                          {session.status.toLowerCase().replaceAll("_", " ")}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="card scoreboard mx-auto max-w-3xl">
              <div className="score-topline flex justify-between">
                <span className="pill">
                  {match.status.replaceAll("_", " ")}
                </span>
                <span className="score-sync" role="status">
                  {scoreSaveState === "saving" ? (
                    <>
                      <LoaderCircle className="spin" size={16} /> Saving…
                    </>
                  ) : scoreSaveState === "saved" ? (
                    <>
                      <CheckCircle2 size={16} /> Saved
                    </>
                  ) : (
                    "Every tap saves"
                  )}
                </span>
                <b aria-label="Match clock">{clock}</b>
              </div>
              <div className="score-teams grid-2 my-7 grid text-center">
                <div className="score-side score-home">
                  <h2>{match.homeTeam.name}</h2>
                  <strong className="text-6xl">
                    {match.score?.games[0] ?? 0}
                  </strong>
                  <p>
                    {match.score?.sets[0] ?? 0} sets ·{" "}
                    {match.score?.tiebreak?.[0] ??
                      tennis(
                        match.score?.points[0] ?? 0,
                        match.score?.points[1] ?? 0,
                      )}{" "}
                    {match.score?.tiebreak ? "tiebreak" : "points"}
                  </p>
                </div>
                <div className="score-side score-away">
                  <h2>{match.awayTeam.name}</h2>
                  <strong className="text-6xl">
                    {match.score?.games[1] ?? 0}
                  </strong>
                  <p>
                    {match.score?.sets[1] ?? 0} sets ·{" "}
                    {match.score?.tiebreak?.[1] ??
                      tennis(
                        match.score?.points[1] ?? 0,
                        match.score?.points[0] ?? 0,
                      )}{" "}
                    {match.score?.tiebreak ? "tiebreak" : "points"}
                  </p>
                </div>
              </div>
              {match.score?.winner !== undefined && (
                <div className="victory-banner" role="status">
                  <Trophy size={38} />
                  <span>
                    <b>
                      {match.score.winner === 0
                        ? match.homeTeam.name
                        : match.awayTeam.name}{" "}
                      wins {match.score.totalGames[0]}–
                      {match.score.totalGames[1]}!
                    </b>
                    <small>
                      The match has stopped and the result is saved. Confirm it
                      to lock the result and continue.
                    </small>
                  </span>
                </div>
              )}
              {match.status === "LIVE" && (
                <div className="score-actions grid-2 grid">
                  <button
                    className="btn min-h-20"
                    disabled={scoreSaveState === "saving"}
                    onClick={() =>
                      score(
                        match.score?.tiebreak
                          ? match.session.inputMode === "GAMES"
                            ? "TIEBREAK_WINNER"
                            : "TIEBREAK_GAME"
                          : match.session.inputMode === "POINTS"
                            ? "POINT"
                            : "TEAM_GAME",
                        0,
                      )
                    }
                  >
                    {match.homeTeam.name} wins{" "}
                    {match.score?.tiebreak
                      ? match.session.inputMode === "GAMES"
                        ? "tiebreak"
                        : "tiebreak point"
                      : match.session.inputMode === "POINTS"
                        ? "point"
                        : "game"}
                  </button>
                  <button
                    className="btn min-h-20"
                    disabled={scoreSaveState === "saving"}
                    onClick={() =>
                      score(
                        match.score?.tiebreak
                          ? match.session.inputMode === "GAMES"
                            ? "TIEBREAK_WINNER"
                            : "TIEBREAK_GAME"
                          : match.session.inputMode === "POINTS"
                            ? "POINT"
                            : "TEAM_GAME",
                        1,
                      )
                    }
                  >
                    {match.awayTeam.name} wins{" "}
                    {match.score?.tiebreak
                      ? match.session.inputMode === "GAMES"
                        ? "tiebreak"
                        : "tiebreak point"
                      : match.session.inputMode === "POINTS"
                        ? "point"
                        : "game"}
                  </button>
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="btn btn-secondary"
                  disabled={scoreSaveState === "saving"}
                  onClick={() => score("UNDO")}
                >
                  Undo
                </button>
                {match.status === "AWAITING_CONFIRMATION" && (
                  <button
                    className="btn btn-coral"
                    disabled={scoreSaveState === "saving"}
                    onClick={() => score("CONFIRM")}
                  >
                    Confirm result
                  </button>
                )}
                {(match.status === "AWAITING_CONFIRMATION" ||
                  match.status === "CONFIRMED") && (
                  <button className="btn btn-secondary" onClick={share}>
                    Share result
                  </button>
                )}
                {(match.status === "LIVE" ||
                  match.status === "AWAITING_CONFIRMATION") && (
                  <button
                    className="btn btn-secondary"
                    onClick={stopLiveScoring}
                  >
                    Stop live scoring
                  </button>
                )}
              </div>
              {match.session.matches && (
                <section className="mt-5 rounded-xl bg-[#f4f0e7] p-3 text-sm">
                  <b>{match.session.format?.replaceAll("_", " ")} progress</b>
                  {match.session.progression?.queue && (
                    <p>
                      Winner Stays queue:{" "}
                      {match.session.progression.queue.join(" → ") ||
                        "court rotation complete"}
                    </p>
                  )}
                  <ul className="mt-2 space-y-1">
                    {match.session.matches.map((item) => (
                      <li key={item.id}>
                        R{item.round}
                        {item.group ? ` · Group ${item.group}` : ""}:{" "}
                        {item.homeTeam.name} vs {item.awayTeam.name}{" "}
                        <span className="pill">
                          {item.status.replaceAll("_", " ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {match.session.status === "COMPLETE" && (
                    <button
                      className="btn btn-secondary mt-3"
                      onClick={shareSession}
                    >
                      Share session
                    </button>
                  )}
                  {(match.session.format === "ROUND_ROBIN" ||
                    match.session.format === "LEAGUE") && (
                    <table className="mt-3 w-full text-left">
                      <thead>
                        <tr>
                          <th>Team</th>
                          <th>P</th>
                          <th>W</th>
                          <th>+/-</th>
                          <th>Games</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roundRobinStandings(
                          match.session.teams ?? [],
                          match.session.matches,
                        ).map((row) => (
                          <tr key={row.id}>
                            <td>{row.name}</td>
                            <td>{row.played}</td>
                            <td>{row.wins}</td>
                            <td>{row.gameDiff}</td>
                            <td>{row.gamesWon}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>
              )}
            </div>
          )}
        </section>
      )}
      {tab === "history" && (
        <section className="card history-section">
          <div className="section-heading">
            <div>
              <span className="kicker">SAVED TO THE CLUBHOUSE</span>
              <h2>Past games</h2>
              <p>
                Every started session is saved automatically. Reopen the score,
                inspect every fixture or send the recap back to the group chat.
              </p>
            </div>
            <div className="history-filters" aria-label="Filter sessions">
              {(["ALL", "ACTIVE", "COMPLETE", "CANCELLED"] as const).map(
                (status) => (
                  <button
                    key={status}
                    data-active={historyFilter === status}
                    onClick={() => setHistoryFilter(status)}
                  >
                    {status === "ALL" ? "All" : status.toLowerCase()}
                  </button>
                ),
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="btn btn-secondary"
              onClick={downloadImportTemplate}
            >
              Download CSV template
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => importInput.current?.click()}
            >
              <Upload size={18} /> Upload games
            </button>
            <input
              ref={importInput}
              className="sr-only"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => void readImport(event.target.files?.[0])}
            />
            <button className="btn btn-secondary" onClick={clearHistory}>
              <Trash2 size={18} /> Clear history
            </button>
          </div>
          {(importError || importRows.length > 0) && (
            <div className="sassy-note mt-4">
              {importError ||
                `${importRows.length} match${importRows.length === 1 ? "" : "es"} ready to import. Missing players will be added at 6.0.`}
              {importRows.length > 0 && (
                <button className="btn btn-coral ml-3" onClick={importHistory}>
                  Import confirmed games
                </button>
              )}
            </div>
          )}
          {visibleSessions.length === 0 ? (
            <div className="history-empty">
              <CalendarDays size={42} />
              <h3>No sessions saved yet.</h3>
              <p>Your first confirmed rivalry will live here forever.</p>
              <button className="btn" onClick={() => setTab("roster")}>
                Pick the crew <ArrowRight size={18} />
              </button>
            </div>
          ) : (
            <div className="history-list">
              {visibleSessions.map((session) => {
                const teamNames = new Map(
                  session.teams.map((team) => [team.id, team.name]),
                );
                const sortedMatches = [...session.matches].sort(
                  (a, b) => a.sequence - b.sequence,
                );
                const latestMatch = sortedMatches.at(-1);
                const confirmed = session.matches.filter(
                  (item) => item.status === "CONFIRMED",
                ).length;
                const expanded = expandedSession === session.id;
                return (
                  <article className="history-card" key={session.id}>
                    <button
                      className="history-summary"
                      aria-label={`${session.name} history`}
                      aria-expanded={expanded}
                      onClick={() =>
                        setExpandedSession(expanded ? null : session.id)
                      }
                    >
                      <span className="history-date">
                        <CalendarDays size={19} />
                        {new Intl.DateTimeFormat(undefined, {
                          dateStyle: "medium",
                        }).format(
                          new Date(session.startedAt ?? session.createdAt),
                        )}
                      </span>
                      <span className="history-title">
                        <b>{session.name}</b>
                        <small>
                          {session.format.replaceAll("_", " ")} · {confirmed}/
                          {session.matches.length} results confirmed
                        </small>
                      </span>
                      <span
                        className="history-status"
                        data-status={session.status}
                      >
                        {session.status.toLowerCase()}
                      </span>
                      <ArrowRight
                        className="history-chevron"
                        data-open={expanded}
                        size={20}
                      />
                    </button>
                    {expanded && (
                      <div className="history-details">
                        <div className="history-meta">
                          <span>{session.teams.length} teams</span>
                          <span>{session.inputMode.toLowerCase()} input</span>
                          <span>
                            {session.scoringPreset.replaceAll("_", " ")}
                          </span>
                        </div>
                        <div className="fixture-list">
                          {sortedMatches.map((fixture) => (
                            <div className="fixture-row" key={fixture.id}>
                              <span>R{fixture.round}</span>
                              <b>
                                {teamNames.get(fixture.homeTeamId) ?? "TBD"}
                              </b>
                              <strong>
                                {fixture.status === "CONFIRMED"
                                  ? `${fixture.homeGames}–${fixture.awayGames}`
                                  : "vs"}
                              </strong>
                              <b>
                                {teamNames.get(fixture.awayTeamId) ?? "TBD"}
                              </b>
                              <span className="pill">
                                {fixture.status
                                  .toLowerCase()
                                  .replaceAll("_", " ")}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="history-actions">
                          {latestMatch && session.status !== "CANCELLED" && (
                            <button
                              className="btn"
                              onClick={() => openMatch(latestMatch.id)}
                            >
                              {session.status === "ACTIVE"
                                ? "Resume session"
                                : "Open session"}
                              <ArrowRight size={18} />
                            </button>
                          )}
                          {session.status === "COMPLETE" && (
                            <button
                              className="btn btn-secondary"
                              onClick={() => shareSavedSession(session)}
                            >
                              Share recap
                            </button>
                          )}
                          {session.status !== "ACTIVE" && (
                            <button
                              className="btn btn-secondary"
                              onClick={() => deleteSession(session)}
                            >
                              <Trash2 size={18} /> Delete
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
      {tab === "league" && (
        <section className="card league-section">
          <div className="section-heading">
            <div>
              <span className="kicker">THE CLUB TABLE</span>
              <h2>League standings</h2>
              <p>
                Only confirmed League fixtures count here. Wins lead, then games
                difference and win rate.
              </p>
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => loadStats(true)}
            >
              <Medal size={18} /> Refresh table
            </button>
          </div>
          <div className="league-filters grid-2 grid">
            <label>
              From
              <input
                className="field"
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label>
              To
              <input
                className="field"
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
          </div>
          {leagueTable.length === 0 ? (
            <div className="league-empty">
              <Medal size={46} />
              <h3>No league results yet.</h3>
              <p>Confirm a match and the first table will appear here.</p>
            </div>
          ) : (
            <div className="league-table-wrap">
              <table className="league-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Player</th>
                    <th>Played</th>
                    <th>Won</th>
                    <th>Lost</th>
                    <th>Games +/-</th>
                    <th>Win rate</th>
                    <th>Form</th>
                  </tr>
                </thead>
                <tbody>
                  {leagueTable.map((player, index) => (
                    <tr key={player.id}>
                      <td>
                        <span className="league-rank">{index + 1}</span>
                      </td>
                      <td>
                        <b>{player.name}</b>
                      </td>
                      <td>{player.wins + player.losses}</td>
                      <td>{player.wins}</td>
                      <td>{player.losses}</td>
                      <td>
                        {player.gamesDifferential > 0 ? "+" : ""}
                        {player.gamesDifferential}
                      </td>
                      <td>{(player.winRate * 100).toFixed(0)}%</td>
                      <td>
                        <span className="form-dots">
                          {player.rolling10.slice(-5).map((won, formIndex) => (
                            <i key={formIndex} data-win={won}>
                              {won ? "W" : "L"}
                            </i>
                          ))}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      {tab === "stats" && (
        <section className="card stats-section">
          <div className="section-heading">
            <div>
              <span className="kicker">THE RECEIPTS NEVER LIE</span>
              <h2>Player statistics</h2>
              <p>
                Form, streaks and partner chemistry. Group-chat excuses sold
                separately.
              </p>
            </div>
            <button className="btn btn-secondary" onClick={() => loadStats()}>
              <BarChart3 size={18} /> Refresh
            </button>
          </div>
          <div className="league-filters grid-2 grid">
            <label>
              From
              <input
                className="field"
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label>
              To
              <input
                className="field"
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
          </div>
          {!stats ? (
            <p>Load the dashboard to see confirmed history.</p>
          ) : (
            <>
              <p className="coverage-card">
                <b>Clutch coverage:</b> {stats.coverage.pointModeMatches}{" "}
                point-mode matches out of {stats.coverage.totalMatches} total.
              </p>
              <div className="grid-3 grid">
                {stats.players.map((player) => (
                  <article key={player.id} className="stat-card">
                    <h3 className="mt-0">{player.name}</h3>
                    <p className="text-2xl font-black">
                      {player.wins}–{player.losses}
                    </p>
                    <p className="text-sm">
                      Games diff: {player.gamesDifferential > 0 ? "+" : ""}
                      {player.gamesDifferential}
                      <br />
                      win rate: {(player.winRate * 100).toFixed(0)}%
                      <br />
                      vs expected: {player.performanceVsExpected.toFixed(2)}
                      <br />
                      streak: {player.currentStreak} (best {player.bestStreak})
                      <br />
                      clutch: {player.clutch.wins}/{player.clutch.opportunities}{" "}
                      ({player.clutch.eligibleMatches} eligible)
                      <br />
                      best partner:{" "}
                      {player.bestPartner
                        ? `${player.bestPartner.name} (${player.bestPartner.wins}/${player.bestPartner.games})`
                        : "—"}
                      ; worst:{" "}
                      {player.worstPartner
                        ? `${player.worstPartner.name} (${player.worstPartner.wins}/${player.worstPartner.games})`
                        : "—"}
                      <br />
                      last 10:{" "}
                      {player.rolling10
                        .map((won) => (won ? "W" : "L"))
                        .join(" ") || "—"}
                      <br />
                      H2H:{" "}
                      {Object.entries(player.headToHead)
                        .map(
                          ([id, record]) =>
                            `${id} ${record.wins}-${record.losses}`,
                        )
                        .join(", ") || "—"}
                    </p>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </main>
  );
}
