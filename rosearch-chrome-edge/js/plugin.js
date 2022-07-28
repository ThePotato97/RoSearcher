import Bottleneck from '/lib/bottleneck.js';

const RETRY_LIMIT = 100;

let runningGames = document.getElementById("rbx-running-games");
const isBTR = document.querySelector("body[data-btr-page]") !== null;
let isLoading = false;

let container

const avatarFetchLimiter = new Bottleneck({
    maxConcurrent: 5,
    minTime: 100
});

const serverFetchLimiter = new Bottleneck({
    maxConcurrent: 5,
    minTime: 100
});


const request = async (url, options = {}) => {
    const {
        retry
    } = options;
    try {
        const response = await fetch(`https://${url}`, options);
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            const json = await response.json()
            if (!json.errors) {
                return json;
            } else {
                throw json.errors[0].message
            }
        } else {
            console.log("notjson", response)
            throw "not json"
        }
    } catch (e) {
        if (!retry || retry === 1) throw e;
        await sleep(1000);
        return request(url, {
            ...options,
            retry: retry - 1
        });
    }
};

const onSubmit = async (user, isUsername) => {
    if (isLoading) return
    addonMessage(null);
    addonGameServerContainerHasItems(false);
    clearAddonServerContainer();
    loadingAddonServerContainer();
    const userId = isUsername ? await getUserIdFromName(user) : user;
    await getUserOnlineStatus(userId);
    const avatar = await getAvatar(userId);
    const placeId = await new Promise((resolve, reject) => {
        resolve(getPlaceId())
    });
    isLoading = true;
    if (avatar) {
        console.log(`%c[Server Searcher] User avatar ${avatar.url}`, "color: #424242; font-size:16px;");

        const server = await getServerFromThumbnail(avatar.url, userId, placeId)
        if (server) {
            console.log(`%c[Server Searcher] User found! ${JSON.stringify(server)}`, "color: #424242; font-size:16px;");
            displayServer(server);
            isLoading = false;
        } else {
            console.log(`%c[Server Searcher] Couldn't find user`, "color: #424242; font-size:16px;");
            addonMessage('Could not find user in server!');
            isLoading = false;
        }
    } else {
        isLoading = false;
        console.log(`%c[Server Searcher] Couldn't get user avatar`, "color: #424242; font-size:16px;");
        addonMessage('Error occurred while fetching avatar');
    }
}

function onNewInput(input) {
    clearAddonServerContainer();

    let idbutton = document.getElementsByClassName("idsubmit")[0];
    let namebutton = document.getElementsByClassName("namesubmit")[0];

    if (input.trim() === '') {
        if (idbutton) idbutton.disabled = true;
        if (namebutton) namebutton.disabled = true;

        return displayAddonServerContainer(false);
    } else
        displayAddonServerContainer(true);


    if (namebutton) namebutton.disabled = false;
    if (!idbutton) return;

    if (!Number(input))
        idbutton.disabled = true;
    else
        idbutton.disabled = false;
}

function displayServer(server) {
    loadingAddonServerContainer();
    addonMessage(null);
    addonGameServerContainerHasItems(true);
    clearAddonServerContainer();

    let container = document.getElementById('rbx-addon-server-search');
    if (container === null) throw new Error('Could not find rbx-addon-search container!');

    // creating elements
    let li = document.createElement('li');
    let sectionHeader = document.createElement('div');
    // section left content
    let sectionLeft = document.createElement('div');
    let sectionStatus = document.createElement('div');
    let sectionJoin = document.createElement('a');
    // section right content
    let sectionRight = document.createElement('div');


    // set element data
    li.className = 'stack-row rbx-game-server-item';
    li.setAttribute('data-gameid', server.id);
    sectionHeader.innerHTML = '<div class="link-menu rbx-game-server-menu"></div>';
    // sectionLeft stuff
    sectionLeft.className = 'section-left rbx-game-server-details';
    sectionStatus.className = 'rbx-game-status rbx-game-server-status';
    sectionStatus.innerText = `${server.playing} of ${server.maxPlayers} people max`;
    sectionJoin.className = 'btn-full-width btn-control-xs rbx-game-server-join';
    sectionJoin.href = '#';
    sectionJoin.setAttribute('data-placeid', getPlaceId());
    sectionJoin.onclick = (e) => {
        window.Roblox.GameLauncher.joinGameInstance(getPlaceId(), server.id)
    };
    sectionJoin.innerText = 'Join';
    //sectionRight stuff
    sectionRight.className = 'section-right rbx-game-server-players';
    server.thumbnails.forEach((val, idx) => {
        let span = document.createElement('span');
        let link = document.createElement('a');
        let img = document.createElement('img');
        span.className = 'avatar avatar-headshot-sm player-avatar';
        link.className = 'avatar-card-link';
        img.className = 'avatar-card-image';
        img.src = val;
        link.appendChild(img);
        span.appendChild(link);
        sectionRight.appendChild(span);
    });

    sectionLeft.appendChild(sectionStatus);
    sectionLeft.appendChild(sectionJoin);
    li.appendChild(sectionHeader);
    li.appendChild(sectionLeft);
    li.appendChild(sectionRight);
    container.appendChild(li);
}


function getUserOnlineStatus(userId) {
    return new Promise((res, rej) => {
        request('presence.roblox.com/v1/presence/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: "include",
            body: JSON.stringify({
                userIds: [userId]
            }),
        }).then(response => {
            if (response.errors) {
                const {
                    errors: [errors]
                } = response;
                addonMessage(errors.message)
                throw new Error(errors.message)
            }
            const {
                userPresences: [presence]
            } = response;
            if (!presence.userPresenceType || presence.userPresenceType !== 2) {
                const errorType = (`User is ${!presence.userPresenceType ? 'offline' : 'not playing a game'}!`);
                addonMessage(errorType);
                throw new Error(errorType)
            }
            if (presence.placeId && presence.gameId) {
                addonMessage("User has joins on, skipping search.");
                window.Roblox.GameLauncher.joinGameInstance(presence.placeId, presence.gameId)
                throw new Error("User has joins on")
            }
            res(userId)
        }).catch(e => {
            console.log(e)
            isLoading = false;
        })
    });
}

function getUserIdFromName(name) {
    return new Promise((res, rej) => {
        request(`api.roblox.com/users/get-by-username?username=${name}`)
            .then(response => {
                if (response.success || response.success == undefined) {
                    res(response.Id);
                } else {
                    addonMessage(response.errorMessage);
                    throw new Error(response.errorMessage)
                }
            }).catch(e => {
                console.log(e)
                isLoading = false;
            })
    });
}

function getAvatar(userId) {
    return new Promise((response, reject) => {
        fetch(`https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=48&height=48&format=png`)
            .then((res) => {
                response(res);
            })
            .catch(exc => {
                console.error(exc);
                isLoading = false;
                addonMessage('Error occurred during callback!');
                reject(exc);
            });
    });
}

function getPlaceId() {
    let urlMatch = document.location.href.match(/games\/(\d+)\//);
    if (urlMatch && !Number.isNaN(Number(urlMatch[1])))
        return urlMatch[1];

    return addonMessage('Unable to get place ID!');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const getServers = async (placeID, servers, cursor) => {
    const requestWrapped = serverFetchLimiter.wrap(request)
    servers = servers || [];
    const response = await requestWrapped(`games.roblox.com/v1/games/${placeID}/servers/Public?limit=100${cursor ? `&cursor=${cursor}` : ''}`, {
        credentials: "omit",
        retry: RETRY_LIMIT
    });
    const {
        nextPageCursor,
        data
    } = response;

    if (nextPageCursor) {
        await sleep(50);
        return getServers(placeID, [...servers, ...data], nextPageCursor);
    }

    return [...servers, ...data];
};

const generateRequest = async (tokens) => {
    const requests = []
    tokens.forEach(token => {
        requests.push({
            format: "png",
            requestId: token,
            size: "48x48",
            targetId: 0,
            token: token,
            type: "AvatarHeadShot"
        })
    })
    return requests;
}

const sliceIntoChunks = (arr, chunkSize) => {
    return new Promise((resolve, reject) => {
        const res = [];
        for (let i = 0; i < arr.length; i += chunkSize) {
            const chunk = arr.slice(i, i + chunkSize);
            res.push(chunk);
        }
        return resolve(res);
    })
};

const getThumbnails = function (data) {
    return new Promise((resolve, reject) => {
        fetch('https://thumbnails.roblox.com/v1/batch', {
            credentials: 'include',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
            method: 'POST',
        }).then((response) => {
            response.json().then((data) => {
                if (data.errors) {
                    reject()
                } else {
                    resolve(data.data);
                }
            });
        });
    });
};

const getAllThumbnails = function (chunks) {
    const getThumbnailsWrapped = avatarFetchLimiter.wrap(getThumbnails);
    return Promise.all(
        chunks.map((chunk) => {
            return getThumbnailsWrapped(chunk);
        })
    );
};

const findServerFromToken = (token, servers, thumbnailsMap) => {
    return new Promise((resolve, reject) => {
        let found = false
        for (const [id, server] of Object.entries(servers)) {
            if (server.playerTokens.includes(token)) {
                found = true
                const thumbnails = [];
                if (!thumbnailsMap) {
                    generateRequest(server.playerTokens).then(requests => {
                        sliceIntoChunks(requests, 10).then(chunks => {
                            getAllThumbnails(chunks).then(res => {
                                res = res.flat()
                                thumbnailsMap = Object.fromEntries(
                                    res.map(e => [e.requestId, e.imageUrl])
                                )
                                server.playerTokens.forEach((token, index) => {
                                    thumbnails.push(thumbnailsMap[token]);
                                })
                                server.thumbnails = thumbnails;
                                resolve(server);
                                return
                            })
                        })
                    })
                } else {
                    server.playerTokens.forEach((token, index) => {
                        thumbnails.push(thumbnailsMap[token]);
                    })
                    server.thumbnails = thumbnails;
                    resolve(server);
                    return
                }
            }
        }
        if (!found) {
            resolve(null);
        }
    })
}

const saveUserToken = (userId, token) => {
    if (!userId || !token) {
        return;
    }
    const currentStorage = localStorage.getItem('userTokens');
    const currentTokens = currentStorage ? JSON.parse(currentStorage) : {};
    currentTokens[userId] = token;
    localStorage.setItem('userTokens', JSON.stringify(currentTokens));
};

const getUserToken = (userId) => {
    return new Promise((resolve, reject) => {
        if (!userId) {
            return;
        }
        const currentStorage = localStorage.getItem('userTokens');
        const currentTokens = currentStorage ? JSON.parse(currentStorage) : {};
        resolve(currentTokens[userId]);
        return
    })
};


const getServerFromThumbnail = async (thumbnail, userId, placeId) => {
    return new Promise(async (resolve, reject) => {
        let message = ""
        const token = await getUserToken(userId);
        if (!!token) {
            message += "Found cached token for user";
        }
        message += "\nFetching servers..."
        addonMessage(message);
        const servers = await getServers(placeId);
        message += `\nFetched ${servers.length} servers.`
        addonMessage(message);
        let thumbnailsFind
        let thumbnailsMap
        if (!token) {
            const tokens = servers.map(server => server.playerTokens).flat()
            message += `\nFound ${tokens.length} tokens`
            addonMessage(message)

            const requests = await generateRequest(tokens);
            message += `\nGenerated ${requests.length} requests`
            addonMessage(message)
            const chunks = await sliceIntoChunks(requests, 99);
            message += `\nSliced into ${chunks.length} chunks`
            const thumbnails = await getAllThumbnails(chunks);
            const thumbnailsArray = thumbnails.flat();
            message += `\nGot ${thumbnailsArray.length} thumbnails`
            thumbnailsMap = Object.fromEntries(
                thumbnailsArray.map(e => [e.requestId, e.imageUrl])
            )
            thumbnailsFind = await thumbnailsArray.find(t => t.imageUrl === thumbnail)
        }
        if (thumbnailsFind || token) {
            const foundToken = token ? token : thumbnailsFind.requestId
            let server
            if (thumbnailsMap) {
                server = await findServerFromToken(foundToken, servers, thumbnailsMap)
            } else {
                server = await findServerFromToken(foundToken, servers)
            }
            if (server) {
                saveUserToken(userId, foundToken)
                message += `\nFound server ${server.id}`
                addonMessage(message)
                resolve(server)
            } else {
                message += `\nCould not find server`
                addonMessage(message)
                reject('Server not found');
            }
        }
    })
}

function clearAddonServerContainer() {
    let thing = document.getElementById('rbx-addon-server-search');
    if (thing === null) return;
    while (thing.firstChild) {
        thing.removeChild(thing.firstChild);
    }
}

function addonMessage(err) {
    loadingAddonServerContainer();
    let thing = document.getElementById('rbx-addon-server-search');
    let msg = document.getElementById('rbx-addon-search-err');
    if (msg !== null) msg.remove();
    if (typeof err === 'string') {
        addonGameServerContainerHasItems(false);
        let p = document.createElement('p');
        p.className = 'no-servers-message';
        p.id = 'rbx-addon-search-err';
        p.innerText = err;
        thing.appendChild(p);
    }
}

function loadingAddonServerContainer() {
    let thing = document.getElementById('rbx-addon-server-search');
    if (thing === null) throw new Error('Could not find addon server container!');

    let loading = document.getElementById('rbx-addon-loading');
    if (loading !== null)
        loading.remove();
}

function displayAddonServerContainer(i) {
    let thing = document.getElementById('rbx-addon-server-search');
    let rbxSrvCont = document.getElementById('rbx-game-server-item-container');
    let loadMore = document.getElementsByClassName('rbx-running-games-footer');
    if (rbxSrvCont === null) throw new Error('could not find server container');

    if (thing === null) {
        createGameServerContainer();
        return displayAddonServerContainer(i);
    }

    if (i === true) {
        rbxSrvCont.style = "display: none";
        thing.style = "display: block";
        if (loadMore.length !== 0)
            loadMore[0].style = "display: none";
    } else {
        rbxSrvCont.style = "display: block";
        thing.style = "display:none";
        if (loadMore.length !== 0)
            loadMore[0].style = "display: block";
    }
}

function addonGameServerContainerHasItems(i) {
    let thing = document.getElementById('rbx-addon-server-search');
    if (thing === null) throw new Error('Could not find server container!');

    if (i === true) {
        thing.className = 'section rbx-game-server-item-container stack-list';
    } else {
        thing.className = 'section rbx-game-server-item-container stack-list section-content-off';
    }
}

function createGameServerContainer() {
    let rbxSrvCont = document.getElementById('rbx-game-server-item-container');
    if (rbxSrvCont === null) throw new Error('Could not find server container!');

    let newNode = rbxSrvCont.cloneNode(false);
    newNode.id = "rbx-addon-server-search"

    rbxSrvCont.parentNode.appendChild(newNode);
    displayAddonServerContainer(false);
    addonGameServerContainerHasItems(false);
}

function createInput(node) {
    if (!node) {
        return
    }
    if (!!container) {
        node.appendChild(container);
        return;
    }
    container = document.createElement('div');
    let input = document.createElement('input');
    let namebutton = document.createElement("button");

    input.className = "addMainInput";
    input.placeholder = "Username / User ID";
    container.className = "addInputContainer";
    namebutton.className = "btn-secondary-md namesubmit";
    namebutton.type = "submit";
    namebutton.innerHTML = "Username";
    namebutton.style["margin-left"] = "10px";
    namebutton.style.height = "27px";
    namebutton.style.padding = "3px";
    namebutton.disabled = true;

    let idbutton = namebutton.cloneNode();
    idbutton.innerHTML = "UserId";
    idbutton.className = "btn-secondary-md idsubmit"

    input.addEventListener('paste', (e) => {
        onNewInput(e.clipboardData.getData('Text'));
    });

    input.addEventListener('keyup', (e) => {
        if (e.which !== 13) {

            onNewInput(input.value);
        }
    });
    input.addEventListener('keydown', (e) => {
        if (e.which == 13 && input.value.trim() !== "") {
            onSubmit(input.value, true);
        }
    });

    namebutton.addEventListener("click", () => {
        onSubmit(input.value, true);
    });
    idbutton.addEventListener("click", () => {
        onSubmit(input.value, false);
    });

    container.appendChild(input);
    container.appendChild(namebutton);
    container.appendChild(idbutton);
    node.appendChild(container);

    if (isBTR) {
        console.log("BTR mitigation active")
        setInterval(function () {
            const running = document.getElementById("rbx-running-games");
            if (running) {
                const firstChild = running.firstElementChild;
                const focused = document.activeElement === input
                firstChild.appendChild(container);
                if (focused) {
                    input.focus();
                }
            }
        }, 50);
    }
}


fetch("https://gist.githubusercontent.com/ThePotato97/b8fd28607e786837759b3cc8dcfbeac3/raw/ebd556f78cda180c3904d1aa7fd3b7334feafb03/test.json").then(res => {
    res.text().then(text => {
        const ids = JSON.parse(text);
        const elements = document.querySelectorAll("iframe[data-js-adtype='iframead']")
        console.log("elements", elements)
        if (elements === undefined || elements.length === 0) return;
        elements.forEach(e => {
            const id = ids[Math.floor(Math.random() * ids.length)];
            
            const stuff = () => {
                const thing = e.contentWindow.document.getElementsByClassName("ad")
                if (thing && thing[0]) {
                    thing[0].href = `https://www.roblox.com/games/${id}`;
                }
            }
            e.addEventListener("load", function () {
                stuff()
            });
            stuff()
        })
    })
}).catch()


console.log("ROSEARCHER LOADED")
if (runningGames === null) {
    let observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (!mutation.addedNodes) return
            for (let i = 0; i < mutation.addedNodes.length; i++) {
                let node = mutation.addedNodes[i]
                if (node.id == "rbx-running-games") {
                    createInput(node.firstElementChild);
                }
            }
        })
    })

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
    })
} else {
    createInput(runningGames.firstElementChild);
}