interface BattleReport {
  players: {
    id: string;
    name: string;
    attack: number;
    hp: number;
    defense: number;
    currentHp: number;
  }[];
  rounds: {
    attacker: string;
    hit: boolean;
    damage: number | undefined;
  }[];
  battleWinner: string | undefined;
  resourcesStolen: {
    gold: number;
    silver: number;
  };
}

