import dotenv from 'dotenv';
import { logger } from './utils/logger';
import startBattleWorker from './services/battleWorker';
import { app } from './app';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;

app.start(PORT).then(() => {
  logger.info(`Server listening on port ${PORT}`);
  startBattleWorker();
});
