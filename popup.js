const toggleBtn = document.getElementById('toggleBtn');
const statusDot = document.getElementById('statusDot');
const autoOpenBox = document.getElementById('autoOpen');
const segButtons = [...document.querySelectorAll('.seg-btn')];

function renderFraction(fraction) {
  segButtons.forEach((btn) => {
    btn.classList.toggle('selected', Number(btn.dataset.fraction) === Number(fraction));
  });
}

function renderStatus(open) {
  statusDot.classList.toggle('on', open);
  toggleBtn.textContent = open ? 'Close sidebar' : 'Open sidebar';
  toggleBtn.classList.toggle('active', open);
}

async function init() {
  const { widthFraction = 3, autoOpen = false } = await chrome.storage.local.get([
    'widthFraction',
    'autoOpen'
  ]);
  renderFraction(widthFraction);
  autoOpenBox.checked = autoOpen;

  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
    renderStatus(res?.open ?? false);
  });
}

toggleBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'TOGGLE_DOCK' }, () => {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
      renderStatus(res?.open ?? false);
    });
  });
});

segButtons.forEach((btn) => {
  btn.addEventListener('click', async () => {
    const fraction = Number(btn.dataset.fraction);
    await chrome.storage.local.set({ widthFraction: fraction });
    renderFraction(fraction);
  });
});

autoOpenBox.addEventListener('change', async () => {
  await chrome.storage.local.set({ autoOpen: autoOpenBox.checked });
});

init();
