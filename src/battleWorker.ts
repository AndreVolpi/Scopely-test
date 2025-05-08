import processBattle from './services/battleLogicService';
import { logger } from './utils/logger';

const startBattleWorker = () => {
  logger.info('Battle worker started.');
  setInterval(async () => {
    try {
      await processBattle();
    } catch (err) {
      logger.error(err, 'Battle worker errored.');
    }
  }, 5000);
};

startBattleWorker();
