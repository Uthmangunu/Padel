"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  BarChart3,
  CircleGauge,
  ListPlus,
  Pencil,
  ShieldAlert,
  Shuffle,
  Sparkles,
  Trophy,
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
type List = { id: string; name: string };
type Player = { id: string; name: string; rating: number };
type Score = {
  points: [number, number];
  games: [number, number];
  sets: [number, number];
  totalGames: [number, number];
  winner?: number;
  tiebreak: [number, number] | null;
};
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
type Format = "WINNER_STAYS" | "KNOCKOUT" | "ROUND_ROBIN" | "GROUPS_KNOCKOUT";
const call = async <T,>(url: string, init?: RequestInit) => {
  const response = await fetch(url, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  if (!response.ok)
    throw new Error((await response.json()).error ?? "Request failed");
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
  const [tab, setTab] = useState<"roster" | "teams" | "score" | "stats">(
    "roster",
  );
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
  const [recentSessions, setRecentSessions] = useState<
    Array<{
      id: string;
      name: string;
      status: string;
      matches: Array<{ id: string; sequence: number }>;
    }>
  >([]);
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
  const active = useMemo(
    () => lists.find((list) => list.id === listId),
    [listId, lists],
  );
  const roster = players.filter((player) => selected.includes(player.id));
  const loadPlayers = () => {
    if (listId)
      void call<Player[]>(`/api/lists/${listId}/players`)
        .then(setPlayers)
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
    void call<
      Array<{
        id: string;
        name: string;
        status: string;
        matches: Array<{ id: string; sequence: number }>;
      }>
    >(`/api/sessions?listId=${listId}`)
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
    const rating = Number(prompt("Rating (1.0–10.0)", "7.0"));
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
    if (!match) return;
    try {
      const updated = await call<Match>(`/api/matches/${match.id}/score`, {
        method: "POST",
        body: JSON.stringify({ revision: match.revision, action, winner }),
      });
      setMatch((value) => (value ? { ...value, ...updated } : updated));
      if (action === "CONFIRM") {
        const sessions = await call<
          Array<{ matches: Array<{ id: string; status: string }> }>
        >(`/api/sessions?listId=${listId}&status=ACTIVE`);
        const next = sessions
          .flatMap((session) => session.matches)
          .find((item) => item.status === "LIVE");
        if (next) await openMatch(next.id);
        else {
          await openMatch(match.id);
          setNotice(
            "Session complete — final standings and sharing remain available.",
          );
        }
        void call<
          Array<{
            id: string;
            name: string;
            status: string;
            matches: Array<{ id: string; sequence: number }>;
          }>
        >(`/api/sessions?listId=${listId}`).then(setRecentSessions);
      }
    } catch (error) {
      setNotice((error as Error).message);
    }
  };
  const loadStats = () => {
    if (listId)
      void call<typeof stats>(
        `/api/stats?listId=${listId}&from=${from}&to=${to}`,
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
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return (
    <main className="shell">
      <div className="topbar">
        <div className="brand-lockup">
          <span className="brand-ball">P</span>
          <span>
            <b>PADEL PARTY</b>
            <small>Match night, minus the admin drama.</small>
          </span>
        </div>
        <div className="list-tools">
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
              <UsersRound size={17} /> {players.length || 16} players
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
              if (item === "stats") loadStats();
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
            <button className="btn" onClick={addPlayer}>
              <UserPlus size={18} /> Add player
            </button>
          </div>
          <div className="date-filters grid-2 grid">
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
          {selected.length > 0 && (
            <div className="selection-strip">
              <span>
                <b>{selected.length} picked.</b> Enough talent? We&apos;ll see.
              </span>
              <button className="btn btn-lime" onClick={() => setTab("teams")}>
                Make the teams <Shuffle size={17} />
              </button>
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
                    <small>
                      {player.rating >= 8
                        ? "Court menace"
                        : player.rating >= 6
                          ? "Solid operator"
                          : "Wildcard energy"}
                    </small>
                  </span>
                </label>
                <span className="player-actions">
                  <span className="rating">
                    <CircleGauge size={15} /> {player.rating.toFixed(1)}
                  </span>
                  <button
                    aria-label={`Edit ${player.name}`}
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
              <div className="score-actions grid-2 grid">
                <button
                  className="btn min-h-20"
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
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="btn btn-secondary"
                  onClick={() => score("UNDO")}
                >
                  Undo
                </button>
                {match.status === "AWAITING_CONFIRMATION" && (
                  <button className="btn" onClick={() => score("CONFIRM")}>
                    Confirm result
                  </button>
                )}
                {(match.status === "AWAITING_CONFIRMATION" ||
                  match.status === "CONFIRMED") && (
                  <button className="btn btn-secondary" onClick={share}>
                    Share result
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
                  <button
                    className="btn btn-secondary mt-3"
                    onClick={shareSession}
                  >
                    Share session
                  </button>
                  {match.session.format === "ROUND_ROBIN" && (
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
            <button className="btn btn-secondary" onClick={loadStats}>
              <BarChart3 size={18} /> Refresh
            </button>
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
