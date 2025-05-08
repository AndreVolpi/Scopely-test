import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { app } from './app';
import swaggerSpec from './swagger';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;

app.get('/docs.json', (req, res) => {
  res.send(swaggerSpec);
});

app.start(PORT).then(() => {
  logger.info(`Server listening on port ${PORT}`);
});
