import Joi from 'joi';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { app } from '../app';
import RedisPlayerRepository from '../db/playerRepository';
import { logger } from '../utils/logger';
import authenticate from '../middlewares/authMiddleware';
import { PlayerData } from '../types/player';

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';

const createPlayerSchema = Joi.object({
  name: Joi.string().max(20).required(),
  password: Joi.string().required(),
  description: Joi.string().max(1000).required(),
  gold: Joi.number().min(0).max(1000000000).default(0),
  silver: Joi.number().min(0).max(1000000000).default(0),
  attackValue: Joi.number().min(5).default(0),
  defenseValue: Joi.number().min(5).default(0),
  hitPoints: Joi.number().min(0).default(0),
}).custom((value, helper) => {
  const total = value.attackValue + value.defenseValue;
  if (total > 30) {
    return helper.message({ custom: 'attackValue and defenseValue must sum up to 30' });
  }
  return value;
}, 'attack+defense sum validation');

const updatePlayerSchema = Joi.object({
  name: Joi.string().max(20),
  description: Joi.string().max(1000),
  gold: Joi.number().min(0).max(1000000000),
  silver: Joi.number().min(0).max(1000000000),
  attackValue: Joi.number().min(5),
  defenseValue: Joi.number().min(5),
  hitPoints: Joi.number().min(0),
}).custom((value, helper) => {
  const total = value.attackValue + value.defenseValue;
  if (total > 30) {
    return helper.message({ custom: 'attackValue and defenseValue must sum up to 30' });
  }
  return value;
}, 'attack+defense sum validation');

// Login validation
const loginSchema = Joi.object({
  name: Joi.string().required(),
  password: Joi.string().required(),
});

/**
 * @swagger
 * tags:
 *   name: Player
 *   description: Operations related to player management
 */

/**
 * @swagger
 * /player:
 *   post:
 *     summary: Create a new player
 *     tags: [Player]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               password:
 *                 type: string
 *               description:
 *                 type: string
 *               gold:
 *                 type: number
 *               silver:
 *                 type: number
 *               attackValue:
 *                 type: number
 *               defenseValue:
 *                 type: number
 *               hitPoints:
 *                 type: number
 *     responses:
 *       201:
 *         description: Player created successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: Name already in use
 *       500:
 *         description: Internal server error
 */
app.post('/player', async (req: any, res: any) => {
  const { error, value } = createPlayerSchema.validate(req.body);

  if (error) {
    logger.error(error, 'Error creating player.');
    return res.send({ message: error.details[0].message }, 400);
  }

  if (await RedisPlayerRepository.checkIfNameExists(value.name)) {
    logger.error({ message: 'Name already in use' }, 'Error creating player.');
    return res.send({ message: 'Name already in use' }, 409);
  }

  const hashedPassword = await bcrypt.hash(value.password, 10);
  const playerData: PlayerData = { ...value, password: hashedPassword };

  try {
    const player = await RedisPlayerRepository.createPlayer(playerData);
    const { password, ...playerWithoutPassword } = player;
    return res.send(playerWithoutPassword, 201);
  } catch (err) {
    logger.error(err, 'Error creating player.');
    return res.send({ message: 'Error creating player.' }, 500);
  }
});

/**
 * @swagger
 * /player/login:
 *   post:
 *     summary: Authenticate a player and return a JWT token
 *     tags: [Player]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Internal server error
 */
app.post('/player/login', async (req: any, res: any) => {
  const { error, value } = loginSchema.validate(req.body);

  if (error) {
    logger.error(error, 'Error authenticating player.');
    return res.send({ message: error.details[0].message }, 400);
  }

  try {
    const player = await RedisPlayerRepository.getPlayerByName(value.name);
    if (!player) {
      logger.error({ message: 'Player not found.' }, 'Error authenticating player.');
      return res.send({ message: 'Invalid credentials.' }, 401);
    }

    const validPassword = await bcrypt.compare(value.password, player.password);
    if (!validPassword) {
      logger.error({ message: 'Incorrect password.' }, 'Error authenticating player.');
      return res.send({ message: 'Invalid credentials.' }, 401);
    }

    const token = jwt.sign(
      { id: player.id, name: player.name },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    return res.send({ token }, 200);
  } catch (err) {
    logger.error(err, 'Error during login.');
    return res.send({ message: 'Login failed.' }, 500);
  }
});

/**
 * @swagger
 * /player/{id}:
 *   get:
 *     summary: Get a player by ID
 *     tags: [Player]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The player ID
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Player data
 *       404:
 *         description: Player not found
 *       500:
 *         description: Internal server error
 */
app.get('/player/:id', authenticate, async (req: any, res: any) => {
  const { id } = req.params;

  try {
    const player = await RedisPlayerRepository.getPlayerById(id);
    if (!player) {
      logger.error({ message: 'Player not found.' }, 'Error fetching player.');
      return res.send({ message: 'Player not found.' }, 404);
    }
    return res.send(player, 200);
  } catch (err) {
    logger.error(err, 'Error fetching player.');
    return res.send({ message: 'Error fetching player.' }, 500);
  }
});

/**
 * @swagger
 * /player/{id}:
 *   put:
 *     summary: Update a player by ID
 *     tags: [Player]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The player ID
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               gold:
 *                 type: number
 *               silver:
 *                 type: number
 *               attackValue:
 *                 type: number
 *               defenseValue:
 *                 type: number
 *               hitPoints:
 *                 type: number
 *     responses:
 *       200:
 *         description: Player updated successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Player not found
 *       500:
 *         description: Internal server error
 */
app.put('/player/:id', authenticate, async (req: any, res: any) => {
  const { id } = req.params;
  if (id !== req.user.id) {
    logger.error({ message: 'Player not the owner.' }, 'Error updating player.');
    return res.send({ message: 'Unauthorized.' }, 403);
  }

  const { error, value } = updatePlayerSchema.validate(req.body);

  if (error) {
    logger.error(error, 'Error updating player.');
    return res.send({ message: error.details[0].message }, 400);
  }

  const updates: Partial<PlayerData> = value;

  try {
    const updatedPlayer = await RedisPlayerRepository.updatePlayer(id, updates);
    if (!updatedPlayer) {
      logger.error({ message: 'Player not found.' }, 'Error updating player.');
      return res.send({ message: 'Player not found.' }, 404);
    }
    return res.send(updatedPlayer, 200);
  } catch (err) {
    logger.error(err, 'Error updating player.');
    return res.send({ message: 'Error updating player.' }, 500);
  }
});

/**
 * @swagger
 * /player/{id}:
 *   delete:
 *     summary: Delete a player by ID
 *     tags: [Player]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The player ID
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Player deleted successfully
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Player not found
 *       500:
 *         description: Internal server error
 */
app.delete('/player/:id', authenticate, async (req: any, res: any) => {
  const { id } = req.params;
  if (id !== req.user.id) {
    logger.error({ message: 'Player not the owner.' }, 'Error deleting player.');
    return res.send({ message: 'Unauthorized.' }, 403);
  }

  try {
    const success = await RedisPlayerRepository.deletePlayer(id);
    if (!success) {
      logger.error({ message: 'Player not found.' }, 'Error deleting player.');
      return res.send({ message: 'Player not found.' }, 404);
    }
    return res.send({ message: 'Player deleted successfully.' }, 200);
  } catch (err) {
    logger.error(err, 'Error deleting player.');
    return res.send({ message: 'Error deleting player.' }, 500);
  }
});

