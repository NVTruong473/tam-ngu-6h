import { execFileSync } from "node:child_process";

const ref = process.env.SUPABASE_PROJECT_REF;
if (!ref) throw new Error("Thiếu SUPABASE_PROJECT_REF.");

const token = process.env.SUPABASE_ACCESS_TOKEN || execFileSync(
  "security",
  ["find-generic-password", "-s", "Supabase CLI", "-w"],
  { encoding: "utf8", timeout: 5_000 },
).trim();

async function queryDatabase(query) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ query, read_only: true }),
    signal: AbortSignal.timeout(20_000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Supabase HTTP ${response.status}: ${result?.message || result?.error || "không rõ lỗi"}`);
  }
  return result;
}

const [jobs, recentRuns, scheduler] = await Promise.all([
  queryDatabase(`select jobid, jobname, schedule, active
    from cron.job
    where jobname = 'tam-ngu-custom-schedule'`),
  queryDatabase(`select d.status, d.start_time, d.end_time,
      extract(epoch from (coalesce(d.end_time, now()) - d.start_time))::numeric(10,3) as duration_seconds
    from cron.job_run_details d
    join cron.job j on j.jobid = d.jobid
    where j.jobname = 'tam-ngu-custom-schedule'
    order by d.start_time desc
    limit 10`),
  queryDatabase(`select count(*)::integer as workers
    from pg_stat_activity
    where application_name ilike 'pg_cron scheduler'`),
]);

const job = jobs?.[0];
const latestRun = recentRuns?.[0];
const schedulerWorkers = Number(scheduler?.[0]?.workers || 0);
const latestAgeSeconds = latestRun?.start_time
  ? Math.max(0, Math.round((Date.now() - Date.parse(latestRun.start_time)) / 1000))
  : null;
const failedRuns = (recentRuns || []).filter((run) => !["succeeded", "running"].includes(run.status));

const audit = {
  ok: Boolean(
    job?.active
      && job.schedule === "* * * * *"
      && schedulerWorkers > 0
      && latestAgeSeconds !== null
      && latestAgeSeconds <= 180
      && failedRuns.length === 0,
  ),
  job: job ? { name: job.jobname, schedule: job.schedule, active: job.active } : null,
  schedulerWorkers,
  latestRun: latestRun ? {
    status: latestRun.status,
    startTime: latestRun.start_time,
    durationSeconds: Number(latestRun.duration_seconds),
    ageSeconds: latestAgeSeconds,
  } : null,
  sampledRuns: recentRuns?.length || 0,
  failedRuns: failedRuns.length,
};

process.stdout.write(`${JSON.stringify(audit, null, 2)}\n`);
if (!audit.ok) process.exitCode = 1;
