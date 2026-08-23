(function (global) {
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const API_PROD = "https://kristalltaptoplay.vercel.app";
  global.GAME_CONFIG = {
    APP_ID: 51874967,
    API_BASE: local ? "http://127.0.0.1:8787" : API_PROD,
  };
})(window);
