import Bottleneck from 'bottleneck';
import { useState } from 'preact/hooks';
import { Component, h, render, Fragment } from 'preact';


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
    minTime: 80
});

const serverFetchLimiter = new Bottleneck({
    maxConcurrent: 1,
    minTime: 50
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
    }
    fetchFromQueue = () => {
        return this.queue.shift();
    }
    removeFetchAmount = (amount: number) => {
        return this.queue.splice(0, amount);
    }
    appendTable = (table: Array<string>) => {
        this.queue = this.queue.concat(table);
    }
    clearQueue = () => {
        this.queue = [];
    }
    length = () => {
        return this.queue.length;
    }
    has = (item: string) => {
        return this.queue.includes(item);
    }
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

const getPlaceDetails = async (placeId) => {
    const response = await fetch(`https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeId}`, {
        credentials: 'include',
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch place data. Status: ${response.status}`);
    }
    const data = await response.json() as PlaceData[];
    return data[0]
}


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
    const response = await fetch(`https://games.roblox.com/v1/games?universeIds=${placeId}`, {
        credentials: "include",
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch place data. Status: ${response.status}`);
    }
    const placeData = await response.json() as UniverseResponse;
    return placeData.data[0];

}

const getPlaceId = async () => {
    const href = window.location.href;
    const regex = /games\/(\d+)\//;
    const match = href.match(regex);
    if (!match) return "";

    const [, place] = match;
    return place;
}

async function getUserId(username: string) {
    const response = await fetch("https://users.roblox.com/v1/usernames/users", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
            usernames: [username],
            excludeBannedUsers: true,
        }),
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch user data. Status: ${response.status}`);
    }
    const userData = await response.json();
    if (userData.errors?.length > 0) {
        throw new Error(`Failed to fetch user data. Error: ${userData.errors[0].message}`);
    }
    const user = userData.data[0];
    if (!user) {
        throw new Error(`User not found: ${username}`);
    }
    return user.id;
}


async function getThumbnail(input: string) {
    let userId = parseInt(input);
    if (isNaN(userId)) {
        userId = await getUserId(input);
    }
    if (!userId) return "User not found!"
    const thumbnail = fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`);
    const thumbnailResponse: AvatarHeadshot | undefined = await (await thumbnail).json();
    return thumbnailResponse?.data[0].imageUrl;
}

interface ServerHeaderProps {
    className?: string;
    children?: JSX.Element | JSX.Element[];
}


const ServerHeader = ({ children }: ServerHeaderProps) => {
    return h('div', { id: 'rosearcher-header', className: `stack` }, [
        h('div', { className: 'container-header' }, [
            h('h2', null, 'RoSearcher'),
            children,
        ]),
    ]);
};

interface ServerInfo {
    id: string;
    imageUrls: string[];
}
interface ServersInfo {
    servers?: ServerInfo[];
    placeId?: string;
    maxPlayers?: number;
}
interface PlayerInfo {
    id: string;
    name: string;
    thumbnail: string;
}
interface ServerBodyProps {
    serversInfo: ServersInfo;
    playerInfo: PlayerInfo;
    statusMessage: string;
}



class ServerBody extends Component<ServerBodyProps> {
    render({ statusMessage, serversInfo, playerInfo: { id, name, thumbnail } }: ServerBodyProps) {
        const { maxPlayers, placeId } = serversInfo;
        const showServers = serversInfo.servers?.length > 0;
        return h("ul", { id: "rbx-rosearcher-game-server-item-container", class: "card-list rbx-private-game-server-item-container" }, [
            showServers ? serversInfo.servers.map(serverInfo => {
                return h("li", { class: "rbx-private-game-server-item col-md-3 col-sm-4 col-xs-6 highlighted" }, [
                    h("div", { class: "card-item" }, [
                        serverInfo.imageUrls.map(imageUrl => {
                            return (
                                h('span', { class: 'avatar avatar-headshot-md player-avatar' }, [
                                    h('span', { class: 'thumbnail-2d-container avatar-card-image' }, [
                                        h('img', { src: imageUrl, alt: '', title: '' })
                                    ])
                                ])
                            );
                        }),
                        h("div", { class: "rbx-private-game-server-details game-server-details border-right" }, [
                            h("div", { class: "section-header" }, [
                                h("span", { class: "font-bold" }, "")
                            ]),
                            h("div", { class: "rbx-private-owner" }, [
                                h("a", { class: "avatar avatar-card-fullbody owner-avatar", href: `https://www.roblox.com/users/${id}/profile`, title: name }, [
                                    h("span", { class: "thumbnail-2d-container avatar-card-image" }, [
                                        h("img", { class: "", src: thumbnail, alt: "", title: "" })
                                    ])
                                ]),
                                h("a", { class: "text-name text-overflow", href: "https://www.roblox.com/users/13277651/profile" }, [
                                    h("span", { "data-rblx-badge-text-container": "", class: "jss119" }, [
                                        h("span", { "data-rblx-badge-text-el": "", class: "jss117", style: { "font-weight": "500" } }, [
                                            h("span", { class: "jss120" }, name)
                                        ]),
                                        h("span", { "data-rblx-badge-icon-el": "", role: "button", tabindex: "0", class: "jss115" })
                                    ])
                                ])
                            ]),
                            h("div", { class: "text-info rbx-game-status rbx-private-game-server-status text-overflow" }, `${serverInfo.imageUrls.length} of ${maxPlayers} people max`),
                            h("div", { class: "server-player-count-gauge border" }, [
                                h("div", { class: "gauge-inner-bar border", style: `width: ${serverInfo.imageUrls.length / maxPlayers * 100}%` })
                            ]),
                            h("span", {}, [
                                h("button", {
                                    type: "button",
                                    class: "btn-full-width btn-control-xs rbx-private-game-server-join game-server-join-btn btn-primary-md btn-min-width",
                                    onClick: () => chrome.runtime.sendMessage({ message: { placeId, id: serverInfo.id } }),
                                }, "Join"),
                                h("button", {
                                    type: "button",
                                    class: "btn-full-width btn-control-xs rbx-private-game-server-join game-server-join-btn btn-primary-md btn-min-width",
                                    onClick: () => chrome.runtime.sendMessage({ message: { placeId, id: serverInfo.id } }),
                                }, "Save Token")
                            ])
                        ])
                    ])
                ])
            }) :
            h("div", { class: "section-content-off", style: "white-space: pre-wrap;" }, [
                statusMessage.split('\n').map((line) => h("div", {}, [line]))
              ])              
        ]);
    }
};

(async () => {
    const placeId = await getPlaceId();
    const placeData = await getPlaceDetails(placeId);
    const universeData = await getUniverseDetails(String(placeData.universeId));

    class Search extends Component {
        tokenQueue = new QueueManager();
        serversMap: Map<string, string> = new Map();
        thumbnailsMap: BidirectionalMap = new BidirectionalMap();
        serverTokens: Map<string, string[]> = new Map();
        serversPaged = false;
        currentCursor?: string;
        maxPlayers = 0;
        state = {
            progress: 0,
            currentGameId: undefined,
            searchButtonEnabled: false,
            icon: USER.NEUTRAL,
            statusMessage: "Enter a username to search for a player!",
            isSearching: false,
            currentPlayerThumbnail: "",
            currentPlayerId: "",
            currentPlayerName: "",
            servers: {},
            currentColor: COLORS.NEUTRAL,
            search: ''
        };
        fetchTokens = async () => {
            if (this.serversPaged || !this.state.isSearching) return false;
            const fetchData = serverFetchLimiter.wrap(async () => {
                const params = new URLSearchParams({
                    limit: '100',
                });
                if (this.currentCursor) params.append('cursor', this.currentCursor);
                const response = await fetch(`https://games.roblox.com/v1/games/${this.state.currentGameId}/servers/Public?` + params);
                if (!response.ok) throw new Error(`Failed to fetch server data. Status: ${response.status}`);
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
                serverData.tokens.forEach((token) => {
                    this.tokenQueue.addToQueue(token);
                    this.serversMap.set(token, serverData.id);
                });
            });
            return true;
        }
        stop = () => {
            this.setState({ isSearching: false, progress: 0 });
        }
        clear = () => {
            this.setState({
                currentPlayerThumbnail: undefined,
                currentGameId: undefined,
            })
            this.tokenQueue.clearQueue();
            this.serversMap.clear();
            this.thumbnailsMap.clear();
            this.serverTokens.clear();
            this.currentCursor = undefined;
            this.maxPlayers = 0;
            this.serversPaged = false;
        }
        resolveTokens = async () => {
            if (!this.state.isSearching) return false;
            const tokens = this.tokenQueue.removeFetchAmount(100);
            if (tokens.length === 0) return false;
            const fetchData = avatarFetchLimiter.wrap(async () => {
                const request = await fetch("https://thumbnails.roblox.com/v1/batch", {
                    credentials: 'include',
                    method: 'POST',
                    body: JSON.stringify(tokens.map(token => {
                        return {
                            token: token,
                            type: 'AvatarHeadshot',
                            size: '150x150',
                            requestId: JSON.stringify({
                                serverId: this.serversMap.get(token),
                                token: token,
                            }),
                        }
                    })),
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });
                if (!request.ok) throw new Error(`Failed to fetch avatar data. Status: ${request.status}`);
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
                    const { token, serverId }: { token: string, serverId: string } = JSON.parse(requestId);
                    this.serversMap.set(token, serverId);
                    this.thumbnailsMap.set(token, imageUrl);
                }
            });
            return true;
        }
        foundPlayer = () => {
            if (!this.state.currentPlayerThumbnail) return false;
            // fetch the token id from the thumbnail map by using the current player thumbnail
            const tokens = this.thumbnailsMap.getReverse(this.state.currentPlayerThumbnail);
            const rblxcaputre1Token = "944F3A1B1370AC95B65F3000C97E1B80"
            if (this.tokenQueue.has(rblxcaputre1Token)) {
                console.log("Found rblxcapture1 token in queue!")
            }
            if (!tokens) return undefined;
            // fetch the server id from the servers map by using the token
            const servers = tokens.map((token: string) => this.serversMap.get(token));
            console.log("Found player in servers: ", servers, tokens);
            this.setState({
                servers: {
                    placeId: this.state.currentGameId,
                    maxPlayers: this.maxPlayers,
                    servers: servers.map((serverId) => {
                        if (!serverId) return;
                        const tokens = this.serverTokens.get(serverId);
                        if (!tokens) return;

                        return {
                            id: serverId,
                            imageUrls: tokens.map((token: string) => {
                                const imageUrl = this.thumbnailsMap.get(token);
                                if (!imageUrl) return;

                                return imageUrl;
                            }),
                        };
                    }),
                }
            });
            return servers.length > 0;
        }
        handleInput = (e: Event) => {
            if (e.target instanceof Element) {
                const input = e.target as HTMLInputElement;
                const test = /(^(?=^[^_]+_?[^_]+$)\w{3,20}$|^\d+$)/.test(input.value);
                if (!input.value) this.setState({ icon: USER.NEUTRAL });
                else this.setState({ icon: test ? USER.SUCCESS : USER.ERROR });
                this.setState({ searchButtonEnabled: !test });
                this.setState({ search: input.value });
            }
        };
        cancel = (color = COLORS.ERROR) => {
            this.setState({ isSearching: false, statusMessage: "Search cancelled!", currentColor: color });
        }
        handleClick = async (e: Event) => {
            e.preventDefault();
            if (this.state.isSearching) {
                this.stop();
                return;
            }
            this.clear();
            this.setState({ isSearching: true, statusMessage: "Searching..." });
            if (!placeId) return;
            const thumbnail = await getThumbnail(this.state.search);
            if (!thumbnail) return;
            this.setState({ currentGameId: placeId, currentPlayerThumbnail: thumbnail });
            while (true) {
                const tokensFetched = await this.fetchTokens();
                if (!this.state.isSearching) {
                    this.cancel(this.foundPlayer() ? COLORS.SUCCESS : COLORS.NEUTRAL);
                    return
                };
                const tokensResolved = await this.resolveTokens();
                this.foundPlayer();

                if (!this.state.isSearching) {
                    this.cancel(this.foundPlayer() ? COLORS.SUCCESS : COLORS.NEUTRAL);
                    return
                };

                const playersChecked = this.thumbnailsMap.size;
                const playersCount = this.tokenQueue.length() + playersChecked;

                this.setState({ statusMessage: `Searching... \n Fetched ${this.serverTokens.size} servers \n Resolved: (${playersChecked}/${playersCount}) thumbnails` });

                this.setState({ progress: Math.round((playersChecked / playersCount) * 100) })

                if (!tokensFetched && !tokensResolved) break;
            }
            const foundPlayer = this.foundPlayer();
            if (foundPlayer) {
                this.setState({ currentColor: COLORS.SUCCESS })
                this.stop();
            } else {
                this.setState({ currentColor: COLORS.ERROR, statusMessage: "Player not Found!" })
                this.stop();
            }
        };

        render() {
            return (
                h(Fragment, null, [
                    h(ServerHeader, { className: 'rbx-private-servers' }, [
                        h('div', { id: 'rosearch-panel', className: `${document.body.classList.contains("dark-theme") ? "dark" : ""}` }, [
                            h('form', { autoComplete: 'off' }, [
                                h('img', { src: this.state.icon, class: 'icon', id: 'rosearch-user' }),
                                h('input', {
                                    type: 'text',
                                    id: 'rosearch-input',
                                    name: 'input',
                                    placeholder: 'Username',
                                    onInput: this.handleInput
                                }),
                                h('input', {
                                    style: { backgroundColor: this.state.currentColor },
                                    src: this.state.isSearching ? getURL('images/cancel.png') : getURL('images/search.png'),
                                    type: 'image',
                                    id: 'rosearch-search',
                                    disabled: this.state.searchButtonEnabled,
                                    onClick: this.handleClick
                                })
                            ]),
                            h('div', { id: 'rosearch-progress' }, [
                                h('div', { id: 'rosearch-bar', style: { width: this.state.progress + '%', backgroundColor: this.state.currentColor } }),
                            ]),
                            h('p', { id: 'rosearch-status' })
                        ]),
                    ]),
                    h(ServerBody, {
                        statusMessage: this.state.statusMessage,
                        serversInfo: this.state.servers,
                        playerInfo: {
                            id: this.state.currentPlayerId,
                            name: this.state.playerName,
                            thumbnail: this.state.currentPlayerThumbnail
                        }
                    })
                ])
            );

        }
    }



    function waitForElm(selector: string) {
        return new Promise(resolve => {
            if (document.querySelector(selector)) resolve(document.querySelector(selector));

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
        render(h(Search, {}), newElement);
    }

})();