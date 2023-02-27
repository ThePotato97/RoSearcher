interface GameLauncher {
  joinGameInstance(place: number, id: number): void;
}

interface Window {
  Roblox: {
    GameLauncher: GameLauncher;
  };
}
