import { createClient, RedisClientType } from 'redis';

class RedisClientSingleton {
  private static instance: RedisClientType | null = null;

  private constructor() { }

  public static async getInstance(): Promise<RedisClientType> {
    if (!RedisClientSingleton.instance) {
      RedisClientSingleton.instance = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
      });

      await RedisClientSingleton.instance.connect();
    }

    return RedisClientSingleton.instance;
  }
}

export default RedisClientSingleton;

