import Bottleneck from 'bottleneck';
import React, {
    MouseEventHandler,
    ReactNode,
    useEffect,
    useState,
} from 'react';
import { createRoot } from 'react-dom/client';
import { BidirectionalMap, QueueManager } from './helpers';
import { GameButton, GameServerDetails, ServerBody, ServerHeader, ServerItem } from './components';

const { getURL, sendMessage } = chrome.runtime;

enum COLORS {
    SUCCESS = '#00b06f',
    NEUTRAL = '#0077ff',
    ERROR = '#ff3e3e',
}

const USER = {
    SUCCESS: getURL('images/user-success.png'),
    NEUTRAL: getURL('images/user.png'),
    ERROR: getURL('images/user-error.png'),
};

const avatarFetchLimiter = new Bottleneck({
    maxConcurrent: 50,
    minTime: 20,
    strategy: Bottleneck.strategy.LEAK,
});

const serverFetchLimiter = new Bottleneck({
    minTime: 301,
});

const fetchJSON = async (url: RequestInfo, options?: RequestInit) => {
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`fetchJSON failed, HTTP status ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        if (error instanceof Error) {
            return Promise.reject(error);
        }
        return Promise.reject(error);
    }
};

const waitForElm = ({ selector }: { selector: string }) =>
    new Promise((resolve) => {
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

const MAX_RETRIES = 5; // Maximum number of retries
const BASE_DELAY = 200; // Base delay in milliseconds
const RETRY_DELAY_FACTOR = 2; // Delay factor for exponential backoff

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
    const placeData = (await fetchJSON(
        `https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeId}`,
        {
            credentials: 'include',
        }
    )) as PlaceData[];
    if (!placeData || placeData.length === 0) {
        throw new Error(`Failed to fetch place data.`);
    }
    return placeData[0];
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
    try {
        const placeData = (await fetchJSON(
            `https://games.roblox.com/v1/games?universeIds=${placeId}`,
            {
                credentials: 'include',
            }
        )) as UniverseResponse;
        if (!placeData.data || placeData.data.length === 0) {
            throw new Error(`Failed to fetch place data.`);
        }
        return placeData.data[0];
    } catch (error) {
        console.error(`Failed to get universe details: ${error}`);
        throw error;
    }
};

const getPlaceId = async () => {
    const { href } = window.location;
    const regex = /games\/(\d+)\//;
    const match = href.match(regex);
    if (!match) return '';

    const [, place] = match;
    return place;
};

type User = {
    requestedUsername: string;
    hasVerifiedBadge: boolean;
    id: number;
    name: string;
    displayName: string;
};

type UserResponse = {
    data: User[];
};

const getUserId = async (username: string) => {
    const response = (await fetchJSON(
        'https://users.roblox.com/v1/usernames/users',
        {
            method: 'POST',
            credentials: 'include',
            body: JSON.stringify({
                usernames: [username],
                excludeBannedUsers: true,
            }),
        }
    )) as UserResponse;
    if (!response.data || response.data.length === 0) {
        throw new Error(`Failed to fetch user data.`);
    }
    const user = response.data[0];
    if (!user) {
        throw new Error(`User not found: ${username}`);
    }
    return user.id;
};

async function getThumbnail(userId: string) {
    const thumbnailResponse = (await fetchJSON(
        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`
    )) as AvatarHeadshot | undefined;
    return thumbnailResponse?.data[0].imageUrl;
}


interface PlayerInfo {
    id: string;
    name: string;
    thumbnail: string;
}


interface ServerInfo {
    id: string;
    token: string;
    imageUrls: string[];
}




const getTokenFromStorage = async (userId: string) => {
    if (!userId) return;
    return new Promise((resolve) => {
        chrome.storage.local.get(['rosearcher-tokens'], (currentTokens) => {
            const result = currentTokens['rosearcher-tokens'] ?? [];
            const tokens: Map<string, string> = new Map(Object.entries(result));
            resolve(tokens.get(userId));
        });
    });
};

interface MainComponentProps {
    placeId: string;
    handleSearch: (input: string) => void;
    currentPlayerInfo: PlayerInfo;
    currentColor: string;
    progress: number;
    isSearching: boolean;
    statusMessage: string;
    maxPlayers: number;
    servers: ServerInfo[];
}

function MainComponent({
    placeId,
    handleSearch,
    progress,
    currentColor,
    isSearching,
    currentPlayerInfo,
    statusMessage,
    maxPlayers,
    servers,
}: MainComponentProps) {
    const [savedTokens, setSavedTokens] = useState(new Map());
    const [searchBoxInput, setSearchBoxInput] = useState('');
    const [searchButtonEnabled, setSearchButtonEnabled] = useState(false);
    const [icon, setIcon] = useState(USER.NEUTRAL);

    const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
        if (e.target instanceof Element) {
            const input = e.target as HTMLInputElement;
            const test = /(^(?=^[^_]+_?[^_]+$)\w{3,20}$|^\d+$)/.test(
                input.value
            );
            if (!input.value) setIcon(USER.NEUTRAL);
            else setIcon(test ? USER.SUCCESS : USER.ERROR);
            setSearchButtonEnabled(!test);
            setSearchBoxInput(input.value);
        }
    };
    const handleButtonClick = (e: React.MouseEvent<HTMLInputElement>) => {
        e.preventDefault();
        handleSearch(searchBoxInput);
    };

    useEffect(() => {
        chrome.storage.local.get(['rosearcher-tokens'], (currentTokens) => {
            const result = currentTokens['rosearcher-tokens'] ?? [];
            setSavedTokens(new Map(Object.entries(result)));
        });
    }, []);

    useEffect(() => {
        chrome.storage.local.set({
            'rosearcher-tokens': Object.fromEntries(
                Array.from(savedTokens.entries())
            ),
        });
    }, [savedTokens]);

    const toggleSavedToken = (playerId: string, token: string) => {
        if (!playerId || !token) return;
        // create new map with current saved tokens cause react state is immutable
        const newTokens = new Map(savedTokens);
        if (newTokens.has(playerId)) {
            // remove token from saved tokens
            newTokens.delete(playerId);
        } else {
            // add token to saved tokens
            newTokens.set(playerId, token);
        }
        setSavedTokens(newTokens);
    };

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
                            onInput={handleInput}
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
                            onClick={handleButtonClick}
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
                            <ServerItem key={server.id}>
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
                                <GameServerDetails
                                    playerInfo={currentPlayerInfo}
                                    maxPlayers={maxPlayers}
                                    currentPlayers={imageUrls.length}
                                >
                                    <GameButton
                                        onClick={() =>
                                            sendMessage({
                                                action: 'join',
                                                message: {
                                                    place: placeId,
                                                    id,
                                                },
                                            })
                                        }
                                    >
                                        Join
                                    </GameButton>
                                    <GameButton
                                        onClick={() =>
                                            toggleSavedToken(
                                                currentPlayerInfo.id,
                                                token
                                            )
                                        }
                                    >
                                        {savedTokens.get(currentPlayerInfo.id)
                                            ? 'Forget Token'
                                            : 'Remember Token'}
                                    </GameButton>
                                </GameServerDetails>
                            </ServerItem>
                        );
                    })
                ) : (
                    <div
                        className="section-content-off"
                        style={{ whiteSpace: 'pre-wrap' }}
                    >
                        {statusMessage.split('\n').map((line, index) => (
                            <div key={index}>{line}</div>
                        ))}
                    </div>
                )}
            </ServerBody>
        </>
    );
}

interface SearchState {
    progress: number;
    servers: ServerInfo[];
    isSearching: boolean;
    statusMessage: string;
    maxPlayers: number;
    currentPlayerInfo: PlayerInfo;
    currentColor: COLORS;
}

(async () => {
    const placeId = await getPlaceId();
    const placeData = await getPlaceDetails(placeId);
    const universeData = await getUniverseDetails(String(placeData.universeId));
    class Search extends React.Component<unknown, SearchState> {
        tokenQueue = new QueueManager();

        serversMap: Map<string, string> = new Map();

        thumbnailsMap: BidirectionalMap<string, string> =
            new BidirectionalMap();

        serverTokens: Map<string, string[]> = new Map();

        serversPaged = false;

        currentCursor?: string;

        loadedToken?: string;

        currentPlaceId = placeId;

        cursors: string[] = [];

        constructor(props: []) {
            super(props);
            this.state = {
                maxPlayers: 0,
                statusMessage: 'Enter a username to search for a player!',
                progress: 0,
                currentPlayerInfo: {
                    id: '',
                    name: '',
                    thumbnail: '',
                },
                servers: [],
                currentColor: COLORS.NEUTRAL,
                isSearching: false,
            };
        }

        fetchTokens = async (cursor?: string) => {
            const hasCursor = cursor !== undefined;
            const currentCursor = cursor ?? this.currentCursor;
            const { isSearching } = this.state;
            if (this.serversPaged || !isSearching) return false;
            const fetchData = async () => {
                const params = new URLSearchParams({
                    limit: '100',
                });
                if (currentCursor) params.append('cursor', currentCursor);

                const response = await fetchJSON(
                    `https://games.roblox.com/v1/games/${
                        this.currentPlaceId
                    }/servers/Public?${params.toString()}`,
                    {
                        credentials: 'omit',
                    }
                );
                if (!response.data)
                    throw new Error(`Failed to fetch server data.`);
                const { nextPageCursor, data } = response;
                if (nextPageCursor && data.length !== 100) {
                    console.warn('Incomplete page of data returned from API');
                    return true;
                }
                if (hasCursor) return data;
                if (nextPageCursor) {
                    if (!this.cursors.includes(nextPageCursor)) {
                        this.cursors.push(nextPageCursor);
                    }
                    this.currentCursor = nextPageCursor;
                } else {
                    this.serversPaged = true;
                }
                return data;
            };

            const servers = (await fetchData()) as ServerData[];
            console.log(servers.length);
            if (servers.length === 0) return true;

            this.setState({ maxPlayers: servers[0].maxPlayers });

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
                    if (!this.thumbnailsMap.has(token)) {
                        if (savedTokenFound) {
                            this.tokenQueue.addToQueueFront(token);
                        } else {
                            this.tokenQueue.addToQueue(token);
                        }
                        this.serversMap.set(token, serverData.id);
                    }
                });
            });
            return true;
        };

        stop = () => {
            this.setState({ isSearching: false, progress: 0 });
        };

        clear = () => {
            this.setState({
                currentPlayerInfo: {
                    id: '',
                    name: '',
                    thumbnail: '',
                },
                maxPlayers: 0,
            });
            this.tokenQueue.clearQueue();
            this.serversMap.clear();
            this.thumbnailsMap.clear();
            this.serverTokens.clear();
            this.currentCursor = undefined;
            this.serversPaged = false;
        };

        resolveTokens = async () => {
            const { isSearching } = this.state;
            if (!isSearching) return false;
            const tokens = this.tokenQueue.removeFetchAmount(100);
            if (tokens.length === 0) return false;
            const fetchData = avatarFetchLimiter.wrap(async () => {
                const request: ThumbnailResponse = await fetchJSON(
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
                if (!request.data) throw new Error(`Failed to fetch tokens.`);
                return request.data;
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
            const { currentPlayerInfo } = this.state;
            const { thumbnail } = currentPlayerInfo;
            if (!thumbnail) return false;
            // fetch the token id from the thumbnail map by using the current player thumbnail
            const tokens = this.thumbnailsMap.getReverse(thumbnail);
            if (!tokens) return undefined;
            // fetch the server id from the servers map by using the token
            const servers = tokens
                .map((token: string) => ({
                    serverId: this.serversMap.get(token),
                    token,
                }))
                .filter(
                    (server): server is { serverId: string; token: string } =>
                        server.serverId !== undefined
                );

            console.log('Found player in servers: ', servers, tokens);

            const resolvedServers = servers
                .map((server) => {
                    if (!server.serverId) return;
                    const serverTokens = this.serverTokens.get(server.serverId);
                    if (!serverTokens) return;
                    const imageUrls = serverTokens
                        .map((token: string) => {
                            const imageUrl = this.thumbnailsMap.get(token);
                            return imageUrl;
                        })
                        .filter(
                            (imageUrl): imageUrl is string =>
                                imageUrl !== undefined
                        );

                    return {
                        id: server.serverId,
                        token: server.token,
                        imageUrls,
                    };
                })
                .filter(
                    (
                        server
                    ): server is {
                        id: string;
                        token: string;
                        imageUrls: string[];
                    } => server?.id !== undefined
                );
            this.setState({ servers: resolvedServers });
            return servers.length > 0;
        };

        cancel = (color = COLORS.ERROR, message = '') => {
            this.setState({
                progress: 0,
                isSearching: false,
                statusMessage: message,
                currentColor: color,
            });
        };

        notFound = () => {
            this.cancel(COLORS.ERROR, 'User not found!!');
        };

        updateProgress = () => {
            const playersChecked = this.thumbnailsMap.size;
            const playersCount = this.tokenQueue.length() + playersChecked;

            this.setState({
                progress: Math.round((playersChecked / playersCount) * 100),
                statusMessage: `Searching... \n Fetched ${this.serverTokens.size} servers  \n Resolved: (${playersChecked}/${playersCount}) thumbnails`,
            });
        };

        searchLoop = async () => {
            const { isSearching } = this.state;
            const [tokensResolved, fetchTokens] = await Promise.all([
                this.resolveTokens(),
                this.fetchTokens(),
            ]);
            if (!isSearching) {
                this.cancel(
                    this.foundPlayer() ? COLORS.SUCCESS : COLORS.NEUTRAL,
                    'Search Cancelled!'
                );
                return true;
            }
            const found = this.foundPlayer();
            if (found) {
                this.setState({ currentColor: COLORS.SUCCESS });
            }
            this.updateProgress();
            if (this.tokenQueue.length() === 0 && !tokensResolved && !fetchTokens) {
                return true;
            }
            await this.searchLoop();
        };

        handleSearch = async (input: string) => {
            // eslint-disable-next-line react/destructuring-assignment
            if (this.state.isSearching || input.length === 0) {
                this.stop();
                return;
            }
            this.clear();
            this.setState({ isSearching: true });
            this.setState({ statusMessage: 'Searching...', servers: [] });
            if (!placeId) return;
            let userId: number | string = parseInt(input, 10);
            if (Number.isNaN(userId)) {
                userId = await getUserId(input);
            }
            if (!userId) {
                this.notFound();
                return;
            }
            this.loadedToken = undefined;
            const token = await getTokenFromStorage(userId.toString());
            if (token && typeof token === 'string') {
                this.loadedToken = token;
            }

            const thumbnail = await getThumbnail(userId.toString());
            if (!thumbnail) {
                this.notFound();
                return;
            }
            this.setState({
                currentPlayerInfo: {
                    id: userId.toString(),
                    name: input,
                    thumbnail,
                },
            });

            // eslint-disable-next-line react/destructuring-assignment
            await this.searchLoop();
            // eslint-disable-next-line react/destructuring-assignment
            if (!this.state.isSearching) {
                this.cancel(
                    this.foundPlayer() ? COLORS.SUCCESS : COLORS.NEUTRAL,
                    'Search Cancelled!'
                );
                this.stop();
                return;
            }
            {
                const foundPlayer = this.foundPlayer();
                if (!foundPlayer) {
                    // retry all known cursors
                    const promises = this.cursors.map((cursor) =>
                        this.fetchTokens(cursor)
                    );
                    await Promise.all(promises);
                    console.log("currentqueue", this.tokenQueue.length());

                }
            }
            const foundPlayer = this.foundPlayer();
            if (foundPlayer) {
                this.cancel(COLORS.SUCCESS, 'Player found!');
            } else {
                this.cancel(COLORS.ERROR, 'Player not found!');
            }
            this.stop();
        };

        render() {
            const {
                servers,
                statusMessage,
                currentColor,
                progress,
                maxPlayers,
                isSearching,
                currentPlayerInfo,
            } = this.state;
            return (
                <MainComponent
                    placeId={placeId}
                    statusMessage={statusMessage}
                    handleSearch={this.handleSearch}
                    servers={servers}
                    isSearching={isSearching}
                    currentPlayerInfo={currentPlayerInfo}
                    maxPlayers={maxPlayers}
                    progress={progress}
                    currentColor={currentColor}
                />
            );
        }
    }
    const mount = async () => {
        const container = await waitForElm({
            selector: '#running-game-instances-container',
        });
        if (container instanceof HTMLElement) {
            const newElement = document.createElement('div');
            newElement.id = 'rosearcher';
            newElement.className = 'stack';
            container.prepend(newElement);
            const root = createRoot(newElement);
            root.render(<Search />);
        }
    };
    mount();
})();
