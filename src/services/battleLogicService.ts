import RedisClientSingleton from '../db/redisClient';
import RedisPlayerRepository from '../db/playerRepository';
import { logger } from '../utils/logger';
import { PlayerData } from '../types/player';

const calculateAttackValue = (player: { attack: number; hp: number, currentHp: number }) => {
  const healthPercentage = player.currentHp / player.hp;
  const attackValue = Math.floor(player.attack * Math.max(0.5, healthPercentage));
  return attackValue;
};

const randomHitCheck = (attack: number, defense: number) => {
  const roll = Math.floor(Math.random() * 20) + 1; // Roll a D20
  const attackModifier = attack / 2;
  return roll + attackModifier > defense || roll === 20; // Account for critical success
};

const processBattle = async () => {
  const client = await RedisClientSingleton.getInstance();

  // Get the next battle from the queue (blocking pop)
  const battleId = await client.lPop('battleQueue');
  if (!battleId) {
    logger.info('No battles in queue, waiting...');
    return;
  }

  // Get the players' data for the battle (you could store this directly in the battle object)
  const battleData = await client.get(`battle:${battleId}`);
  if (!battleData) {
    logger.error(`Battle data not found for battleId: ${battleId}`);
    return; // Skip this battle if we don't have data
  }

  const { player1Id, player2Id } = JSON.parse(battleData);
  const player1 = await RedisPlayerRepository.getPlayerById(player1Id);
  const player2 = await RedisPlayerRepository.getPlayerById(player2Id);

  if (!player1 || !player2) {
    logger.error(`Invalid players data for battle: ${battleId}`);
    return; // Skip this battle if we don't have data
  }

  const battleReport = await battleFlow(player1, player2);

  // Remove the battle from the queue (if not already removed)
  await client.del(`battle:${battleId}`);

  // Log battle report
  // TODO: Save report or return to requester
  logger.info(`Battle Report: ${JSON.stringify(battleReport)}`);
};

const battleFlow = async (player1: PlayerData, player2: PlayerData) => {

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

  // TODO: Submit resources stolen to leaderboard
  // await RedisPlayerRepository.submitToLeaderboard(winner.id, goldStolen, silverStolen);

  return battle;
};

export default processBattle;
