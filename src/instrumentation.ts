// Next.js 15 instrumentation hook : runs once when the server boots.
// Used to bootstrap the daily cron and surface missing config early.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { warnMissingSchoolTokens } = await import("@/lib/schools");
  warnMissingSchoolTokens();

  if (process.env.DISABLE_CRON === "1") {
    console.log(
      JSON.stringify({ level: "info", msg: "cron disabled (DISABLE_CRON=1)" })
    );
    return;
  }

  // node-cron pulls in `worker_threads` and `stream`, which webpack can't
  // bundle into the instrumentation chunk. We bypass webpack's static
  // analysis by hiding the module spec behind a runtime-evaluated string,
  // and use eval'd require so webpack doesn't try to follow it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeRequire = (0, eval)("require") as (id: string) => any;
  const cron = nodeRequire("node-cron") as typeof import("node-cron");

  const { syncAllSchools } = await import("@/lib/messagingme/sync");
  const { env } = await import("@/lib/env");

  cron.schedule(
    "0 22 * * *",
    async () => {
      console.log(
        JSON.stringify({ level: "info", msg: "cron tick: syncAllSchools start" })
      );
      try {
        const r = await syncAllSchools();
        console.log(
          JSON.stringify({
            level: "info",
            msg: "syncAllSchools done",
            ...r,
          })
        );
      } catch (err) {
        console.error(
          JSON.stringify({
            level: "error",
            msg: "syncAllSchools fatal",
            err: err instanceof Error ? err.message : String(err),
          })
        );
      }
    },
    { timezone: env.cronTimezone }
  );

  console.log(
    JSON.stringify({
      level: "info",
      msg: "cron scheduled",
      schedule: "0 22 * * *",
      timezone: env.cronTimezone,
    })
  );
}
