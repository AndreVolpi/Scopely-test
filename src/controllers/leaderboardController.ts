import { app } from '../app';
import authenticate from '../middlewares/authMiddleware';
import LeaderboardRepository from '../db/leaderboardRepository';
import { logger } from '../utils/logger';
import Joi from 'joi';

const getLeaderboardSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  perPage: Joi.number().integer().min(1).max(100).default(10),
});

app.get('/leaderboard', authenticate, async (req: any, res: any) => {
  const { error, value } = getLeaderboardSchema.validate(req.query);

  if (error) {
    logger.error('Failed to fetch leaderboard:', error);
    return res.send(400, { error: error.details[0].message });
  }

  try {
    const leaderboard = await LeaderboardRepository.getLeaderboard(value.page, value.perPage);

    res.send({ page: value.page, perPage: value.perPage, leaderboard });
  } catch (err) {
    logger.error('Failed to fetch leaderboard:', err);
    res.send('Failed to fetch leaderboard.', 500);
  }
});

