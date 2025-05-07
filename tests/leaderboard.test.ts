import request from 'supertest';
import { app } from '../src/app'; // adjust path if needed
import { PlayerData } from '../src/types/player';
import { LeaderboardEntry } from '../src/types/leaderboard';
import battleLogicService from '../src/services/battleLogicService';
import { BattleReport } from '../src/types/battle';
import LeaderboardRepository from '../src/db/leaderboardRepository';
import RedisClientSingleton from '../src/db/redisClient';

let redis: any;
let battlePlayer1: PlayerData;
let battlePlayer2: PlayerData;
let playerToken: string;

const player1: Omit<PlayerData, 'id'> = {
  name: 'LeaderboardPlayer1',
  password: 'justapassword1',
  description: 'Test Player 1',
  attackValue: 10,
  hitPoints: 100,
  defenseValue: 20,
  gold: 500,
  silver: 200,
};

const player2: Omit<PlayerData, 'id'> = {
  name: 'LeaderboardPlayer2',
  password: 'justapassword2',
  description: 'Test Player 2',
  attackValue: 18,
  hitPoints: 100,
  defenseValue: 12,
  gold: 300,
  silver: 100,
};


beforeAll(async () => {
  redis = await RedisClientSingleton.getInstance();
  await redis.flushDb();

  // Create players in Redis
  const response1 = await request(app)
    .post('/player')
    .send(player1);
  battlePlayer1 = response1.body;
  const response2 = await request(app)
    .post('/player')
    .send(player2);
  battlePlayer2 = response2.body;
});

describe('Leaderboard API Endpoints', () => {
  beforeAll(async () => {
    // Login with a player
    const responseLogin = await request(app)
      .post('/player/login')
      .send({
        name: player1.name,
        password: player1.password
      });
    playerToken = responseLogin.body.token;

    // Run one battle to populate leaderboard
    await request(app)
      .post(`/battle/${battlePlayer2.id}`)
      .send()
      .set('Authorization', `Bearer ${playerToken}`);
    await battleLogicService();
  });

  it('should fetch top 10 leaderboard entries with pagination', async () => {
    const response = await request(app)
      .get('/leaderboard')
      .query({ page: 1, perPage: 10 })
      .set('Authorization', `Bearer ${playerToken}`);

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body.leaderboard)).toBe(true);
    expect(response.body.leaderboard.length).toBeLessThanOrEqual(10);
    expect(response.body.leaderboard.length).toBeGreaterThanOrEqual(2);

    for (const entry of response.body.leaderboard) {
      expect(entry).toMatchObject({
        rank: expect.any(Number),
        playerId: expect.any(String),
        score: expect.any(Number),
      });
    }

    const scores = response.body.leaderboard.map((entry: LeaderboardEntry) => entry.score);
    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
    }
  });
});

describe('Leaderboard Logic', () => {
  beforeAll(async () => {
    await redis.del('leaderboard');
    await redis.del('battle:streaks');
  });

  it('should update leaderboard correctly from a battle report', async () => {
    const battleReport: BattleReport = {
      players: [
        { id: battlePlayer1.id, name: battlePlayer1.name, attack: battlePlayer1.attackValue, hp: battlePlayer1.hitPoints, defense: battlePlayer1.defenseValue, currentHp: 8 },
        { id: battlePlayer2.id, name: battlePlayer2.name, attack: battlePlayer2.attackValue, hp: battlePlayer2.hitPoints, defense: battlePlayer2.defenseValue, currentHp: 0 },
      ],
      rounds: [],
      battleWinner: battlePlayer1.name,
      resourcesStolen: {
        gold: 123,
        silver: 450,
      },
    };

    await LeaderboardRepository.updateLeaderboardFromBattle(battleReport);

    const scores = await redis.zRangeWithScores('leaderboard', 0, -1, { REV: true });
    const streaks = await redis.hGetAll('battle:streaks');

    expect(scores.find((entry: { value: string }) => entry.value === battlePlayer1.id)?.score).toBe(10 + 0 + 12 + 4);
    expect(scores.find((entry: { value: string }) => entry.value === battlePlayer2.id)?.score).toBe(0);

    expect(streaks[battlePlayer1.id]).toBe('1');
    expect(streaks[battlePlayer2.id]).toBe('0');
  });
});
