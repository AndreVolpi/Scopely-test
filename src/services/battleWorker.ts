import processBattle from './battleLogicService';

const startBattleWorker = () => {
  setInterval(async () => {
    await processBattle();
  }, 5000);
};

export default startBattleWorker;
