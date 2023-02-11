const post = async (/** @type {string} */ url, /** @type {string} */ body) => {
  try {
    const request = await fetch(`https://${url}`, {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!request.ok) throw new Error('Request failed');

    return await request.json();
  } catch (error) {
    await sleep(0.2);
    return await post(url, body);
  }
};

/**
 * @param {string} selector
 */
function waitForElm(selector) {
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

const sleep = (/** @type {number} */ time) => new Promise(res => setTimeout(res, time * 1000));

const get = async (/** @type {string} */ url) => {
  try {
    const request = await fetch(`https://${url}`);
    if (!request.ok) throw new Error('Request failed');

    return await request.json();
  } catch (error) {
    await sleep(0.2);
    return await get(url);
  }
};

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

class ContentScript {
  constructor() {
    this.search = null;
    this.input = null;
    this.status = null;
    this.icon = null;
    this.bar = null;
    this.searching = false;
    this.canceled = false;
    this.foundAllServers = false;
    this.searchingTarget = true;
    this.allPlayers = [];
    this.playersCount = 0;
    this.targetsChecked = 0;
    this.maxPlayers = 0;
    this.targetServersId = [];
    this.highlighted = [];
    this.allThumbnails = new Map();
  }
  init = async () =>  {
    this.search = await waitForElm('#sbx-search');
    this.input = await waitForElm('#sbx-input');
    this.status = await waitForElm('#sbx-status');
    this.icon = await waitForElm('#sbx-user');
    this.bar = await waitForElm('#sbx-bar');
    if (!this.search || !this.input || !this.status || !this.icon || !this.bar) {
      console.error('Content script not initialized');
      return;
    }
    this.search.src = getURL('images/search.png');
    this.icon.src = getURL('images/user.png');
    this.input.oninput = () => {
      const test = /(^(?=^[^_]+_?[^_]+$)\w{3,20}$|^\d+$)/.test(this.input.value);
      if (!this.input.value) this.icon.src = USER.NEUTRAL;
      else this.icon.src = test ? USER.SUCCESS : USER.ERROR;
      this.search.disabled = !test;
    };
    this.search.addEventListener('click', this.onClick);
  }
  color = (/** @type {string} */ color) => {
    this.bar.style.backgroundColor = color;
    this.search.style.backgroundColor = color;
  }
  fetchServers = async (place = '', cursor = '', attempts = 0) => {
    const { nextPageCursor, data } = await get(`games.roblox.com/v1/games/${place}/servers/Public?limit=100&cursor=${cursor}`);
    if (attempts >= 30) {
      this.foundAllServers = true;
      return;
    }
    if (!data || data.length === 0) {
      await sleep(1);
      return this.fetchServers(place, cursor, attempts + 1);
    }
    data.forEach((/** @type {{ playerTokens: any[]; id: any; maxPlayers: number; }} */ server) => {
      server.playerTokens.forEach((/** @type {any} */ playerToken) => {
        this.playersCount += 1;
        this.allPlayers.push({
          token: playerToken,
          type: 'AvatarHeadshot',
          size: '150x150',
          requestId: server.id,
        });
      });
      this.maxPlayers = server.maxPlayers;
    });
    if (!nextPageCursor || this.canceled) {
      this.foundAllServers = true;
      return;
    }
    return this.fetchServers(place, nextPageCursor);
  }
  findTarget = async (/** @type {any} */ imageUrl, /** @type {string} */ place) => {
    while (this.searchingTarget) {
      if (this.canceled) {
        this.searchingTarget = false;
      }
  
      const chosenPlayers = [];
  
      for (let i = 0; i < 100; i++) {
        const playerToken = this.allPlayers.shift();
        if (!playerToken) break;
        chosenPlayers.push(playerToken);
      }
  
      if (!chosenPlayers.length) {
        await sleep(0.1);
        if (this.targetsChecked === this.playersCount && this.foundAllServers) {
          break;
        }
        continue;
      }
  
      post('thumbnails.roblox.com/v1/batch', JSON.stringify(chosenPlayers)).then(({ data: thumbnailsData }) => {
        if (this.canceled) return;
  
        thumbnailsData.forEach((/** @type {{ requestId: any; imageUrl: any; }} */ thumbnailData) => {
          const thumbnails = this.allThumbnails.get(thumbnailData.requestId) || [];
  
          if (thumbnails.length == 0) {
            this.allThumbnails.set(thumbnailData.requestId, thumbnails);
          }
  
          this.targetsChecked += 1;
  
          if (!thumbnails.includes(thumbnailData.imageUrl)) {
            thumbnails.push(thumbnailData.imageUrl);
          }
  
          this.bar.style.width = `${Math.round((this.targetsChecked / this.playersCount) * 100)}%`;
  
          const foundTarget = thumbnailData.imageUrl === imageUrl ? thumbnailData.requestId : null;
  
          if (foundTarget) {
            this.renderServers();
  
            this.targetServersId.push(foundTarget);
            this.searchingTarget = false;
          }
        });
      });
    }
  
    if (this.targetServersId.length) {
      this.renderServers();
    } else {
      this.color(this.canceled ? COLORS.BLUE : COLORS.RED);
      this.status.innerText = this.canceled ? 'Canceled search' : 'Player not found!';
    }
  
    this.searching = false;
    this.canceled = false;
  
    this.bar.style.width = '100%';
    this.input.disabled = false;
    this.search.src = getURL('images/search.png');
  }
  find = async (/** @type {any} */ imageUrl, /** @type {string} */ place) => {
    this.allPlayers = [];
    /**
     * @type {never[]}
     */
    this.targetServerId = [];

    this.allThumbnails.clear();
    this.foundAllServers = false;
    this.searchingTarget = true;
    this.allPlayers = [];
    this.playersCount = 0;
    this.targetsChecked = 0;
    this.maxPlayers = 0;

    this.status.innerText = 'Searching...';
    this.color(COLORS.BLUE);
    this.search.src = getURL('images/cancel.png');
    this.icon.src = getURL('images/user-success.png');
    this.input.disabled = true;

    this.fetchServers(place);
    this.findTarget(imageUrl, place);
  }
  onClick = async (/** @type {{ preventDefault: () => void; }} */ event) => {
    // Prevents page from refreshing
    event.preventDefault();

    if (this.searching) {
      this.canceled = true;
      return;
    }

    this.searching = true;

    let endpoint;
    if (/^\d+$/.test(this.input.value)) {
      endpoint = `api.roblox.com/users/${this.input.value}`;
    } else {
      endpoint = `api.roblox.com/users/get-by-username?username=${this.input.value}`;
    }
    const user = await get(endpoint);

    if (user.errors || user.errorMessage) {
      this.icon.src = USER.ERROR;
      this.searching = false;
      this.status.innerText = 'User not found!';
      return;
    }
    const href = window.location.href;
    const regex = /games\/(\d+)\//;
    const match = href.match(regex);
    if (!match) return;

    const [, place] = match;
    if (!place) return;
    const { data: [{ imageUrl }] } = await get(`thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.Id}&size=150x150&format=Png&isCircular=false`);

    this.highlighted.forEach((item) => {
      item.remove();
    });

    this.find(imageUrl, place);
  }
  renderServers = async () => {
    this.highlighted.forEach((item) => {
      item.remove();
    });

    this.highlighted = [];

    this.targetServersId.forEach((/** @type {any} */ targetServerId) => {
      this.icon.src = getURL('images/user-success.png');
      this.color(COLORS.GREEN);
      setTimeout(() => this.color(COLORS.BLUE), 1000);
      
      const first = document.querySelectorAll('.rbx-game-server-item')[0];
      const item = document.createElement('li');

      const thumbnails = this.allThumbnails.get(targetServerId);
      const firstParent = first.parentElement;
      if (!firstParent) return;
      item.className = 'rbx-game-server-item col-md-3 col-sm-4 col-xs-6';
      item.innerHTML = `<div class="card-item found-server">
      <div class="player-thumbnails-container">
         ${thumbnails.map((/** @type {any} */ url) => `<span class="avatar avatar-headshot-md player-avatar">
            <span class="thumbnail-2d-container avatar-card-image">
              <img class="" src="${url}" alt="" title="">
            </span>
          </span>`).join('')}
         <span class="avatar avatar-headshot-md player-avatar hidden-players-placeholder">+3</span>
      </div>
      <div class="rbx-game-server-details game-server-details">
         <div class="text-info rbx-game-status rbx-game-server-status text-overflow">${thumbnails.length} of ${this.maxPlayers} people max</div>
           <div class="server-player-count-gauge border">
            <div class="gauge-inner-bar border" style="width: 100%;"></div>
              </div>
            <span>
              <button data-id="${targetServerId}" type="button" class="btn-full-width btn-control-xs rbx-game-server-join game-server-join-btn btn-primary-md btn-min-width">Join</button>
          </span>
        </div>
      </div>`;

      firstParent.insertBefore(item, first);
      this.highlighted.push(item);

      const [join] = document.querySelectorAll(`[data-id="${targetServerId}"]`);
      join.onclick = () => chrome.runtime.sendMessage({ message: { place, id: targetServerId } });
      this.status.innerText = 'Found player';
    });
  }
}



(async () => {
  const div = document.createElement('div');
  div.id = 'sbx-panel';
  div.innerHTML = await fetch(chrome.runtime.getURL('panel.html')).then(res => res.text());

  if (document.body.classList.contains('dark-theme')) div.classList.add('dark');

  const runningGames = await waitForElm('#rbx-running-games');
  runningGames.firstElementChild.appendChild(div);
  const content = new ContentScript();
  content.init();
})();


