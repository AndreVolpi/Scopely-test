/**
 * Initializes and starts the battle worker loop.
 * 
 * This script runs as a background service, responsible for:
 * - Periodically polling the Redis battle queue every 5 seconds.
 * - Processing available battles using `processBattle()` from the battle logic service.
 * - Logging startup and any errors during execution.
 * 
 * This worker ensures that queued battles are continuously executed without manual intervention.
 */

import processBattle from './services/battleLogicService';
import { logger } from './utils/logger';

/**
 * Starts the recurring battle worker loop that polls the battle queue.
 */
const startBattleWorker = () => {
  logger.info('Battle worker started.');

  // Run every 5 seconds
  setInterval(async () => {
    try {
      await processBattle(); // Execute any pending battles
    } catch (err) {
      logger.error(err, 'Battle worker errored.');
    }
  }, 5000);
};

// Immediately launch the worker when this file is run
startBattleWorker();

