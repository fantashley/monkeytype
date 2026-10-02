import { CronJob } from "cron";
import GeorgeQueue from "../queues/george-queue";
import * as LeaderboardsDAL from "../dal/leaderboards";
import { getCachedConfiguration } from "../init/configuration";

const CRON_SCHEDULE = "30 14/15 * * * *";
const RECENT_AGE_MINUTES = 10;
const RECENT_AGE_MILLISECONDS = RECENT_AGE_MINUTES * 60 * 1000;

async function getTop10(
  leaderboardTime: string,
): Promise<LeaderboardsDAL.DBLeaderboardEntry[]> {
  return (await LeaderboardsDAL.get(
    "time",
    leaderboardTime,
    "english",
    0,
    10,
  )) as LeaderboardsDAL.DBLeaderboardEntry[]; //can do that because gettop10 will not be called during an update
}

async function updateLeaderboardAndNotifyChanges(
  leaderboardTime: string,
): Promise<void> {
  const top10BeforeUpdate = await getTop10(leaderboardTime);

  const previousRecordsMap = Object.fromEntries(
    top10BeforeUpdate.map((record) => {
      return [record.uid, record];
    }),
  );

  await LeaderboardsDAL.update("time", leaderboardTime, "english");

  const top10AfterUpdate = await getTop10(leaderboardTime);

  const newRecords = top10AfterUpdate.filter((record) => {
    const userId = record.uid;

    const previousMapUser = previousRecordsMap[userId];
    const userImprovedRank =
      previousMapUser && previousMapUser.rank > record.rank;

    const newUserInTop10 = !(userId in previousRecordsMap);

    const isRecentRecord =
      record.timestamp > Date.now() - RECENT_AGE_MILLISECONDS;

    return (userImprovedRank === true || newUserInTop10) && isRecentRecord;
  });

  if (newRecords.length > 0) {
    const leaderboardId = `time ${leaderboardTime} english`;

    await GeorgeQueue.announceLeaderboardUpdate(newRecords, leaderboardId);
  }
}

const runningUpdates = new Map<string, Promise<void>>();
const queuedUpdates = new Map<string, Promise<void>>();

/**
 * Updates the all-time leaderboard of a time mode. Only one update runs at a
 * time per leaderboard, requests during an update share the next one.
 */
export async function updateLeaderboard(
  leaderboardTime: string,
): Promise<void> {
  const queued = queuedUpdates.get(leaderboardTime);
  if (queued !== undefined) return queued;

  const update = updateAfter(
    leaderboardTime,
    runningUpdates.get(leaderboardTime),
  );
  queuedUpdates.set(leaderboardTime, update);
  return update;
}

async function updateAfter(
  leaderboardTime: string,
  previous: Promise<void> | undefined,
): Promise<void> {
  await previous?.catch(() => undefined);
  queuedUpdates.delete(leaderboardTime);

  const running = updateLeaderboardAndNotifyChanges(leaderboardTime);
  runningUpdates.set(leaderboardTime, running);
  try {
    await running;
  } finally {
    if (runningUpdates.get(leaderboardTime) === running) {
      runningUpdates.delete(leaderboardTime);
    }
  }
}

async function updateLeaderboards(): Promise<void> {
  const { maintenance, leaderboards } = await getCachedConfiguration();
  if (maintenance) {
    return;
  }

  for (const leaderboardTime of leaderboards.allTime.timeModes) {
    await updateLeaderboard(leaderboardTime);
  }
}

export default new CronJob(CRON_SCHEDULE, updateLeaderboards);
