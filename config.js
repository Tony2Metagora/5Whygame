/**
 * L’URL de l’app Vercel est injectée au déploiement GitHub Pages (voir deploy-github-pages.mjs).
 * Placeholder remplacé par npm run deploy:pages
 */
(function () {
  var appUrl = "https://vercel.com/dashboard";
  var el = document.getElementById("app-link");
  if (!el) return;
  el.href = appUrl;
})();
