const menuToggle = document.querySelector(".menu-toggle");
const offlineMessages = [
  "Estamos em manuten\u00e7\u00e3o",
  "Voltamos em breve",
  "Em atualiza\u00e7\u00f5es..."
];

const servers = [
  {
    id: "roleplay",
    ip: "177.54.152.95",
    port: 7777
  },
  {
    id: "pvp",
    ip: "177.54.152.95",
    port: 9090
  }
];

let offlineMessageIndex = 0;
let didTryFullscreen = false;

menuToggle.addEventListener("click", () => {
  const isOpen = document.body.classList.toggle("menu-open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
});

document.querySelectorAll(".nav-links a").forEach((link) => {
  link.addEventListener("click", () => {
    document.body.classList.remove("menu-open");
    menuToggle.setAttribute("aria-expanded", "false");
  });
});

async function tryAndroidLandscapeFullscreen() {
  const isTouchDevice = navigator.maxTouchPoints > 0;
  const isAndroid = /Android/i.test(navigator.userAgent);

  if (didTryFullscreen || !isTouchDevice || !isAndroid) {
    return;
  }

  didTryFullscreen = true;

  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
    }

    if (screen.orientation?.lock) {
      await screen.orientation.lock("landscape");
    }
  } catch (error) {
    console.info("Fullscreen/orientacao paisagem depende da permissao do navegador.", error);
  }
}

document.addEventListener("pointerdown", tryAndroidLandscapeFullscreen, { once: true });

document.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

document.addEventListener("dragstart", (event) => {
  event.preventDefault();
});

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  const isCtrlOrMeta = event.ctrlKey || event.metaKey;
  const blockedKeys = [
    "f12",
    "f10"
  ];
  const blockedCombos = (
    (isCtrlOrMeta && event.shiftKey && ["i", "j", "c"].includes(key)) ||
    (isCtrlOrMeta && ["u", "s", "p"].includes(key))
  );

  if (blockedKeys.includes(key) || blockedCombos) {
    event.preventDefault();
    event.stopPropagation();
  }
});

/*
setInterval(() => {
  const widthGap = window.outerWidth - window.innerWidth;
  const heightGap = window.outerHeight - window.innerHeight;

  if (widthGap > 160 || heightGap > 160) {
     document.body.classList.add("protected-view");
  } else {
    document.body.classList.remove("protected-view");
  }
}, 1000);
*/

function setServerCardState(serverId, state, text) {
  const card = document.querySelector(`[data-server-card="${serverId}"]`);
  const status = document.querySelector(`[data-server-status="${serverId}"]`);

  if (!card || !status) {
    return;
  }

  card.classList.remove("online", "offline", "loading");
  card.classList.add(state);
  status.textContent = text;
}

function getOfflineMessage() {
  return offlineMessages[offlineMessageIndex % offlineMessages.length];
}

function applyOfflineMessages() {
  document.querySelectorAll(".server-card.offline [data-server-status]").forEach((status) => {
    status.textContent = getOfflineMessage();
  });

  offlineMessageIndex += 1;
}

async function fetchJsonWithTimeout(url, timeout = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Status HTTP ${response.status}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeOpenMpStatus(data) {
  if (!data || !data.core) {
    return null;
  }

  if (data.active === false) {
    return { online: false };
  }

  return {
    online: true,
    players: Number(data.core.pc) || 0,
    maxPlayers: Number(data.core.pm) || 0
  };
}

function normalizeSampApiStatus(data) {
  if (!data || !data.online) {
    return { online: false };
  }

  return {
    online: true,
    players: Number(data.players) || 0,
    maxPlayers: Number(data.maxplayers) || 0
  };
}

async function fetchServerStatus(server) {
  const address = `${server.ip}:${server.port}`;
  const sources = [
    {
      url: `https://api.open.mp/servers/${address}`,
      normalize: normalizeOpenMpStatus
    },
    {
      url: `https://www.samp-api.ct8.pl/server/${address}`,
      normalize: normalizeSampApiStatus
    }
  ];

  let lastError = null;

  for (const source of sources) {
    try {
      const status = source.normalize(await fetchJsonWithTimeout(source.url));

      if (status) {
        return status;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return { online: false };
}

async function updateServer(server) {
  try {
    const status = await fetchServerStatus(server);

    if (status.online) {
      setServerCardState(server.id, "online", `${status.players}/${status.maxPlayers} jogadores in-game`);
      return;
    }
  } catch (error) {
    console.warn(`N\u00e3o foi poss\u00edvel consultar ${server.ip}:${server.port}`, error);
  }

  setServerCardState(server.id, "offline", getOfflineMessage());
}

function updateAllServers() {
  servers.forEach(updateServer);
}

updateAllServers();
setInterval(updateAllServers, 30000);
setInterval(applyOfflineMessages, 3000);
