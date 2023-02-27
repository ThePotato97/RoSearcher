const avatarFetchLimiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 100
});

const serverFetchLimiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 100
});

class BidirectionalMap extends Map {
  constructor(iterable) {
    super(iterable);
    this.reverseMap = new Map();
  }

  set(key, value) {
    super.set(key, value);
    this.reverseMap.set(value, key);
    return this;
  }

  delete(key) {
    const value = super.get(key);
    if (value !== undefined) {
      super.delete(key);
      this.reverseMap.delete(value);
      return true;
    }
    return false;
  }

  clear() {
    super.clear();
    this.reverseMap.clear();
  }

  getReverse(key) {
    return this.reverseMap.get(key);
  }

  hasReverse(key) {
    return this.reverseMap.has(key);
  }
}



const MAX_RETRIES = 5; // Maximum number of retries
const BASE_DELAY = 200; // Base delay in milliseconds
const RETRY_DELAY_FACTOR = 2; // Delay factor for exponential backoff

class queueManager {
  queue = [];
  addToQueue = (item) => {
    this.queue.push(item);
  }
  fetchFromQueue = () => {
    return this.queue.shift();
  }
}

class Rosearcher {
  tokenQueue = new queueManager();
  constructor() {

  }

}


const COLORS = {
  GREEN: '#00b06f',
  BLUE: '#0077ff',
  RED: '#ff3e3e',
};

const { getURL } = chrome.runtime;

const USER = {
  SUCCESS: getURL('images/user-success.png'),
  NEUTRAL: getURL('images/user.png'),
  ERROR: getURL('images/user-error.png'),
};

/**
 * Convert a map of players to an array of objects with "token" and "thumbnail" properties.
 * @param {Map<string, string>} playerMap - The map of players.
 * @returns {Array<{token: string, thumbnail: string}>} An array of player objects.
 */
const convertToObject = (playerMap) => {
  const result = [];
  playerMap.forEach((value, name) => result.push({ token: name, thumbnail: value }));
  return result;
};

/**
 * Get an array of unprocessed players from a map of players, where the "thumbnail" property is undefined.
 * @param {Map<string, string>} playerMap - The map of players.
 * @returns {Array<{token: string, thumbnail: undefined}>} An array of unprocessed player objects.
 */
const getUnprocessed = (playerMap) => {
  const result = [];
  playerMap.forEach((value, name) => {
    if (value === undefined) result.push({ token: name, thumbnail: value });
  });
  return result;
};

const getProcessedLength = (playerMap) => {
  let result = 0;
  playerMap.forEach((value) => {
    if (value !== undefined) result += 1;
  });
  return result;
};

/**
 * Get an array of processed players from a map of players, where the "thumbnail" property is defined.
 * @param {Map<string, string>} playerMap - The map of players.
 * @returns {Array<{token: string, thumbnail: string}>} An array of processed player objects.
 */
const getProcessed = (playerMap) => {
  const result = [];
  playerMap.forEach((value, name) => {
    if (value !== undefined) result.push({ token: name, thumbnail: value });
  });
  return result;
};


const sleep = time => new Promise(res => setTimeout(res, time * 1000));

const get = async (url) => {
  try {
    const request = await fetch(`https://${url}`);
    if (!request.ok) throw new Error('Request failed');

    return await request.json();
  } catch (error) {
    await sleep(0.2);
    return await get(url);
  }
};

const post = async (url, body) => {
  let retries = 0;
  let delay = BASE_DELAY;

  while (retries < MAX_RETRIES) {
    try {
      const request = await fetch(`https://${url}`, {
        credentials: 'include',
        method: 'POST',
        body,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!request.ok) throw new Error('Request failed');

      return await request.json();
    } catch (error) {
      retries++;
      if (retries >= MAX_RETRIES) {
        throw new Error(`Failed to post data to ${url}`);
      }

      // Increase delay between each retry attempt
      delay *= RETRY_DELAY_FACTOR;

      // Wait before retrying
      await sleep(delay);
    }
  }
};

const search = document.getElementById('sbx-search');
const input = document.getElementById('sbx-input');
const status = document.getElementById('sbx-status');
const icon = document.getElementById('sbx-user');
const bar = document.getElementById('sbx-bar');

search.src = getURL('images/search.png');
icon.src = getURL('images/user.png');

const color = hex => {
  bar.style.backgroundColor = hex;
  search.style.backgroundColor = hex;
};

input.oninput = () => {
  const test = /(^(?=^[^_]+_?[^_]+$)\w{3,20}$|^\d+$)/.test(input.value);
  if (!input.value) icon.src = USER.NEUTRAL;
  else icon.src = test ? USER.SUCCESS : USER.ERROR;
  search.disabled = !test;
};

let searching = false;
let canceled = false;
let foundAllServers = false;
let searchingTarget = true;
let allPlayers = [];
const playersMap /** @type {Map<string, string>} */ = new BidirectionalMap();
const serversMap /** @type {Map<string, string>} */ = new BidirectionalMap();
const thumbnailMap /** @type {Map<string, string>} */ = new BidirectionalMap();

let playersCount = 0;
let maxPlayers = 0;

let targetServersId = [];
let highlighted = [];

const allThumbnails = new Map();

async function fetchServers(place = '', cursor = '', attempts = 0) {
  const requestWrapped = serverFetchLimiter.wrap(get)
  const { nextPageCursor, data } = await requestWrapped(`games.roblox.com/v1/games/${place}/servers/Public?limit=100&cursor=${cursor}`);

  if (attempts >= 30) {
    foundAllServers = true;
    return;
  }

  if (!data || data.length === 0) {
    await sleep(1);
    return fetchServers(place, cursor, attempts + 1);
  }

  data.forEach((server) => {
    server.playerTokens.forEach((playerToken) => {
      playersMap.set(playerToken, undefined);
      serversMap.set(playerToken, server.id);
    });
    const playerFound = server.playerTokens.find(playerToken => {
      return playerToken.token === "72138D7746871E24D00E726A23FFA593";
    });
    if (playerFound) {
      console.log("Found ComplianceChecker")
    }
    maxPlayers = server.maxPlayers;
  });

  if (!nextPageCursor || canceled) {
    foundAllServers = true;
    return;
  }

  return fetchServers(place, nextPageCursor);
}

async function findTarget(imageUrl, place) {
  while (searchingTarget) {
    await sleep(0.2);
    if (canceled) {
      searchingTarget = false;
    }

    const chosenPlayers = [];
    const unprocessedPlayers = getUnprocessed(playersMap);
    const first100 = unprocessedPlayers.slice(0, 99);
    first100.forEach((player) => {
      chosenPlayers.push({
        token: player.token,
        type: 'AvatarHeadshot',
        size: '150x150',
        requestId: JSON.stringify({
          serverId: serversMap.get(player.token),
          token: player.token,
        }),
      });
    });

    if (!chosenPlayers.length) {
      await sleep(0.1);
      if (getProcessedLength(playersMap) === playersMap.size && foundAllServers) {
        break;
      }
      continue;
    }
    const postWrapped = avatarFetchLimiter.wrap(post)
    const playersChecked = getProcessedLength(playersMap);
    post('thumbnails.roblox.com/v1/batch', JSON.stringify(chosenPlayers)).then(({ data: thumbnailsData }) => {
      if (canceled) return;
      console.log(thumbnailsData)
      thumbnailsData.forEach((thumbnailData, i) => {
        const { serverId, token } = JSON.parse(thumbnailData.requestId);
        playersMap.set(token, thumbnailData.imageUrl);
        serversMap.set(token, serverId);
        const playersCount = playersMap.size;
        bar.style.width = `${Math.round((playersChecked + i / playersCount) * 100)}%`;
      });
    });
    const processedPlayers = getProcessed(playersMap);
    const playerToken = playersMap.getReverse(imageUrl);
    if (playerToken) {
      const foundTarget = serversMap.get(playerToken);

      if (foundTarget) {
        renderServers();

       // targetServersId.push(foundTarget);
        searchingTarget = false;
      }
    }
  }

  if (targetServersId.length) {
    targetServersId.forEach((targetServerId) => {
      icon.src = getURL('images/user-success.png');
      color(COLORS.GREEN);
      setTimeout(() => color(COLORS.BLUE), 1000);

      const first = document.querySelectorAll('.rbx-game-server-item')[0] || document.querySelectorAll('#rbx-running-games > div.section-content-off.empty-game-instances-container > p')[0];

      if (first.className == 'no-servers-message') {
        first.parentNode.style['display'] = 'flex';
        first.parentNode.style['flex-direction'] = 'column';
      }

      const item = document.createElement('li');

      const thumbnails = allThumbnails.get(targetServerId);
      const firstFive = thumbnails.slice(0, 5);
      const amountLeft = thumbnails.length - firstFive.length;
      item.className = 'rbx-game-server-item col-md-3 col-sm-4 col-xs-6';
      item.innerHTML = `<div class="card-item found-server">
      <div class="player-thumbnails-container">
         ${firstFive.map(url => `<span class="avatar avatar-headshot-md player-avatar">
            <span class="thumbnail-2d-container avatar-card-image">
              <img class="" src="${url}" alt="" title="">
            </span>
          </span>`).join('')}
         <span class="avatar avatar-headshot-md player-avatar hidden-players-placeholder">+${amountLeft}</span>
      </div>
      <div class="rbx-game-server-details game-server-details">
         <div class="text-info rbx-game-status rbx-game-server-status text-overflow">${thumbnails.length} of ${maxPlayers} people max</div>
           <div class="server-player-count-gauge border">
            <div class="gauge-inner-bar border" style="width: 100%;"></div>
              </div>
            <span>
              <button data-id="${targetServerId}" type="button" class="btn-full-width btn-control-xs rbx-game-server-join game-server-join-btn btn-primary-md btn-min-width">Join</button>
          </span>
        </div>
      </div>`;

      first.parentNode.insertBefore(item, first);
      highlighted.push(item);

      const [join] = document.querySelectorAll(`[data-id="${targetServerId}"]`);
      join.onclick = () => chrome.runtime.sendMessage({ message: { place, id: targetServerId } });
      status.innerText = 'Found player';
    });
  } else {
    color(canceled ? COLORS.BLUE : COLORS.RED);
    status.innerText = canceled ? 'Canceled search' : 'Player not found!';
  }

  searching = false;
  canceled = false;

  bar.style.width = '100%';
  input.disabled = false;
  search.src = getURL('images/search.png');
}

function renderServers() {
  highlighted.forEach((item) => {
    item.remove();
  });

  highlighted = [];

  targetServersId.forEach((targetServerId) => {
    icon.src = getURL('images/user-success.png');
    color(COLORS.GREEN);
    setTimeout(() => color(COLORS.BLUE), 1000);

    const first = document.querySelectorAll('.rbx-game-server-item')[0];
    const item = document.createElement('li');

    const thumbnails = allThumbnails.get(targetServerId);

    item.className = 'rbx-game-server-item col-md-3 col-sm-4 col-xs-6';
    item.innerHTML = `<div class="card-item found-server">
    <div class="player-thumbnails-container">
       ${thumbnails.map(url => `<span class="avatar avatar-headshot-md player-avatar">
          <span class="thumbnail-2d-container avatar-card-image">
            <img class="" src="${url}" alt="" title="">
          </span>
        </span>`).join('')}
       <span class="avatar avatar-headshot-md player-avatar hidden-players-placeholder">+3</span>
    </div>
    <div class="rbx-game-server-details game-server-details">
       <div class="text-info rbx-game-status rbx-game-server-status text-overflow">${thumbnails.length} of ${maxPlayers} people max</div>
         <div class="server-player-count-gauge border">
          <div class="gauge-inner-bar border" style="width: 100%;"></div>
            </div>
          <span>
            <button data-id="${targetServerId}" type="button" class="btn-full-width btn-control-xs rbx-game-server-join game-server-join-btn btn-primary-md btn-min-width">Join</button>
        </span>
      </div>
    </div>`;

    first.parentNode.insertBefore(item, first);
    highlighted.push(item);

    const [join] = document.querySelectorAll(`[data-id="${targetServerId}"]`);
    join.onclick = () => chrome.runtime.sendMessage({ message: { place, id: targetServerId } });
    status.innerText = 'Found player';
  });
};

async function find(imageUrl, place) {
  allPlayers = [];
  targetServersId = [];

  allThumbnails.clear();
  foundAllServers = false;
  searchingTarget = true;
  allPlayers = [];
  maxPlayers = 0;
  serversMap.clear();
  status.innerText = 'Searching...';
  color(COLORS.BLUE);
  search.src = getURL('images/cancel.png');
  icon.src = getURL('images/user-success.png');
  input.disabled = true;

  fetchServers(place);
  findTarget(imageUrl, place);
}

search.addEventListener('click', async event => {
  // Prevents page from refreshing
  event.preventDefault();

  if (searching) {
    canceled = true;
    return;
  }

  searching = true;

  const user = await get(`api.roblox.com/users/${/^\d+$/.test(input.value) ? input.value : `get-by-username?username=${input.value}`}`);

  if (user.errors || user.errorMessage) {
    icon.src = USER.ERROR;
    searching = false;
    status.innerText = 'User not found!';
    return;
  }

  const [, place] = window.location.href.match(/games\/(\d+)\//);
  const { data: [{ imageUrl }] } = await get(`thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.Id}&size=150x150&format=Png&isCircular=false`);

  highlighted.forEach((item) => {
    item.remove();
  });

  find(imageUrl, place);
});
