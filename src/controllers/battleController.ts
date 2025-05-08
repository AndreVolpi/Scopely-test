import { app } from '../app';
import RedisPlayerRepository from '../db/playerRepository';
import { logger } from '../utils/logger';
import authenticate from '../middlewares/authMiddleware';
import RedisClientSingleton from '../db/redisClient';
import { v4 as uuidv4 } from 'uuid';


app.post('/battle/:targetId', authenticate, async (req: any, res: any) => {
  const redis = await RedisClientSingleton.getInstance();
  try {
    const targetPlayer = await RedisPlayerRepository.getPlayerById(req.params.targetId);
    if (!targetPlayer) {
      logger.error({ message: 'Player not found.' }, 'Error enqueuing battle.');
      return res.send({ message: 'Player not found.' }, 404);
    }

    const battleId = uuidv4();
    const battleData = JSON.stringify({ player1Id: req.user.id, player2Id: targetPlayer.id });
    await redis.set(`battle:${battleId}`, battleData);
    await redis.rPush('battleQueue', battleId);

    return res.send({
      enqueued: true,
      battleId: battleId,
    }, 200);
  } catch (err) {
    logger.error(err, 'Error enqueuing battle.');
    return res.send({ message: 'Error enqueuing battle.' }, 500);
  }
});

app.get('/battle/:battleId', authenticate, async (req: any, res: any) => {
  const redis = await RedisClientSingleton.getInstance();
  try {
    const data = await redis.get(`battle:report:${req.params.battleId}`);
    if (!data) {
      logger.error({ battleId: req.params.battleId }, 'Error getting battle report.');
      return res.send({ message: 'Error getting battle report.' }, 500);
    }

    const battleReport = JSON.parse(data);

    if (battleReport.players.every((player: { id: string }) => player.id !== req.user.id)) {
      logger.error({ battleId: req.params.battleId, user: req.user.id }, 'Unauthorized battle report request.');
      return res.send({ message: 'Unauthorized.' }, 403);
    }

    res.send(battleReport, 200);
  } catch (err) {
    logger.error(err, 'Error getting battle report.');
    return res.send({ message: 'Error getting battle report.' }, 500);
  }
});
