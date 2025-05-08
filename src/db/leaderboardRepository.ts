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

/**
 * Updates the leaderboard and win streaks based on the outcome of a battle.
 * 
 * - Increments the winner's score using a base value plus bonus points from current streak,
 *   and the amount of gold/silver stolen.
 * - Decrements the loser's score based on the same gold/silver values (but ensures it doesn't go below 0).
 * - Resets the loser's win streak and increments the winner's streak (max streak considered is 10).
 *
 * 🏆 Leaderboard and streak data are stored in Redis:
 *   - Leaderboard: Sorted set `leaderboard`
 *   - Streaks: Hash `battle:streaks`
 *
 * @param battle - A full battle report object containing players, stolen resources, and the winner.
 * 
 * @example
 * await updateLeaderboardFromBattle({
 *   players: [
 *     { id: "player1", name: "Alice", attack: 10, hp: 100, defense: 5, currentHp: 30 },
 *     { id: "player2", name: "Bob", attack: 8, hp: 100, defense: 4, currentHp: 0 }
 *   ],
 *   battleWinner: "Alice",
 *   resourcesStolen: { gold: 120, silver: 250 },
 *   rounds: [...]
 * });
 */
const updateLeaderboardFromBattle = async (battle: BattleReport) => {
  const client = await RedisClientSingleton.getInstance();

  const winner = battle.players.find(p => p.name === battle.battleWinner);
  const loser = battle.players.find(p => p.name !== battle.battleWinner);

  if (!winner || !loser) return;

  const winnerId = winner.id;
  const loserId = loser.id;

  // Calculate points from resources
  const goldPoints = Math.floor(battle.resourcesStolen.gold / GOLD_POINT_RATIO);
  const silverPoints = Math.floor(battle.resourcesStolen.silver / SILVER_POINT_RATIO);

  // Fetch current win streak of the winner (max capped to 10)
  const winnerStreakRaw = await client.hGet('battle:streaks', winnerId);
  const winnerStreak = Math.min(parseInt(winnerStreakRaw || '0'), 10);

  // Final score calculations
  const winPoints = WINNER_BASE + winnerStreak + goldPoints + silverPoints;
  const lossPoints = LOSER_BASE + goldPoints + silverPoints;

  // Ensure loser score does not go below 0
  const currentLoserScoreRaw = await client.zScore('leaderboard', loserId);
  const currentLoserScore = currentLoserScoreRaw ?? 0;
  const newLoserScore = Math.max(0, currentLoserScore - lossPoints);

  // Apply all updates atomically
  await client
    .multi()
    .zIncrBy('leaderboard', winPoints, winnerId)       // Add points to winner
    .zAdd('leaderboard', { score: newLoserScore, value: loserId }) // Update loser's score
    .hSet('battle:streaks', winnerId, winnerStreak + 1) // Increment winner's streak
    .hSet('battle:streaks', loserId, 0)                 // Reset loser's streak
    .exec();
};

export default { getLeaderboard, updateLeaderboardFromBattle };
