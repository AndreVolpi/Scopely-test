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

