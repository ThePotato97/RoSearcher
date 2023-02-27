console.log('Loaded!');

(async () => {
  const div = document.createElement('div');
  div.id = 'rosearch-panel';
  div.innerHTML = await fetch(chrome.runtime.getURL('panel.html')).then((res) => res.text());

  if (document.body.classList.contains('dark-theme')) div.classList.add('dark');

  const runningGames = await waitForElm('#rbx-running-games');
  if (runningGames instanceof HTMLElement && runningGames.firstElementChild instanceof HTMLElement) {
    runningGames.firstElementChild.appendChild(div);
  }
})();
