import { app } from '../app';
import authenticate from '../middlewares/authMiddleware';
import LeaderboardRepository from '../db/leaderboardRepository';
import { logger } from '../utils/logger';
import Joi from 'joi';

const getLeaderboardSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  perPage: Joi.number().integer().min(1).max(100).default(10),
});

/**
 * @swagger
 * tags:
 *   name: Leaderboard
 *   description: Endpoints for leaderboard rankings
 */

/**
 * @swagger
 * /leaderboard:
 *   get:
 *     summary: Get leaderboard rankings
 *     tags: [Leaderboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         required: false
 *         description: Page number
 *       - in: query
 *         name: perPage
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         required: false
 *         description: Number of players per page
 *     responses:
 *       200:
 *         description: Paginated leaderboard results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 page:
 *                   type: integer
 *                 perPage:
 *                   type: integer
 *                 leaderboard:
 *                   type: array
 *                   items:
 *                     type: object
 *                     additionalProperties: true
 *       400:
 *         description: Invalid query parameters
 *       500:
 *         description: Internal server error
 */

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

