import RedisClientSingleton from './redisClient';
import { PlayerData } from '../types/player';
import { v4 as uuidv4 } from 'uuid';

class RedisPlayerRepository {
  // Create a new player and store it as a JSON string in Redis
  public static async createPlayer(playerData: Omit<PlayerData, 'id'>): Promise<PlayerData> {
    const client = await RedisClientSingleton.getInstance();
    const id = uuidv4(); // Generate unique ID for the player
    const playerWithId = { ...playerData, id };

    // Store player data as a JSON string
    await client.set(`player:${id}`, JSON.stringify(playerWithId));

    // Store player name as a key for quick lookup
    await client.set(`player:name:${playerData.name.toLowerCase()}`, id);
    
    return playerWithId;
  }

  // Get a player by ID
  public static async getPlayerById(id: string): Promise<PlayerData | null> {
    const client = await RedisClientSingleton.getInstance();
    const playerData = await client.get(`player:${id}`);

    if (!playerData) {
      return null;
    }

    return JSON.parse(playerData);
  }
  
  // Get a player by name
  public static async getPlayerByName(name: string): Promise<PlayerData | null> {
    const client = await RedisClientSingleton.getInstance();
    const playerId = await client.get(`player:name:${name.toLowerCase()}`);

    if (!playerId) {
      return null;
    }

    return this.getPlayerById(playerId);
  }

  // Check if a name already exists
  public static async checkIfNameExists(name: string): Promise<boolean> {
    const client = await RedisClientSingleton.getInstance();
    const playerId = await client.get(`player:name:${name.toLowerCase()}`);

    return playerId !== null;
  }

  // Update a player's data
  public static async updatePlayer(id: string, updates: Partial<PlayerData>): Promise<PlayerData | null> {
    const client = await RedisClientSingleton.getInstance();
    const playerData = await client.get(`player:${id}`);

    if (!playerData) {
      return null;
    }

    const updatedPlayer = { ...JSON.parse(playerData), ...updates };

    // Save the updated player back to Redis as a JSON string
    await client.set(`player:${id}`, JSON.stringify(updatedPlayer));
    return updatedPlayer;
  }

  // Delete a player
  public static async deletePlayer(id: string): Promise<boolean> {
    const client = await RedisClientSingleton.getInstance();
    const playerData = await this.getPlayerById(id);

    if (!playerData) {
      return false;
    }

    const deletedCount = await client.del(`player:${id}`);
    await client.del(`player:name:${playerData.name.toLowerCase()}`);
    return deletedCount > 0;
  }
}

export default RedisPlayerRepository;

