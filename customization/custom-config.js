config.hideLoginButton = true;
config.defaultLogoUrl = '/images/custom-logo.png';
config.securityUi = { ...config.securityUi, hideLobbyButton: true, disableLobbyPassword: true };

if (window.self === window.top) {
    const nativeUrl = new URL(window.location.href);
    const roomName = nativeUrl.pathname.match(/^\/([^/]+)\/?$/)?.[1];
    const uuidRoom = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (roomName && !roomName.toLowerCase().startsWith('native-')
        && !uuidRoom.test(roomName) && !nativeUrl.searchParams.has('jwt')) {
        nativeUrl.pathname = `/native-${roomName}`;
        window.location.replace(nativeUrl.href);
    }
}

const lobbyLoginStyle = document.createElement('style');
lobbyLoginStyle.textContent = '.lobby-screen [data-testid="lobby.loginButton"] { display: none !important; }';
document.head.appendChild(lobbyLoginStyle);

const updateLobbyWaitingMessage = () => {
    if (window.self !== window.top) {
        document.querySelectorAll('.lobby-screen input[data-testid="lobby.nameField"]').forEach((input) => {
            input.readOnly = true;
        });
    }
    document.querySelectorAll('.lobby-screen .joining-message').forEach((message) => {
        if (message.textContent?.includes('inicie sesión')) {
            message.textContent = 'La reunión comenzará cuando se una el anfitrión.';
        }
    });
};

new MutationObserver(updateLobbyWaitingMessage).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
});

if (window.location.protocol === 'http:' && window.location.hostname === 'localhost') {
    config.websocket = `ws://${window.location.host}/xmpp-websocket`;
    config.bosh = `http://${window.location.host}/http-bind`;
}