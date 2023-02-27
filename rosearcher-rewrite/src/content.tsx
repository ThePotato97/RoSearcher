import Bottleneck from 'bottleneck';
import React, {
    Component,
    ReactNode,
    createElement as h,
} from 'react';
import { createRoot } from 'react-dom/client';

const COLORS = {
    SUCCESS: '#00b06f',
    NEUTRAL: '#0077ff',
    ERROR: '#ff3e3e',
};

const { getURL } = chrome.runtime;

const USER = {
    SUCCESS: getURL('images/user-success.png'),
    NEUTRAL: getURL('images/user.png'),
    ERROR: getURL('images/user-error.png'),
};

const avatarFetchLimiter = new Bottleneck({
    maxConcurrent: 1,
    minTime: 80,
});

const serverFetchLimiter = new Bottleneck({
    maxConcurrent: 1,
    minTime: 50,
});

class BidirectionalMap extends Map {
    reverseMap: Map<any, any[]>;

    constructor() {
        super();
        this.reverseMap = new Map();
    }

    set(key: string, value: string | string[]) {
        super.set(key, value);
        const reverseValue = this.reverseMap.get(value);
        if (reverseValue?.includes(key)) return this;
        if (Array.isArray(reverseValue)) {
            reverseValue.push(key);
        } else {
            this.reverseMap.set(value, [key]);
        }
        return this;
    }

    delete(key: any) {
        const value = super.get(key);
        if (value !== undefined) {
            super.delete(key);
            const keys = this.reverseMap.get(value);
            if (keys) {
                const index = keys.indexOf(key);
                if (index !== -1) {
                    keys.splice(index, 1);
                }
                if (keys.length === 0) {
                    this.reverseMap.delete(value);
                }
            }
            return true;
        }
        return false;
    }

    clear() {
        super.clear();
        this.reverseMap.clear();
    }

    getReverse(key: string): string[] {
        return this.reverseMap.get(key) || [];
    }

    hasReverse(key: any) {
        return this.reverseMap.has(key);
    }
}

const MAX_RETRIES = 5; // Maximum number of retries
const BASE_DELAY = 200; // Base delay in milliseconds
const RETRY_DELAY_FACTOR = 2; // Delay factor for exponential backoff

class QueueManager {
    queue: string[] = [];

    addToQueue = (item: string) => {
        if (this.queue.includes(item)) return;
        this.queue.push(item);
    };

    addToQueueFront = (item: string) => {
        if (this.queue.includes(item)) return;
        this.queue.unshift(item);
    };

    fetchFromQueue = () => this.queue.shift();

    removeFetchAmount = (amount: number) => this.queue.splice(0, amount);

    appendTable = (table: Array<string>) => {
        this.queue = this.queue.concat(table);
    };

    clearQueue = () => {
        this.queue = [];
    };

    length = () => this.queue.length;

    has = (item: string) => this.queue.includes(item);
}

interface ServerData {
    id: string;
    maxPlayers: number;
    playing: number;
    playerTokens: string[];
    players: any[];
    fps: number;
    ping: number;
}

interface ServerResponse {
    previousPageCursor: string | null;
    nextPageCursor: string | null;
    data: ServerData[];
}

interface ThumbnailData {
    requestId: string;
    errorCode: number;
    statusMessage: string;
    targetId: number;
    state: string;
    imageUrl: string;
}

interface ThumbnailResponse {
    data: ThumbnailData[];
}

enum ThumbnailErrorCode {
    TOO_MANY_REQUESTED_IDS = 1,
    INVALID_IMAGE_FORMAT = 2,
    INVALID_SIZE = 3,
    INVALID_IDS = 4,
    UNSUPPORTED_TYPE = 7,
    NOT_AUTHORIZED = 9,
}

interface ThumbnailErrorResponse {
    errorCode: ThumbnailErrorCode;
    statusMessage: string;
}

interface ThumbnailRequestId {
    token: string;
    serverId: string;
}

interface AvatarHeadshot {
    data: Array<{
        targetId: number;
        state: 'Error' | 'Completed';
        imageUrl: string;
    }>;
}

interface PlaceData {
    placeId: number;
    name: string;
    description: string;
    sourceName: string;
    sourceDescription: string;
    url: string;
    builder: string;
    builderId: number;
    hasVerifiedBadge: boolean;
    isPlayable: boolean;
    reasonProhibited: string;
    universeId: number;
    universeRootPlaceId: number;
    price: number;
    imageToken: string;
}

const getPlaceDetails = async (placeId: string) => {
    const response = await fetch(
        `https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeId}`,
        {
            credentials: 'include',
        }
    );
    if (!response.ok) {
        throw new Error(
            `Failed to fetch place data. Status: ${response.status}`
        );
    }
    const data = (await response.json()) as PlaceData[];
    return data[0];
};

interface Creator {
    id: number;
    name: string;
    type: string;
    isRNVAccount: boolean;
    hasVerifiedBadge: boolean;
}

interface Universe {
    id: number;
    rootPlaceId: number;
    name: string;
    description: string;
    sourceName: string;
    sourceDescription: string;
    creator: Creator;
    price: number;
    allowedGearGenres: string[];
    allowedGearCategories: string[];
    isGenreEnforced: boolean;
    copyingAllowed: boolean;
    playing: number;
    visits: number;
    maxPlayers: number;
    created: string;
    updated: string;
    studioAccessToApisAllowed: boolean;
    createVipServersAllowed: boolean;
    universeAvatarType: number;
    genre: string;
    isAllGenre: boolean;
    isFavoritedByUser: boolean;
    favoritedCount: number;
}

interface UniverseResponse {
    data: Universe[];
}

const getUniverseDetails = async (placeId: string) => {
    const response = await fetch(
        `https://games.roblox.com/v1/games?universeIds=${placeId}`,
        {
            credentials: 'include',
        }
    );
    if (!response.ok) {
        throw new Error(
            `Failed to fetch place data. Status: ${response.status}`
        );
    }
    const placeData = (await response.json()) as UniverseResponse;
    return placeData.data[0];
};

const getPlaceId = async () => {
    const { href } = window.location;
    const regex = /games\/(\d+)\//;
    const match = href.match(regex);
    if (!match) return '';

    const [, place] = match;
    return place;
};

async function getUserId(username: string): Promise<string> {
    const response = await fetch(
        'https://users.roblox.com/v1/usernames/users',
        {
            method: 'POST',
            credentials: 'include',
            body: JSON.stringify({
                usernames: [username],
                excludeBannedUsers: true,
            }),
        }
    );
    if (!response.ok) {
        throw new Error(
            `Failed to fetch user data. Status: ${response.status}`
        );
    }
    const userData = await response.json();
    if (userData.errors?.length > 0) {
        throw new Error(
            `Failed to fetch user data. Error: ${userData.errors[0].message}`
        );
    }
    const user = userData.data[0];
    if (!user) {
        throw new Error(`User not found: ${username}`);
    }
    return user.id;
}

async function getThumbnail(userId: string) {
    const thumbnail = fetch(
        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`
    );
    const thumbnailResponse: AvatarHeadshot | undefined = await (
        await thumbnail
    ).json();
    return thumbnailResponse?.data[0].imageUrl;
}

interface ServerHeaderProps {
    children?: JSX.Element | JSX.Element[];
}

function ServerHeader({ children }: ServerHeaderProps) {
    return (
        <div key="rosearcher-header" id="rosearcher-header" className="stack">
            <div key="container-header" className="container-header">
                <h2>RoSearcher</h2>
                {children}
            </div>
        </div>
    );
}
ServerHeader.defaultProps = {
    children: [],
};

interface ServerInfo {
    id: string;
    token: string;
    imageUrls: string[];
}


interface PlayerInfo {
    id: string;
    name: string;
    thumbnail: string;
}

interface ServerItemProps {
    serverInfo: ServerInfo;
    playerInfo: PlayerInfo;
    maxPlayers: number;
    currentPlayers: number;
    placeId: string;
    children?: ReactNode[];
}
function ServerItem({
    serverInfo,
    children,
    playerInfo,
    currentPlayers,
    maxPlayers,
    placeId,
}: ServerItemProps) {
    return (
        <li className="rbx-private-game-server-item col-md-3 col-sm-4 col-xs-6 highlighted">
            <div className="card-item">
                {children}
                <div className="rbx-private-game-server-details game-server-details border-right">
                    <div className="section-header">
                        <span className="font-bold" />
                    </div>
                    <div className="rbx-private-owner">
                        <a
                            className="avatar avatar-card-fullbody owner-avatar"
                            href={`https://www.roblox.com/users/${playerInfo.id}/profile`}
                            title={playerInfo.name}
                        >
                            <span className="thumbnail-2d-container avatar-card-image">
                                <img
                                    className=""
                                    src={playerInfo.thumbnail}
                                    alt=""
                                    title=""
                                />
                            </span>
                        </a>
                        <a
                            className="text-name text-overflow"
                            href="https://www.roblox.com/users/13277651/profile"
                        >
                            <span
                                data-rblx-badge-text-container=""
                                className="jss119"
                            >
                                <span
                                    data-rblx-badge-text-el=""
                                    className="jss117"
                                    style={{ fontWeight: '500' }}
                                >
                                    <span className="jss120">
                                        {playerInfo.name}
                                    </span>
                                </span>
                                <span
                                    data-rblx-badge-icon-el=""
                                    role="button"
                                    tabIndex={0}
                                    className="jss115"
                                />
                            </span>
                        </a>
                    </div>
                    <div className="text-info rbx-game-status rbx-private-game-server-status text-overflow">
                        {`${currentPlayers} of ${maxPlayers} people max`}
                    </div>
                    <div className="server-player-count-gauge border">
                        <div
                            className="gauge-inner-bar border"
                            style={{
                                width: `${
                                    (currentPlayers / (maxPlayers || 1)) * 100
                                }%`,
                            }}
                        />
                    </div>
                    <span>
                        <button
                            type="button"
                            className="btn-full-width btn-control-xs rbx-private-game-server-join game-server-join-btn btn-primary-md btn-min-width"
                            onClick={() =>
                                chrome.runtime.sendMessage({
                                    action: 'join',
                                    message: {
                                        place: placeId,
                                        id: serverInfo.id,
                                    },
                                })
                            }
                        >
                            Join
                        </button>

                        <button
                            type="button"
                            className="btn-full-width btn-control-xs rbx-private-game-server-join game-server-join-btn btn-primary-md btn-min-width"
                            onClick={() =>
                                chrome.runtime.sendMessage({
                                    action: 'saveToken',
                                    message: {
                                        userId: playerInfo.id,
                                        token: serverInfo.token,
                                    },
                                })
                            }
                        >
                            Save Token
                        </button>
                    </span>
                </div>
            </div>
        </li>
    );
}
ServerItem.defaultProps = {
    children: [],
};

interface ServerBodyNew {
    children?: ReactNode | ReactNode[];
}
function ServerBody({ children }: ServerBodyNew) {
    return (
        <ul
            id="rbx-rosearcher-game-server-item-container"
            className="card-list rbx-private-game-server-item-container"
        >
            {children}
        </ul>
    );
}
ServerBody.defaultProps = {
    children: [],
};

const getTokenFromStorage = async (userId: string) => {
    if (!userId) return;
    return new Promise((resolve) => {
        chrome.storage.local.get(['rosearcher-tokens'], (currentTokens) => {
            const result = currentTokens['rosearcher-tokens'];
            const tokens: Map<number, string> = new Map(Object.entries(result));
            resolve(tokens.get(userId));
        });
    });
};

interface State {
  progress: number;
  currentGameId: string | undefined;
  searchButtonEnabled: boolean;
  icon: string;
  statusMessage: string;
  isSearching: boolean;
  currentPlayerId: string;
  currentPlayerThumbnail: string;
  currentPlayerName: string;
  servers: ServerInfo[];
  currentColor: string;
  searchboxInput: string;
}

(async () => {
    const placeId = await getPlaceId();
    const placeData = await getPlaceDetails(placeId);
    const universeData = await getUniverseDetails(String(placeData.universeId));

    class Search extends Component<unknown, State> {
        tokenQueue = new QueueManager();

        serversMap: Map<string, string> = new Map();

        thumbnailsMap: BidirectionalMap = new BidirectionalMap();

        serverTokens: Map<string, string[]> = new Map();

        serversPaged = false;

        currentCursor?: string;

        loadedToken?: string;

        savedTokens: Map<string, string> = new Map();

        maxPlayers = 0;


        constructor(props: any) {
          super(props);
          this.state = {
            progress: 0,
            currentGameId: undefined,
            searchButtonEnabled: false,
            icon: USER.NEUTRAL,
            statusMessage: 'Enter a username to search for a player!',
            isSearching: false,
            currentPlayerThumbnail: '',
            currentPlayerId: '',
            currentPlayerName: '',
            servers: [
                {
                    id: 'd0359f01-8f3b-4a10-89bc-cf4af9f76f92',
                    token: '0B7F0E0CCA795B98C2D26F035BB668F4',
                    imageUrls: [
                        'https://tr.rbxcdn.com/c6c4f38feffbb3c6715b594e2a0e49d8/150/150/AvatarHeadshot/Png',
                        'https://tr.rbxcdn.com/6cef79f338c91c5e1c35928066843581/150/150/AvatarHeadshot/Png',
                        'https://tr.rbxcdn.com/b2e20d36fb942b8b335c2663698db7a1/150/150/AvatarHeadshot/Png',
                        'https://tr.rbxcdn.com/053527c593e93d10f28be9d1d7ff1797/150/150/AvatarHeadshot/Png',
                        'https://tr.rbxcdn.com/9db78eadf7570d6565e2c4bf59382382/150/150/AvatarHeadshot/Png',
                        'https://tr.rbxcdn.com/43fe97f110df00d877535d0493197797/150/150/AvatarHeadshot/Png',
                    ],
                },
            ],
            currentColor: COLORS.NEUTRAL,
            searchboxInput: '',
        };
        }

        fetchTokens = async () => {
            if (this.serversPaged || !this.state.isSearching) return false;
            const fetchData = serverFetchLimiter.wrap(async () => {
                const params = new URLSearchParams({
                    limit: '100',
                });
                if (this.currentCursor)
                    params.append('cursor', this.currentCursor);
                const response = await fetch(
                    `https://games.roblox.com/v1/games/${this.state.currentGameId}/servers/Public?${params}`
                );
                if (!response.ok)
                    throw new Error(
                        `Failed to fetch server data. Status: ${response.status}`
                    );
                const serverData: ServerResponse = await response.json();
                const { nextPageCursor, data } = serverData;
                if (nextPageCursor) {
                    this.currentCursor = nextPageCursor;
                } else {
                    this.serversPaged = true;
                }
                return data;
            });
            const servers = await fetchData();
            console.log(servers.length);
            if (servers.length === 0) return true;
            this.maxPlayers = servers[0].maxPlayers;
            const serverDataArray = servers.map((serverData) => ({
                id: serverData.id,
                tokens: serverData.playerTokens,
            }));
            serverDataArray.forEach((serverData) => {
                this.serverTokens.set(serverData.id, serverData.tokens);
                const savedTokenFound =
                    this.loadedToken &&
                    serverData.tokens.includes(this.loadedToken);

                serverData.tokens.forEach((token) => {
                    if (savedTokenFound) {
                        this.tokenQueue.addToQueueFront(token);
                    } else {
                        this.tokenQueue.addToQueue(token);
                    }
                    this.serversMap.set(token, serverData.id);
                });
            });
            return true;
        };

        stop = () => {
            this.setState({ isSearching: false, progress: 0 });
        };

        clear = () => {
            this.setState({
                currentPlayerThumbnail: undefined,
                currentGameId: undefined,
            });
            this.tokenQueue.clearQueue();
            this.serversMap.clear();
            this.thumbnailsMap.clear();
            this.serverTokens.clear();
            this.currentCursor = undefined;
            this.maxPlayers = 0;
            this.serversPaged = false;
        };

        resolveTokens = async () => {
            if (!this.state.isSearching) return false;
            const tokens = this.tokenQueue.removeFetchAmount(100);
            if (tokens.length === 0) return false;
            const fetchData = avatarFetchLimiter.wrap(async () => {
                const request = await fetch(
                    'https://thumbnails.roblox.com/v1/batch',
                    {
                        credentials: 'include',
                        method: 'POST',
                        body: JSON.stringify(
                            tokens.map((token) => ({
                                token,
                                type: 'AvatarHeadshot',
                                size: '150x150',
                                requestId: JSON.stringify({
                                    serverId: this.serversMap.get(token),
                                    token,
                                }),
                            }))
                        ),
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    }
                );
                if (!request.ok)
                    throw new Error(
                        `Failed to fetch avatar data. Status: ${request.status}`
                    );
                const response: ThumbnailResponse = await request.json();
                return response.data;
            });
            const data = await fetchData();
            if (!data) {
                this.tokenQueue.appendTable(tokens);
                return true;
            }
            data.forEach((thumbnailData) => {
                if (thumbnailData.state === 'Completed') {
                    const { requestId, imageUrl } = thumbnailData;
                    const {
                        token,
                        serverId,
                    }: { token: string; serverId: string } =
                        JSON.parse(requestId);
                    this.serversMap.set(token, serverId);
                    this.thumbnailsMap.set(token, imageUrl);
                }
            });
            return true;
        };

        foundPlayer = () => {
            const { currentPlayerThumbnail, currentGameId } = this.state;
            if (!currentPlayerThumbnail) return false;
            // fetch the token id from the thumbnail map by using the current player thumbnail
            const tokens = this.thumbnailsMap.getReverse(
                currentPlayerThumbnail
            );
            if (!tokens) return undefined;
            // fetch the server id from the servers map by using the token
            const servers = tokens.map((token: string) => ({
                serverId: this.serversMap.get(token),
                token,
            }));
            console.log('Found player in servers: ', servers, tokens);

            const serverState = {
                placeId: currentGameId,
                maxPlayers: this.maxPlayers,
                servers: servers.map((server) => {
                    if (!server.serverId) return;
                    const serverTokens = this.serverTokens.get(server.serverId);
                    if (!serverTokens) return;

                    return {
                        id: server.serverId,
                        token: server.token,
                        imageUrls: serverTokens.map((token: string) => {
                            const imageUrl = this.thumbnailsMap.get(token);
                            if (!imageUrl) return;

                            return imageUrl;
                        }),
                    };
                }),
            };
            console.log(serverState);
            this.setState({
                servers: serverState,
            });
            return servers.length > 0;
        };

        handleInput = (e: React.FormEvent<HTMLInputElement>) => {
            if (e.target instanceof Element) {
                const input = e.target as HTMLInputElement;
                const test = /(^(?=^[^_]+_?[^_]+$)\w{3,20}$|^\d+$)/.test(
                    input.value
                );
                if (!input.value) this.setState({ icon: USER.NEUTRAL });
                else this.setState({ icon: test ? USER.SUCCESS : USER.ERROR });
                this.setState({ searchButtonEnabled: !test });
                this.setState({ searchboxInput: input.value });
            }
        };

        cancel = (color = COLORS.ERROR, message: string) => {
            this.setState({
                isSearching: false,
                statusMessage: message,
                currentColor: color,
            });
        };

        notFound = () => {
            this.cancel(COLORS.ERROR, 'User not found!!');
        };

        handleClick = async (e: React.MouseEvent<HTMLInputElement>) => {
            e.preventDefault();
            if (this.state.isSearching) {
                this.stop();
                return;
            }
            this.clear();
            this.setState({
                isSearching: true,
                statusMessage: 'Searching...',
                servers: {},
            });
            if (!placeId) return;
            const input = this.state.searchboxInput;
            let userId: number | string = parseInt(input);
            if (isNaN(userId)) {
                userId = await getUserId(input);
            }
            if (!userId) {
                this.notFound();
                return;
            }
            this.loadedToken = undefined;
            const token = await getTokenFromStorage(userId.toString());
            if (token) {
                this.loadedToken = token;
            }
            this.setState({ currentPlayerId: userId });

            const thumbnail = await getThumbnail(userId.toString());
            if (!thumbnail) {
                this.notFound();
                return;
            }
            this.setState({
                currentGameId: placeId,
                currentPlayerThumbnail: thumbnail,
                userId: userId.toString(),
            });
            while (true) {
                const tokensFetched = await this.fetchTokens();
                if (!this.state.isSearching) {
                    this.cancel(
                        this.foundPlayer() ? COLORS.SUCCESS : COLORS.NEUTRAL,
                        'Search cancelled!'
                    );
                    return;
                }
                const tokensResolved = await this.resolveTokens();
                this.foundPlayer();

                if (!this.state.isSearching) {
                    this.cancel(
                        this.foundPlayer() ? COLORS.SUCCESS : COLORS.NEUTRAL,
                        'Search cancelled!'
                    );
                    return;
                }

                const playersChecked = this.thumbnailsMap.size;
                const playersCount = this.tokenQueue.length() + playersChecked;

                this.setState({
                    progress: Math.round((playersChecked / playersCount) * 100),
                    statusMessage: `Searching... \n Fetched ${this.serverTokens.size} servers \n Resolved: (${playersChecked}/${playersCount}) thumbnails`,
                });

                if (!tokensFetched && !tokensResolved) break;
            }
            const foundPlayer = this.foundPlayer();
            if (foundPlayer) {
                this.setState({ currentColor: COLORS.SUCCESS });
                this.stop();
            } else {
                this.setState({
                    currentColor: COLORS.ERROR,
                    statusMessage: 'Player not Found!',
                });
                this.stop();
            }
        };

        render() {
            const {
                servers,
                statusMessage,
                currentPlayerId,
                currentPlayerName,
                currentPlayerThumbnail,
                icon,
                currentColor,
                isSearching,
                searchButtonEnabled,
                progress,
            } = this.state;
            const showServers = servers && servers.length > 0;
            return (
                <>
                    <ServerHeader>
                        <div
                            id="rosearch-panel"
                            className={
                                document.body.classList.contains('dark-theme')
                                    ? 'dark'
                                    : ''
                            }
                        >
                            <form autoComplete="off">
                                <img
                                    src={icon}
                                    className="icon"
                                    id="rosearch-user"
                                    alt="Status Icon"
                                />
                                <input
                                    type="text"
                                    id="rosearch-input"
                                    name="input"
                                    placeholder="Username"
                                    onInput={this.handleInput}
                                />
                                <input
                                    style={{ backgroundColor: currentColor }}
                                    src={
                                        isSearching
                                            ? getURL('images/cancel.png')
                                            : getURL('images/search.png')
                                    }
                                    type="image"
                                    id="rosearch-search"
                                    disabled={searchButtonEnabled}
                                    onClick={this.handleClick}
                                    alt="Search"
                                />
                            </form>
                            <div id="rosearch-progress">
                                <div
                                    id="rosearch-bar"
                                    style={{
                                        width: `${progress}%`,
                                        backgroundColor: currentColor,
                                    }}
                                />
                            </div>
                            <p id="rosearch-status" />
                        </div>
                    </ServerHeader>
                    <ServerBody>
                        {showServers ? (
                            servers.map((server) => {
                                const { id, token, imageUrls } = server;
                                return (
                                    <ServerItem
                                        playerInfo={{
                                            id: currentPlayerId,
                                            name: currentPlayerName,
                                            thumbnail: currentPlayerThumbnail,
                                        }}
                                        placeId={placeId}
                                        key={server.id}
                                        currentPlayers={imageUrls.length}
                                        maxPlayers={this.maxPlayers}
                                        serverInfo={{
                                            id,
                                            token,
                                        }}
                                    >
                                        {imageUrls.map((imageUrl) => (
                                            <span
                                                key={imageUrl}
                                                className="avatar avatar-headshot-md player-avatar"
                                            >
                                                <span className="thumbnail-2d-container avatar-card-image">
                                                    <img
                                                        src={imageUrl}
                                                        alt=""
                                                        title=""
                                                    />
                                                </span>
                                            </span>
                                        ))}
                                    </ServerItem>
                                );
                            })
                        ) : (
                            <div
                                className="section-content-off"
                                style={{ whiteSpace: 'pre-wrap' }}
                            >
                                {statusMessage
                                    .split('\n')
                                    .map((line, index) => (
                                        <div key={index}>{line}</div>
                                    ))}
                            </div>
                        )}
                    </ServerBody>
                </>
            );
        }
    }

    function waitForElm(selector: string) {
        return new Promise((resolve) => {
            if (document.querySelector(selector))
                resolve(document.querySelector(selector));

            const observer = new MutationObserver(() => {
                if (document.querySelector(selector)) {
                    resolve(document.querySelector(selector));
                    observer.disconnect();
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
            });
        });
    }

    const container = await waitForElm('#running-game-instances-container');
    if (container instanceof HTMLElement) {
        const newElement = document.createElement('div');
        newElement.id = 'rosearcher';
        newElement.className = 'stack';
        container.prepend(newElement);
        const root = createRoot(newElement);
        root.render( <Search/> );
    }
})();
