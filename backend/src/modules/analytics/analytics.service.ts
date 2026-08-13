import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AnalyticsPeriodDto, AnalyticsUsersQueryDto } from './dto/analytics-query.dto';

type Period = { from: string; to: string };

@Injectable()
export class AnalyticsService {
  constructor(private readonly dataSource: DataSource) {}

  async overview(periodDto: AnalyticsPeriodDto) {
    const [funnel, retention, totals] = await Promise.all([
      this.funnel(periodDto),
      this.retention(periodDto),
      this.dataSource.query(
        `SELECT
           (SELECT COUNT(*)::int FROM users WHERE "createdAt" >= $1 AND "createdAt" < $2) AS "signupUsers",
           (SELECT COUNT(*)::int FROM episode_play_logs WHERE "lastPlayedAt" >= $1 AND "lastPlayedAt" < $2) AS "legacyEpisodeActivities",
           (SELECT COUNT(*)::int FROM card_news_view_logs WHERE "createdAt" >= $1 AND "createdAt" < $2) AS "legacyCardActivities",
           (SELECT COUNT(*)::int FROM analytics_events WHERE "createdAt" >= $1 AND "createdAt" < $2) AS "eventCount"`,
        [periodDto.from ?? '1970-01-01T00:00:00.000Z', this.toExclusive(periodDto.to)],
      ),
    ]);

    return { period: this.period(periodDto), funnel, retention, totals: totals[0] };
  }

  async funnel(periodDto: AnalyticsPeriodDto) {
    const period = this.period(periodDto);
    const rows = await this.dataSource.query(
      `WITH base AS (
         SELECT id, "createdAt"
         FROM users
         WHERE "createdAt" >= $1 AND "createdAt" < $2
       ), login_users AS (
         SELECT DISTINCT "userId" AS id FROM analytics_events
         WHERE "eventType" = 'login_success' AND "userId" IS NOT NULL AND "createdAt" >= $1 AND "createdAt" < $2
         UNION
         SELECT id FROM base WHERE "lastLoginAt" IS NOT NULL
       ), episode_users AS (
         SELECT DISTINCT "userId" AS id FROM analytics_events
         WHERE "eventType" = 'episode_start' AND "userId" IS NOT NULL AND "createdAt" >= $1 AND "createdAt" < $2
         UNION
         SELECT DISTINCT "userId" FROM episode_play_logs WHERE "lastPlayedAt" >= $1 AND "lastPlayedAt" < $2
       ), card_users AS (
         SELECT DISTINCT "userId" AS id FROM analytics_events
         WHERE "eventType" = 'card_news_open' AND "userId" IS NOT NULL AND "createdAt" >= $1 AND "createdAt" < $2
         UNION
         SELECT DISTINCT "userId" FROM card_news_view_logs WHERE "createdAt" >= $1 AND "createdAt" < $2
       ), episode_complete_users AS (
         SELECT DISTINCT "userId" AS id FROM analytics_events
         WHERE "eventType" = 'episode_complete' AND "userId" IS NOT NULL AND "createdAt" >= $1 AND "createdAt" < $2
       ), card_complete_users AS (
         SELECT DISTINCT "userId" AS id FROM analytics_events
         WHERE "eventType" = 'card_news_complete' AND "userId" IS NOT NULL AND "createdAt" >= $1 AND "createdAt" < $2
       ), revisit_users AS (
         SELECT DISTINCT b.id
         FROM base b
         JOIN analytics_events e ON e."userId" = b.id
         WHERE e."createdAt" >= GREATEST($1::timestamptz, b."createdAt" + interval '1 day')
           AND e."createdAt" < $2
       ), first_episode AS (
         SELECT b.id, MIN(e."createdAt") AS first_at
         FROM base b
         JOIN analytics_events e ON e."userId" = b.id AND e."eventType" = 'episode_start'
         GROUP BY b.id
         UNION ALL
         SELECT b.id, MIN(p."createdAt") AS first_at
         FROM base b
         JOIN episode_play_logs p ON p."userId" = b.id
         WHERE NOT EXISTS (
           SELECT 1 FROM analytics_events e WHERE e."userId" = b.id AND e."eventType" = 'episode_start'
         )
         GROUP BY b.id
       )
       SELECT
         (SELECT COUNT(*)::int FROM base) AS signup,
         (SELECT COUNT(*)::int FROM login_users l JOIN base b ON b.id = l.id) AS login,
         (SELECT COUNT(*)::int FROM episode_users e JOIN base b ON b.id = e.id) AS episode,
         (SELECT COUNT(*)::int FROM card_users c JOIN base b ON b.id = c.id) AS card,
         (SELECT COUNT(*)::int FROM episode_complete_users e JOIN base b ON b.id = e.id) AS episode_complete,
         (SELECT COUNT(*)::int FROM card_complete_users c JOIN base b ON b.id = c.id) AS card_complete,
         (SELECT COUNT(*)::int FROM revisit_users r) AS revisit,
         (SELECT COUNT(*)::int FROM base b WHERE NOT EXISTS (SELECT 1 FROM episode_users e WHERE e.id = b.id) AND NOT EXISTS (SELECT 1 FROM card_users c WHERE c.id = b.id)) AS no_content,
         (SELECT COUNT(*)::int FROM login_users l JOIN base b ON b.id = l.id WHERE NOT EXISTS (SELECT 1 FROM episode_users e WHERE e.id = b.id) AND NOT EXISTS (SELECT 1 FROM card_users c WHERE c.id = b.id)) AS login_only,
         (SELECT COUNT(*)::int FROM episode_users e JOIN base b ON b.id = e.id WHERE NOT EXISTS (SELECT 1 FROM card_users c WHERE c.id = b.id)) AS episode_without_card,
         (SELECT AVG(EXTRACT(EPOCH FROM (first_at - b."createdAt")))::float FROM first_episode f JOIN base b ON b.id = f.id) AS avg_seconds_to_first_episode,
         (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (first_at - b."createdAt")))::float FROM first_episode f JOIN base b ON b.id = f.id) AS median_seconds_to_first_episode`,
      [period.from, period.to],
    );

    const row = rows[0] ?? {};
    const signup = Number(row.signup ?? 0);
    const steps = [
      ['signup', Number(row.signup ?? 0)],
      ['login', Number(row.login ?? 0)],
      ['episodeStart', Number(row.episode ?? 0)],
      ['cardNewsOpen', Number(row.card ?? 0)],
      ['episodeComplete', Number(row.episode_complete ?? 0)],
      ['cardNewsComplete', Number(row.card_complete ?? 0)],
      ['revisit', Number(row.revisit ?? 0)],
    ];

    return {
      steps: steps.map(([name, userCount], index) => ({
        name,
        userCount,
        conversionFromPrevious:
          index === 0 ? 1 : this.rate(userCount as number, steps[index - 1][1] as number),
        conversionFromSignup: this.rate(userCount as number, signup),
      })),
      metrics: {
        noContentUsers: Number(row.no_content ?? 0),
        loginOnlyUsers: Number(row.login_only ?? 0),
        episodeWithoutCardUsers: Number(row.episode_without_card ?? 0),
        averageSecondsToFirstEpisode: Number(row.avg_seconds_to_first_episode ?? 0),
        medianSecondsToFirstEpisode: Number(row.median_seconds_to_first_episode ?? 0),
      },
    };
  }

  async users(query: AnalyticsUsersQueryDto) {
    const period = this.period(query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortMap: Record<string, string> = {
      lastActivityAt: '"lastActivityAt"',
      createdAt: 'u."createdAt"',
      episodeCount: '"episodeCount"',
      cardNewsCount: '"cardNewsCount"',
    };
    const sort = sortMap[query.sort ?? 'lastActivityAt'];
    const order = query.order === 'asc' ? 'ASC' : 'DESC';
    const rows = await this.dataSource.query(
      `WITH activity AS (
         SELECT "userId" AS user_id, COUNT(*)::int AS event_count, MAX("createdAt") AS last_event
         FROM analytics_events GROUP BY "userId"
       ), plays AS (
         SELECT "userId" AS user_id, COUNT(DISTINCT "episodeId")::int AS episode_count
         FROM episode_play_logs GROUP BY "userId"
       ), cards AS (
         SELECT "userId" AS user_id, COUNT(DISTINCT "cardNewsId")::int AS card_count
         FROM card_news_view_logs GROUP BY "userId"
       ), completions AS (
         SELECT "userId" AS user_id,
           COUNT(DISTINCT "episodeId") FILTER (WHERE "eventType" = 'episode_complete')::int AS episode_complete_count,
           COUNT(DISTINCT "cardNewsId") FILTER (WHERE "eventType" = 'card_news_complete')::int AS card_complete_count
         FROM analytics_events GROUP BY "userId"
       )
       SELECT u.id AS "userId",
         CASE WHEN position('@' in u.email) > 1 THEN left(u.email, 1) || '***' || substring(u.email from position('@' in u.email)) ELSE '***' END AS email,
         u."createdAt", u."lastLoginAt",
         GREATEST(u."lastLoginAt", a.last_event, p.last_play, c.last_view) AS "lastActivityAt",
         COALESCE(p.episode_count, 0)::int AS "episodeCount",
         COALESCE(co.episode_complete_count, 0)::int AS "episodeCompleteCount",
         COALESCE(c.card_count, 0)::int AS "cardNewsCount",
         COALESCE(co.card_complete_count, 0)::int AS "cardNewsCompleteCount",
         (COALESCE(a.event_count, 0) + COALESCE(p.episode_count, 0) + COALESCE(c.card_count, 0))::int AS "totalActivityEvents",
         (COALESCE(GREATEST(u."lastLoginAt", a.last_event, p.last_play, c.last_view), 'epoch'::timestamptz) >= now() - interval '7 days') AS "activeLast7Days",
         (COALESCE(GREATEST(u."lastLoginAt", a.last_event, p.last_play, c.last_view), 'epoch'::timestamptz) >= now() - interval '30 days') AS "activeLast30Days"
       FROM users u
       LEFT JOIN activity a ON a.user_id = u.id
       LEFT JOIN (SELECT "userId" AS user_id, MAX("lastPlayedAt") AS last_play, COUNT(DISTINCT "episodeId")::int AS episode_count FROM episode_play_logs GROUP BY "userId") p ON p.user_id = u.id
       LEFT JOIN (SELECT "userId" AS user_id, MAX("createdAt") AS last_view, COUNT(DISTINCT "cardNewsId")::int AS card_count FROM card_news_view_logs GROUP BY "userId") c ON c.user_id = u.id
       LEFT JOIN completions co ON co.user_id = u.id
       WHERE u."createdAt" >= $1 AND u."createdAt" < $2
       ORDER BY ${sort} ${order} NULLS LAST
       LIMIT $3 OFFSET $4`,
      [period.from, period.to, limit, (page - 1) * limit],
    );
    const total = await this.dataSource.query(
      'SELECT COUNT(*)::int AS count FROM users WHERE "createdAt" >= $1 AND "createdAt" < $2',
      [period.from, period.to],
    );
    return { data: rows, page, limit, total: Number(total[0]?.count ?? 0), period };
  }

  async episodes(periodDto: AnalyticsPeriodDto) {
    const period = this.period(periodDto);
    return this.dataSource.query(
      `WITH starts AS (
         SELECT "episodeId" AS episode_id, "userId" AS user_id, COUNT(*)::int AS events
         FROM analytics_events WHERE "eventType" = 'episode_start' AND "createdAt" >= $1 AND "createdAt" < $2 GROUP BY "episodeId", "userId"
         UNION ALL
         SELECT "episodeId", "userId", 1 FROM episode_play_logs WHERE "lastPlayedAt" >= $1 AND "lastPlayedAt" < $2
       ), completions AS (
         SELECT "episodeId" AS episode_id, COUNT(DISTINCT "userId")::int AS users
         FROM analytics_events WHERE "eventType" = 'episode_complete' AND "createdAt" >= $1 AND "createdAt" < $2 GROUP BY "episodeId"
       ), progress AS (
         SELECT "episodeId" AS episode_id,
           AVG(NULLIF(metadata->>'progressSeconds', '')::numeric)::float AS avg_seconds,
           AVG(NULLIF(metadata->>'progressPercent', '')::numeric)::float AS avg_percent
         FROM analytics_events WHERE "eventType" = 'episode_progress' AND "createdAt" >= $1 AND "createdAt" < $2 GROUP BY "episodeId"
       ), card_conversion AS (
         SELECT COALESCE("sourceEpisodeId", c."episodeId") AS episode_id, COUNT(DISTINCT e."userId")::int AS users
         FROM analytics_events e LEFT JOIN card_news c ON c.id = e."cardNewsId"
         WHERE e."eventType" = 'card_news_open' AND e."createdAt" >= $1 AND e."createdAt" < $2 AND e."userId" IS NOT NULL
         GROUP BY COALESCE("sourceEpisodeId", c."episodeId")
       )
       SELECT e.id AS "episodeId", e.title,
         COUNT(DISTINCT s.user_id)::int AS "uniqueUsers", COALESCE(SUM(s.events), 0)::int AS "totalPlayEvents",
         COALESCE(co.users, 0)::int AS "completedUsers",
         CASE WHEN COUNT(DISTINCT s.user_id) = 0 THEN 0 ELSE ROUND(COALESCE(co.users, 0)::numeric / COUNT(DISTINCT s.user_id), 4) END::float AS "completionRate",
         p.avg_seconds AS "averagePlaySeconds", p.avg_percent AS "averageProgressPercent",
         GREATEST(COUNT(DISTINCT s.user_id) - COALESCE(co.users, 0), 0)::int AS "dropoffUsers",
         COALESCE(cc.users, 0)::int AS "cardNewsConversionUsers",
         CASE WHEN COUNT(DISTINCT s.user_id) = 0 THEN 0 ELSE ROUND(COALESCE(cc.users, 0)::numeric / COUNT(DISTINCT s.user_id), 4) END::float AS "cardNewsConversionRate"
       FROM podcast_episodes e LEFT JOIN starts s ON s.episode_id = e.id
       LEFT JOIN completions co ON co.episode_id = e.id LEFT JOIN progress p ON p.episode_id = e.id LEFT JOIN card_conversion cc ON cc.episode_id = e.id
       GROUP BY e.id, e.title, co.users, p.avg_seconds, p.avg_percent, cc.users
       ORDER BY "uniqueUsers" DESC, "totalPlayEvents" DESC, e."createdAt" DESC`,
      [period.from, period.to],
    );
  }

  async cardNews(periodDto: AnalyticsPeriodDto) {
    const period = this.period(periodDto);
    return this.dataSource.query(
      `WITH opens AS (
         SELECT "cardNewsId" AS card_id, "userId" AS user_id FROM analytics_events WHERE "eventType" = 'card_news_open' AND "createdAt" >= $1 AND "createdAt" < $2
         UNION
         SELECT "cardNewsId", "userId" FROM card_news_view_logs WHERE "createdAt" >= $1 AND "createdAt" < $2
       ), completes AS (
         SELECT "cardNewsId" AS card_id, COUNT(DISTINCT "userId")::int AS users FROM analytics_events WHERE "eventType" = 'card_news_complete' AND "createdAt" >= $1 AND "createdAt" < $2 GROUP BY "cardNewsId"
       ), dwell AS (
         SELECT "cardNewsId" AS card_id, AVG(NULLIF(metadata->>'dwellSeconds', '')::numeric)::float AS seconds FROM analytics_events WHERE "eventType" = 'card_news_complete' AND "createdAt" >= $1 AND "createdAt" < $2 GROUP BY "cardNewsId"
       )
       SELECT c.id AS "cardNewsId", e.title, c."episodeId", COUNT(DISTINCT o.user_id)::int AS "uniqueUsers",
         COALESCE(co.users, 0)::int AS "completedUsers",
         CASE WHEN COUNT(DISTINCT o.user_id) = 0 THEN 0 ELSE ROUND(COALESCE(co.users, 0)::numeric / COUNT(DISTINCT o.user_id), 4) END::float AS "completionRate",
         d.seconds AS "averageDwellSeconds",
         COUNT(DISTINCT o.user_id) FILTER (WHERE EXISTS (SELECT 1 FROM analytics_events source_event WHERE source_event."eventType" = 'card_news_open' AND source_event."cardNewsId" = c.id AND source_event."userId" = o.user_id AND source_event."source" = 'episode'))::int AS "episodeReferralUsers",
         COUNT(DISTINCT o.user_id) FILTER (WHERE NOT EXISTS (SELECT 1 FROM analytics_events source_event WHERE source_event."eventType" = 'card_news_open' AND source_event."cardNewsId" = c.id AND source_event."userId" = o.user_id AND source_event."source" = 'episode'))::int AS "directUsers"
       FROM card_news c JOIN podcast_episodes e ON e.id = c."episodeId" LEFT JOIN opens o ON o.card_id = c.id LEFT JOIN completes co ON co.card_id = c.id LEFT JOIN dwell d ON d.card_id = c.id
       GROUP BY c.id, c."createdAt", e.title, c."episodeId", co.users, d.seconds ORDER BY "uniqueUsers" DESC, c."createdAt" DESC`,
      [period.from, period.to],
    );
  }

  async retention(periodDto: AnalyticsPeriodDto) {
    const period = this.period(periodDto);
    const rows = await this.dataSource.query(
      `WITH activity AS (
         SELECT "userId" AS user_id, "createdAt" AS at FROM analytics_events WHERE "userId" IS NOT NULL AND "createdAt" >= $1 AND "createdAt" < $2
         UNION ALL SELECT "userId", "lastPlayedAt" FROM episode_play_logs WHERE "lastPlayedAt" >= $1 AND "lastPlayedAt" < $2
         UNION ALL SELECT "userId", "createdAt" FROM card_news_view_logs WHERE "createdAt" >= $1 AND "createdAt" < $2
       ), days AS (SELECT DISTINCT date(at) AS day FROM activity), cohorts AS (SELECT date("createdAt") AS cohort_day, COUNT(*)::int AS users FROM users WHERE "createdAt" >= $1 AND "createdAt" < $2 GROUP BY 1)
       SELECT (SELECT COUNT(DISTINCT user_id)::int FROM activity WHERE at >= current_date) AS dau,
         (SELECT COUNT(DISTINCT user_id)::int FROM activity WHERE at >= current_date - interval '6 days') AS wau,
         (SELECT COUNT(DISTINCT user_id)::int FROM activity WHERE at >= current_date - interval '29 days') AS mau,
         (SELECT COUNT(DISTINCT user_id)::int FROM activity WHERE at >= current_date - interval '6 days') AS recent7,
         (SELECT COALESCE(jsonb_agg(jsonb_build_object('cohortDate', cohort_day, 'userCount', users) ORDER BY cohort_day), '[]'::jsonb) FROM cohorts) AS cohorts`,
      [period.from, period.to],
    );
    const retentionDays: Array<{ offset_days: number; eligible: number; retained: number }> =
      await this.dataSource.query(
        `SELECT offset_days, COUNT(*)::int AS eligible, COUNT(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM analytics_events e WHERE e."userId" = u.id AND e."createdAt"::date = u."createdAt"::date + offset_days
       ))::int AS retained
       FROM (VALUES (1), (7), (30)) AS offsets(offset_days)
       CROSS JOIN users u WHERE u."createdAt" >= $1 AND u."createdAt" < $2 GROUP BY offset_days ORDER BY offset_days`,
        [period.from, period.to],
      );
    const row = rows[0] ?? {};
    const named = Object.fromEntries(
      retentionDays.map((item) => [
        `D${item.offset_days}`,
        {
          eligibleUsers: Number(item.eligible),
          retainedUsers: Number(item.retained),
          rate: this.rate(Number(item.retained), Number(item.eligible)),
        },
      ]),
    );
    return {
      dau: Number(row.dau ?? 0),
      wau: Number(row.wau ?? 0),
      mau: Number(row.mau ?? 0),
      recent7Users: Number(row.recent7 ?? 0),
      ...named,
      cohorts: row.cohorts ?? [],
    };
  }

  async auth(periodDto: AnalyticsPeriodDto) {
    const period = this.period(periodDto);
    return this.dataSource.query(
      `SELECT "eventType", COUNT(*)::int AS count, MIN("occurredAt") AS "firstAt", MAX("occurredAt") AS "lastAt"
       FROM auth_audit_logs WHERE "occurredAt" >= $1 AND "occurredAt" < $2 GROUP BY "eventType" ORDER BY "eventType"`,
      [period.from, period.to],
    );
  }

  private period(input: AnalyticsPeriodDto): Period {
    return { from: input.from ?? '1970-01-01T00:00:00.000Z', to: this.toExclusive(input.to) };
  }

  private toExclusive(to?: string): string {
    if (!to) return '2999-12-31T00:00:00.000Z';
    const date = new Date(to);
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString();
  }

  private rate(numerator: number, denominator: number): number {
    return denominator === 0 ? 0 : Number((numerator / denominator).toFixed(4));
  }
}
