import {
  generalMedals,
  championMedal,
  medalCategories,
} from "../config/medals.js";

// No client can submit counters or unlocks. All evidence comes from the database
// or a validated server action. Unique event keys make retries harmless.
export function createMedals(db) {
  const localDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Atlantic/Canary",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const get = (sql, ...args) => db.prepare(sql).get(...args);
  const recordStatement = db.prepare(
    "INSERT OR IGNORE INTO medal_events(user_id,kind,event_key,created_at) VALUES(?,?,?,?)",
  );
  function record(userId, kind, key, at = Date.now()) {
    recordStatement.run(userId, kind, String(key), at);
  }
  function seed(userId) {
    // Recover evidence that still exists from before medals were introduced.
    // Persist social actions so leaving a room or deleting a friendship/message
    // cannot remove previously counted actions or already earned medals.
    const seeds = [
      [
        "visits",
        "SELECT m.room_id event_key,m.joined_at created_at FROM members m JOIN rooms r ON r.id=m.room_id WHERE m.user_id=? AND r.owner_id<>m.user_id",
      ],
      [
        "chatRooms",
        "SELECT room_id event_key,MIN(created_at) created_at FROM messages WHERE user_id=? GROUP BY room_id",
      ],
      [
        "imageRooms",
        "SELECT room_id event_key,MIN(created_at) created_at FROM messages WHERE user_id=? AND image_id IS NOT NULL GROUP BY room_id",
      ],
      [
        "friends",
        "SELECT CASE WHEN sender=? THEN recipient ELSE sender END event_key,created_at FROM friends WHERE status='accepted' AND (sender=? OR recipient=?)",
      ],
    ];
    for (const [kind, sql] of seeds) {
      const args = kind === "friends" ? [userId, userId, userId] : [userId];
      for (const row of all(sql, ...args))
        record(userId, kind, row.event_key, row.created_at);
    }
    const user = get(
      "SELECT controls,gamepad_controls,theme FROM users WHERE id=?",
      userId,
    );
    if (user?.controls && user.controls !== "{}")
      record(userId, "keyboard", "saved");
    if (user?.gamepad_controls && user.gamepad_controls !== "{}")
      record(userId, "gamepad", "saved");
    if (user?.theme && user.theme !== "light") record(userId, "theme", "saved");
  }
  function measure(userId) {
    seed(userId);
    const games = all(
      "SELECT id,title,maker FROM games WHERE enabled=1 ORDER BY title",
    );
    const active = new Set(games.map((g) => g.id));
    const scores = all(
      "SELECT s.run_id,s.game_id,s.created_at,s.completed,g.maker FROM automatic_scores s JOIN games g ON g.id=s.game_id WHERE s.user_id=?",
      userId,
    );
    const metrics = Object.fromEntries(
      all(
        "SELECT kind,COUNT(*) n FROM medal_events WHERE user_id=? GROUP BY kind",
        userId,
      ).map((row) => [row.kind, row.n]),
    );
    metrics.plays = scores.length;
    metrics.scores = metrics.completed = scores.filter(
      (s) => s.completed,
    ).length;
    metrics.catalog = new Set(
      scores.filter((s) => active.has(s.game_id)).map((s) => s.game_id),
    ).size;
    metrics.makers = new Set(scores.map((s) => s.maker)).size;
    metrics.days = new Set(
      scores.map((s) => localDay.format(new Date(s.created_at))),
    ).size;
    metrics.rooms = get(
      "SELECT COUNT(*) n FROM rooms WHERE owner_id=?",
      userId,
    ).n;
    metrics.shared = get(
      "SELECT COUNT(DISTINCT mine.run_id) n FROM automatic_scores mine JOIN automatic_scores other ON other.run_id=mine.run_id AND other.user_id<>mine.user_id WHERE mine.user_id=?",
      userId,
    ).n;
    metrics.records = get(
      `WITH history AS (
      SELECT value,MAX(value) OVER(PARTITION BY game_id ORDER BY created_at,id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) previous
      FROM automatic_scores WHERE user_id=? AND completed=1
    ) SELECT COUNT(*) n FROM history WHERE previous IS NOT NULL AND value>previous`,
      userId,
    ).n;
    // Only active boards count towards exploration; keep their visits durable.
    metrics.boards = all(
      "SELECT event_key FROM medal_events WHERE user_id=? AND kind='boards'",
      userId,
    ).filter((v) => active.has(v.event_key)).length;
    return { games, metrics };
  }
  const insert = db.prepare(
    "INSERT OR IGNORE INTO user_medals(user_id,medal_id,earned_at,goal,progress) VALUES(?,?,?,?,?)",
  );
  function leader(gameId) {
    // Exactly the same ordering as the public leaderboard, including ties.
    return get(
      "SELECT u.id userId,MAX(s.value) value FROM automatic_scores s JOIN users u ON u.id=s.user_id WHERE s.game_id=? AND s.completed=1 GROUP BY u.id ORDER BY value DESC,u.username LIMIT 1",
      gameId,
    );
  }
  function evaluate(userId) {
    const { games, metrics } = measure(userId),
      now = Date.now(),
      newlyEarned = [];
    const goals = new Map();
    for (const medal of generalMedals) {
      const goal =
        medal.goal === "half"
          ? Math.ceil(games.length / 2)
          : medal.goal === "all"
            ? games.length
            : medal.goal;
      goals.set(medal.id, goal);
      const progress = metrics[medal.metric] || 0;
      if (
        goal > 0 &&
        progress >= goal &&
        insert.run(userId, medal.id, now, goal, progress).changes
      )
        newlyEarned.push(medal);
    }
    for (const game of games) {
      const medal = championMedal(game);
      if (
        leader(game.id)?.userId === userId &&
        insert.run(userId, medal.id, now, 1, 1).changes
      )
        newlyEarned.push(medal);
    }
    return { games, metrics, goals, newlyEarned };
  }
  function snapshot(userId) {
    const { games, metrics, goals, newlyEarned } = evaluate(userId);
    const earned = new Map(
      all(
        "SELECT medal_id,earned_at,goal,progress FROM user_medals WHERE user_id=?",
        userId,
      ).map((row) => [row.medal_id, row]),
    );
    // Earned first-place medals for retired/hidden games stay in the collection.
    const retired = all("SELECT id,title FROM games WHERE enabled=0").filter(
      (g) => earned.has(`champion-${g.id}`),
    );
    const definitions = [
      ...generalMedals,
      ...games.map(championMedal),
      ...retired.map((g) => ({ ...championMedal(g), retired: true })),
    ];
    const medals = definitions.map((medal) => {
      const saved = earned.get(medal.id),
        goal = saved?.goal ?? goals.get(medal.id) ?? 1;
      const value =
        medal.category === "champion"
          ? saved
            ? 1
            : 0
          : metrics[medal.metric] || 0;
      return {
        ...medal,
        goal,
        progress: Math.min(goal, Math.max(saved?.progress || 0, value)),
        earnedAt: saved?.earned_at || null,
      };
    });
    return {
      total: medals.length,
      generalCount: generalMedals.length,
      catalogSize: games.length,
      earned: medals.filter((m) => m.earnedAt).length,
      categories: medalCategories,
      medals,
      newlyEarned,
    };
  }
  function backfill() {
    if (get("SELECT 1 FROM settings WHERE key='medals.backfill-v1'")) return;
    db.exec("BEGIN IMMEDIATE");
    try {
      for (const user of all("SELECT id FROM users")) evaluate(user.id);
      db.prepare("INSERT INTO settings VALUES('medals.backfill-v1','1')").run();
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  return {
    record,
    snapshot,
    backfill,
    award: (userId) => evaluate(userId).newlyEarned,
  };
}
