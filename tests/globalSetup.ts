import { app } from '../src/app';
import RedisClientSingleton from '../src/db/redisClient';

let runningApp: any;

beforeAll(async () => {
  const redis = await RedisClientSingleton.getInstance();
  await redis.flushDb();
  runningApp = await app.start(0);
});

afterAll(async () => {
  runningApp.close();
  const redis = await RedisClientSingleton.getInstance();
  await redis.quit();
});

export const waitForBattlesToFinish = async (timeout = 5000, interval = 10) => {
  const client = await RedisClientSingleton.getInstance();
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const count = await client.sCard('battle:progress');
    if (count === 0) return;

    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error('Timed out waiting for battles to finish.');
}

