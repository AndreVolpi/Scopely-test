import RedisClientSingleton from './redisClient';
import { BattleReport } from '../types/battle';
import { LeaderboardEntry } from 'types/leaderboard';

const WINNER_BASE = 10; // Base points awarded for a win
const LOSER_BASE = 5; // Base points removed for a loss
const GOLD_POINT_RATIO = 10; // Award 1 extra point per 10 gold stolen
const SILVER_POINT_RATIO = 100; // Award 1 extra point per 100 silver stolen

const getLeaderboard = async (page: number, perPage: number) => {
  const client = await RedisClientSingleton.getInstance();

  const start = (page - 1) * perPage;
  const end = start + perPage - 1;

  const entries = await client.zRangeWithScores('leaderboard', start, end, { REV: true });

  return entries.map((entry, index) => ({
    rank: start + index + 1,
    playerId: entry.value,
    score: Math.floor(entry.score),
  } as LeaderboardEntry));
};

const updateLeaderboardFromBattle = async (battle: BattleReport) => {
  const client = await RedisClientSingleton.getInstance();

  const winner = battle.players.find(p => p.name === battle.battleWinner);
  const loser = battle.players.find(p => p.name !== battle.battleWinner);

  if (!winner || !loser) return;

  const winnerId = winner.id;
  const loserId = loser.id;

  const goldPoints = Math.floor(battle.resourcesStolen.gold / GOLD_POINT_RATIO);
  const silverPoints = Math.floor(battle.resourcesStolen.silver / SILVER_POINT_RATIO);

  const winnerStreakRaw = await client.hGet('battle:streaks', winnerId);
  const winnerStreak = Math.min(parseInt(winnerStreakRaw || '0'), 10);

  const winPoints = WINNER_BASE + winnerStreak + goldPoints + silverPoints;
  const lossPoints = LOSER_BASE + goldPoints + silverPoints;

  const currentLoserScoreRaw = await client.zScore('leaderboard', loserId);
  const currentLoserScore = currentLoserScoreRaw ?? 0;
  const newLoserScore = Math.max(0, currentLoserScore - lossPoints);

  // Apply updates
  await client
    .multi()
    .zIncrBy('leaderboard', winPoints, winnerId)
    .zAdd('leaderboard', { score: newLoserScore, value: loserId })
    .hSet('battle:streaks', winnerId, winnerStreak + 1)
    .hSet('battle:streaks', loserId, 0)
    .exec();
};

export default { getLeaderboard, updateLeaderboardFromBattle };
