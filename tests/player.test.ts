import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { app } from '../src/app';
import RedisClientSingleton from '../src/db/redisClient';

beforeAll(async () => {
  const redis = await RedisClientSingleton.getInstance();
  await redis.flushDb();
});

describe('Player API Endpoints', () => {
  let playerId: string;
  let playerToken: string;
  let player2Id: string;

  // Test creating a player with valid data
  it('should create a player successfully', async () => {
    const response = await request(app)
      .post('/player')
      .send({
        name: 'Player1',
        password: 'Password123!',
        description: 'A new player'
      });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe('Player1');
    expect(response.body.description).toBe('A new player');
    playerId = response.body.id;
  });

  // Test creating a player with invalid data (name too long)
  it('should fail to create a player with invalid input', async () => {
    const response = await request(app)
      .post('/player')
      .send({
        name: 'playerwithtoolongname',
        password: 'Password123!',
        description: 'Invalid name length'
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('name');
  });

  // Test creating a player with a duplicate name
  it('should fail to create a player with a duplicate name', async () => {
    const firstResponse = await request(app)
      .post('/player')
      .send({
        name: 'Player2',
        password: 'AnotherPassword!',
        description: 'Duplicate player'
      });
    player2Id = firstResponse.body.id;

    // Try to create another player with the same name
    const secondResponse = await request(app)
      .post('/player')
      .send({
        name: 'Player2',
        password: 'AnotherPassword!',
        description: 'Duplicate player'
      });

    expect(secondResponse.status).toBe(409);
  });

  // Test login with correct credentials
  it('should log in with correct credentials', async () => {
    const response = await request(app)
      .post('/player/login')
      .send({
        name: 'Player1',
        password: 'Password123!'
      });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeDefined();
    playerToken = response.body.token;
  });

  // Test login with wrong password
  it('should fail to login with wrong password', async () => {
    const loginResponse = await request(app)
      .post('/player/login')
      .send({
        name: 'Player1',
        password: 'WrongPassword'
      });

    expect(loginResponse.status).toBe(401);
  });

  it('should update the player successfully', async () => {
    const response = await request(app)
      .put(`/player/${playerId}`)
      .send({ gold: 200 })
      .set('Authorization', `Bearer ${playerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.gold).toBe(200);
  });

  // Test getting player data with valid authentication
  it('should get player data by ID when authenticated', async () => {
    const getResponse = await request(app)
      .get(`/player/${player2Id}`)
      .set('Authorization', `Bearer ${playerToken}`);

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.id).toBe(player2Id);
  });

  // Test getting player data without authentication
  it('should fail to get player data when not authenticated', async () => {
    const response = await request(app)
      .get(`/player/${playerId}`);

    expect(response.status).toBe(401);
  });

  // Test getting player data when player is not found (404)
  it('should return 404 when player does not exist', async () => {
    const response = await request(app)
      .get(`/player/${uuidv4()}`)
      .set('Authorization', `Bearer ${playerToken}`);

    expect(response.status).toBe(404);
  });

  it('should delete the player successfully', async () => {
    const response = await request(app)
      .delete(`/player/${playerId}`)
      .set('Authorization', `Bearer ${playerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Player deleted successfully.');
  });
});

