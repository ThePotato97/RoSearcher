const REQUEST_LIMIT = 40;
const RETRY_LIMIT = 100;

let runningGames = document.getElementById("rbx-running-games");
let currentInput = "";
let isLoading = false;

function getCurrentUser() {
    let element = document.getElementsByName("user-data")[0];
    if (element) {
        return [element.getAttribute("data-userid"), element.getAttribute("data-name").toLowerCase()];
    }

    return [];
}


const request = async(url, options = {}) => {
    const { retry } = options;
    try {
        const response = await fetch(`https://${url}`, options);
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return await response.json()
        } else {
            throw new Error("not json")
        }
    } catch (e) {
        if (!retry || retry === 1) throw e;
        return request(url, {...options, retry: retry - 1 });
    }
};

const onSubmit = async(user, isUsername) => {
    if (isLoading) return
    addonError(null);
    addonGameServerContainerHasItems(false);
    clearAddonServerContainer();
    loadingAddonServerContainer(true);
    let cb = (r) => {
        if (r.ok) {
            const placeId = getPlaceId();
            request(`www.roblox.com/games/getgameinstancesjson?placeId=${placeId}&startIndex=999999999`).then((response) => {
                const { TotalCollectionSize: total } = response
                console.log(`%c[Server Searcher] User avatar ${r.url}`, "color: #424242; font-size:16px;");
                findServer(user, r.url, placeId, total, 0).then((server) => {
                    isLoading = false;

                    if (!server.error) {
                        console.log(`%c[Server Searcher] User found! ${JSON.stringify(server)}`, "color: #424242; font-size:16px;");
                        displayServer(server)
                    } else {
                        console.log(`%c[Server Searcher] Couldn't find user`, "color: #424242; font-size:16px;");
                        addonError('Could not find user in server!');
                    }
                })
            })
        } else {
            isLoading = false;
            console.log(`%c[Server Searcher] Couldn't get user avatar`, "color: #424242; font-size:16px;");
            addonError('Could not find user!');
        }
    }

    isLoading = true;

    if (isUsername) {
        getUserIdFromName(user).then(id => {
            getUserOnlineStatus(id).then(_ => {
                getAvatar(id, cb)
            })
        }).catch(e => {
            isLoading = false;
            addonError('Error occurred while fetching avatar');
        });
    } else {
        getUserOnlineStatus(user).then(_ => {
            getAvatar(user, cb)
        })
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
    loadingAddonServerContainer(false);
    addonError(null);
    addonGameServerContainerHasItems(true);
    clearAddonServerContainer();

    var container = document.getElementById('rbx-addon-server-search');
    if (container === null) throw new Error('Could not find rbx-addon-search container!');

    // creating elements
    var li = document.createElement('li');
    var sectionHeader = document.createElement('div');
    // section left content
    var sectionLeft = document.createElement('div');
    var sectionStatus = document.createElement('div');
    var sectionJoin = document.createElement('a');
    // section right content
    var sectionRight = document.createElement('div');


    // set element data
    li.className = 'stack-row rbx-game-server-item';
    li.setAttribute('data-gameid', server.guid);
    sectionHeader.innerHTML = '<div class="link-menu rbx-game-server-menu"></div>';
    // sectionLeft stuff
    sectionLeft.className = 'section-left rbx-game-server-details';
    sectionStatus.className = 'rbx-game-status rbx-game-server-status';
    sectionStatus.innerText = server.PlayersCapacity;
    sectionJoin.className = 'btn-full-width btn-control-xs rbx-game-server-join';
    sectionJoin.href = '#';
    sectionJoin.setAttribute('data-placeid', getPlaceId());
    sectionJoin.onclick = (e) => {
        window.Roblox.GameLauncher.joinGameInstance(server.PlaceId, server.Guid)
    };
    sectionJoin.innerText = 'Join';
    //sectionRight stuff
    sectionRight.className = 'section-right rbx-game-server-players';
    server.CurrentPlayers.forEach((val, idx) => {
        var span = document.createElement('span');
        var link = document.createElement('a');
        var img = document.createElement('img');
        span.className = 'avatar avatar-headshot-sm player-avatar';
        link.className = 'avatar-card-link';
        img.className = 'avatar-card-image';
        img.src = val.Thumbnail.Url;
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
            body: JSON.stringify({ userIds: [userId] }),
        }).then(response => {
            if (response.errors) {
                const { errors: [errors] } = response;
                addonError(errors.message)
                throw new Error(errors.message)
            }
            const { userPresences: [presence] } = response;
            if (!presence.userPresenceType || presence.userPresenceType !== 2) {
                const errorType = (`User is ${!presence.userPresenceType ? 'offline' : 'not playing a game'}!`);
                addonError(errorType);
                throw new Error(errorType)
            }
            if (presence.placeId && presence.gameId) {
                addonError("User has joins on, skipping search.");
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
                    addonError(response.errorMessage);
                    throw new Error(response.errorMessage)
                }
            }).catch(e => {
                console.log(e)
                isLoading = false;
            })
    });
}

function getAvatar(userId, callback) {
    if (!isLoading) return;

    fetch(`https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=48&height=48&format=png`)
        .then((v) => {
            if (isLoading)
                callback(v, userId);
        })
        .catch(exc => {
            console.error(exc);
            isLoading = false;
            addonError('Error occurred during callback!');
        });
}

function getPlaceId() {
    let urlMatch = document.location.href.match(/games\/(\d+)\//);
    if (urlMatch && !Number.isNaN(Number(urlMatch[1])))
        return urlMatch[1];

    return addonError('Unable to get place ID!');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function clamp(number, min, max) {
    return Math.max(min, Math.min(number, max));
}

const findServer = async(userId, avatar, placeID, total, offset, failAmount = 0) => {
    const percentage = clamp(Math.round((offset / total) * 100), 0, 100);
    const bar = document.getElementById('bar');
    bar.style.width = `${percentage}%`;
    if (total <= offset) return { error: true, api: false, percentage };
    const urls = Array.from({ length: REQUEST_LIMIT }, (_, i) => `www.roblox.com/games/getgameinstancesjson?placeId=${placeID}&startIndex=${i * 10 + offset}`);
    const data = await Promise.all(urls.map(url => request(url, { retry: RETRY_LIMIT })));
    const found = data
        .flatMap(group => group.Collection)
        .find(server => server.CurrentPlayers
            .find(player => player.Id === userId || player.Thumbnail.Url === avatar));
    if (total == offset) {
        return { error: true, api: true, percentage };
    }

    await sleep(200)
    if (!found) return findServer(userId, avatar, placeID, data[0].TotalCollectionSize, offset + REQUEST_LIMIT * 10, failAmount);
    return found;
};

function clearAddonServerContainer() {
    var thing = document.getElementById('rbx-addon-server-search');
    if (thing === null) return;
    while (thing.firstChild) {
        thing.removeChild(thing.firstChild);
    }
}

function addonError(err) {
    loadingAddonServerContainer(false);
    var thing = document.getElementById('rbx-addon-server-search');
    var msg = document.getElementById('rbx-addon-search-err');
    if (msg !== null) msg.remove();
    if (typeof err === 'string') {
        addonGameServerContainerHasItems(false);
        var p = document.createElement('p');
        p.className = 'no-servers-message';
        p.id = 'rbx-addon-search-err';
        p.innerText = err;
        thing.appendChild(p);
    }
}

function loadingAddonServerContainer(i) {
    var thing = document.getElementById('rbx-addon-server-search');
    if (thing === null) throw new Error('Could not find addon server container!');

    var loading = document.getElementById('rbx-addon-loading');
    if (loading !== null)
        loading.remove();

    if (i === true) {
        var spinner = document.createElement('div');
        spinner.className = "bar";
        spinner.id = 'bar';
        thing.appendChild(spinner);
    }
}

function displayAddonServerContainer(i) {
    var thing = document.getElementById('rbx-addon-server-search');
    var rbxSrvCont = document.getElementById('rbx-game-server-item-container');
    var loadMore = document.getElementsByClassName('rbx-running-games-footer');
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
    var thing = document.getElementById('rbx-addon-server-search');
    if (thing === null) throw new Error('Could not find server container!');

    if (i === true) {
        thing.className = 'section rbx-game-server-item-container stack-list';
    } else {
        thing.className = 'section rbx-game-server-item-container stack-list section-content-off';
    }
}

function createGameServerContainer() {
    var rbxSrvCont = document.getElementById('rbx-game-server-item-container');
    if (rbxSrvCont === null) throw new Error('Could not find server container!');

    var newNode = rbxSrvCont.cloneNode(false);
    newNode.id = "rbx-addon-server-search"

    rbxSrvCont.parentNode.appendChild(newNode);
    displayAddonServerContainer(false);
    addonGameServerContainerHasItems(false);
}

function createInput(node) {
    var container = document.createElement('div');
    var input = document.createElement('input');
    var namebutton = document.createElement("button");

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

    var idbutton = namebutton.cloneNode();
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
}



if (runningGames !== null) {
    console.log("%cServer Searcher has LOADED!", "color: #424242; font-size:16px;");
    createInput(runningGames.firstChild);
}