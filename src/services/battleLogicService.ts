import RedisClientSingleton from '../db/redisClient';
import RedisPlayerRepository from '../db/playerRepository';
import LeaderboardRepository from '../db/leaderboardRepository';
import { logger } from '../utils/logger';
import { PlayerData } from '../types/player';
import { BattleReport } from '../types/battle';

/**
 * Calculates the effective attack value of a player based on current HP.
 * Ensures attack value doesn't fall below 50% even at low health.
 *
 * @param player - The player with base attack, total HP, and current HP.
 * @returns Adjusted attack value based on health percentage.
 */
const calculateAttackValue = (player: { attack: number; hp: number, currentHp: number }) => {
  const healthPercentage = player.currentHp / player.hp;
  const attackValue = Math.floor(player.attack * Math.max(0.5, healthPercentage));
  return attackValue;
};

/**
 * Determines whether an attack hits based on a D20 roll and attacker’s strength.
 * A roll of 20 always hits (critical success).
 *
 * @param attack - The attacker’s attack stat.
 * @param defense - The defender’s defense stat.
 * @returns `true` if the attack hits, otherwise `false`.
 */
const randomHitCheck = (attack: number, defense: number) => {
  const roll = Math.floor(Math.random() * 20) + 1;
  const attackModifier = attack / 2;
  return roll + attackModifier > defense || roll === 20;
};

/**
 * Processes up to 10 battles from the Redis battle queue.
 * Skips battles where either player is already in a battle.
 * Each battle is dequeued and handled asynchronously.
 *
 * 🔁 Called periodically by a background worker.
 *
 * @example
 * import processBattle from './services/battleProcessor';
 * await processBattle();
 */
const processBattle = async () => {
  const client = await RedisClientSingleton.getInstance();

  // Get the next battle from the queue (blocking pop)
  const battleIds = await client.lRange('battleQueue', 0, 9);

  for (const battleId of battleIds) {
    // Get the players' data for the battle (you could store this directly in the battle object)
    const battleData = await client.get(`battle:${battleId}`);
    if (!battleData) {
      logger.error(`Battle data not found for battleId: ${battleId}`);
      return; // Skip this battle if we don't have data
    }

    const { player1Id, player2Id } = JSON.parse(battleData);

    const isBusy = await client.sIsMember('battle:progress', player1Id) || await client.sIsMember('battle:progress', player2Id);
    if (isBusy) continue;

    const player1 = await RedisPlayerRepository.getPlayerById(player1Id);
    const player2 = await RedisPlayerRepository.getPlayerById(player2Id);

    if (!player1 || !player2) {
      logger.error(`Invalid players data for battle: ${battleId}`);
      return; // Skip this battle if we don't have data
    }

    // Lock players
    await client.sAdd('battle:progress', [player1Id, player2Id]);

    // Remove from queue and process asynchronously
    await client.lRem('battleQueue', 1, battleId);

    battleFlow(battleId, player1, player2).finally(async () => {
      // Remove the battle from the queue
      await client.sRem('battle:progress', [player1Id, player2Id]);
      await client.del(`battle:${battleId}`);
    });
  }
};

/**
 * Calculates a battle between two players.
 * Tracks turn-by-turn events and updates resources and leaderboard.
 *
 * @param battleId - A UUID string identifying this battle.
 *   @example "123e4567-e89b-12d3-a456-426614174000"
 * @param player1 - Player data for the attacker.
 * @param player2 - Player data for the defender.
 */
const battleFlow = async (battleId: string, player1: PlayerData, player2: PlayerData) => {

  let battle: BattleReport = {
    players: [
      { id: player1.id, name: player1.name, attack: player1.attackValue, hp: player1.hitPoints, defense: player1.defenseValue, currentHp: player1.hitPoints },
      { id: player2.id, name: player2.name, attack: player2.attackValue, hp: player2.hitPoints, defense: player2.defenseValue, currentHp: player2.hitPoints }
    ],
    rounds: [],
    battleWinner: undefined,
    resourcesStolen: { gold: 0, silver: 0 },
  };

  // Battle loop
  let round = 0;
  while (battle.players.every(player => player.currentHp > 0)) {
    const attacker = battle.players[round % battle.players.length];
    const defender = battle.players[(1 + round) % battle.players.length];

    const attackValue = calculateAttackValue(attacker);
    const hit = randomHitCheck(attackValue, defender.defense);
    let damage: number | undefined = undefined;

    if (hit) {
      damage = attackValue;
      defender.currentHp -= damage;
    }

    const roundReport = {
      attacker: attacker.name,
      hit,
      damage,
    };
    battle.rounds.push(roundReport);

    round++;

    if (defender.currentHp <= 0) {
      battle.battleWinner = attacker.name;
    }

    saveReport(battleId, battle);
  }

  // Calculate resources stolen (same percentage for both gold and silver)
  const stolenPercentage = Math.random() * 0.05 + 0.05; // Between 5% to 10%
  const winner = battle.battleWinner === player1.name ? player1 : player2;
  const loser = winner === player1 ? player2 : player1;

  const goldStolen = Math.ceil(loser.gold * stolenPercentage);
  const silverStolen = Math.ceil(loser.silver * stolenPercentage);
  battle.resourcesStolen.gold = goldStolen;
  battle.resourcesStolen.silver = silverStolen;

  // Update player resources
  await RedisPlayerRepository.updatePlayer(winner.id, {
    gold: winner.gold + goldStolen,
    silver: winner.silver + silverStolen
  });

  await RedisPlayerRepository.updatePlayer(loser.id, {
    gold: loser.gold - goldStolen,
    silver: loser.silver - silverStolen
  });

  saveReport(battleId, battle);

  LeaderboardRepository.updateLeaderboardFromBattle(battle);
};

 /**
 * Saves a battle report to Redis storage for later retrieval.
 * The report key is based on the battle's UUID.
 *
 * @param battleId - The battle's UUID.
 *   @example "123e4567-e89b-12d3-a456-426614174000"
 * @param battleReport - The full report object including players, rounds, outcome, and stolen resources.
 */
const saveReport = async (battleId: string, battleReport: BattleReport) => {
  const client = await RedisClientSingleton.getInstance();

  client.set(`battle:report:${battleId}`, JSON.stringify(battleReport)).catch((err: any) => {
    logger.error(err, `Failed to save battle report ${battleId}:`);
  });
};

export default processBattle;
