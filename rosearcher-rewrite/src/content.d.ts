interface ServerData {
    id: string;
    maxPlayers: number;
    playing: number;
    playerTokens: string[];
    players: any[];
    fps: number;
    ping: number;
}

declare interface ServerResponse {
    previousPageCursor: string | null;
    nextPageCursor: string | null;
    data: ServerData[];
}