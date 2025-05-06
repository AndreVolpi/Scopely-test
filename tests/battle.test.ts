import battleLogicService from '../src/services/battleLogicService';
import { PlayerData } from '../src/types/player';
import { BattleReport } from '../src/types/battle';
import RedisClientSingleton from '../src/db/redisClient';
import RedisPlayerRepository from '../src/db/playerRepository';
import { app } from '../src/app';
import request from 'supertest';

let redis: any;
let battlePlayer1: PlayerData;
let battlePlayer2: PlayerData;

const player1: Omit<PlayerData, 'id'> = {
  name: 'BattlePlayer1',
  password: 'justapassword1',
  description: 'Test Player 1',
  attackValue: 10,
  hitPoints: 100,
  defenseValue: 20,
  gold: 500,
  silver: 200,
};

const player2: Omit<PlayerData, 'id'> = {
  name: 'BattlePlayer2',
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

describe('Battle Logic Service', () => {
  let battleId: string;

  it('should simulate a battle and update player resources', async () => {
    // Create battle and push to queue
    battleId = 'battle-test-123';
    const battleData = JSON.stringify({ player1Id: battlePlayer1.id, player2Id: battlePlayer2.id });
    await redis.set(`battle:${battleId}`, battleData);
    await redis.rPush('battleQueue', battleId);

    // Run the battle logic
    await battleLogicService();

    // Reload players from Redis
    const updatedPlayer1 = await RedisPlayerRepository.getPlayerById(battlePlayer1.id);
    const updatedPlayer2 = await RedisPlayerRepository.getPlayerById(battlePlayer2.id);

    expect(updatedPlayer1).toBeTruthy();
    expect(updatedPlayer2).toBeTruthy();

    // Make sure resources have been updated
    expect(updatedPlayer1!.gold).not.toBe(battlePlayer1.gold);
    expect(updatedPlayer2!.silver).not.toBe(battlePlayer2.silver);

    // Make sure the battle was removed from Redis
    const battleExists = await redis.get(`battle:${battleId}`);
    expect(battleExists).toBeNull();
  });
});

describe('Battle API Endpoints', () => {
  let playerToken: string;

  beforeAll(async () => {
    const response = await request(app)
      .post('/player/login')
      .send({
        name: player1.name,
        password: player1.password
      });

    playerToken = response.body.token;
  });

  it('should enqueue a battle for a valid player', async () => {
    const response = await request(app)
      .post(`/battle/${battlePlayer2.id}`)
      .send()
      .set('Authorization', `Bearer ${playerToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      enqueued: true,
      battleId: expect.any(String),
    }));

    const { battleId } = response.body;

    // Confirm battle was stored in Redis
    const battleData = await redis.get(`battle:${battleId}`);
    expect(battleData).toBeDefined();
    expect(battleData).toContain(battlePlayer1.id);
    expect(battleData).toContain(battlePlayer2.id);

    // Confirm battle is in the queue
    expect(await redis.lPop('battleQueue')).toEqual(battleId);
  });

  it('should return 401 if no token is provided', async () => {
    const response = await request(app)
      .post(`/battle/${battlePlayer2.id}`)
      .send();

    expect(response.statusCode).toBe(401);
  });

  it('should return 404 if the target player does not exist', async () => {
    const fakeTargetId = 'nonexistent-id-123';

    const response = await request(app)
      .post(`/battle/${fakeTargetId}`)
      .set('Authorization', `Bearer ${playerToken}`)
      .send();

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual(expect.objectContaining({
      message: expect.stringMatching(/Player not found./i),
    }));
  });

  it('should be able to get report', async () => {
    const responseBattle = await request(app)
      .post(`/battle/${battlePlayer2.id}`)
      .send()
      .set('Authorization', `Bearer ${playerToken}`);

    const { battleId } = responseBattle.body;

    // Run the battle logic
    await battleLogicService();

    const response = await request(app)
      .get(`/battle/${battleId}`)
      .send()
      .set('Authorization', `Bearer ${playerToken}`);

    expect(response.statusCode).toBe(200);
    assertIsBattleReport(response.body);
  });

  function assertIsBattleReport(report: any): asserts report is BattleReport {
    expect(report).toBeDefined();
    expect(Array.isArray(report.players)).toBe(true);
    expect(report.players.length).toBe(2);

    expect(Array.isArray(report.rounds)).toBe(true);
    expect(report.rounds.length).toBeGreaterThan(0);

    expect(typeof report.battleWinner).toBe('string');

    expect(report.resourcesStolen).toBeDefined();
    expect(typeof report.resourcesStolen.gold).toBe('number');
    expect(typeof report.resourcesStolen.silver).toBe('number');
    expect(report.resourcesStolen.gold).toBeGreaterThanOrEqual(0);
    expect(report.resourcesStolen.silver).toBeGreaterThanOrEqual(0);
  }
});

