function redocPage() {
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#07152d">
    <title>Pokémon GO API · Documentation</title>
    <style>
      :root {
        color-scheme: dark;
        --ink: #07152d;
        --blue: #1685ff;
        --cyan: #2de2e6;
        --yellow: #ffca28;
        --red: #ff3d5a;
        --glass: rgba(10, 30, 62, .72);
        --line: rgba(123, 202, 255, .2);
      }
      * { box-sizing: border-box; }
      html { scroll-behavior: smooth; }
      [data-section-id] { scroll-margin-top: 86px; }
      body {
        background:
          radial-gradient(circle at 15% 5%, rgba(22,133,255,.25), transparent 28rem),
          radial-gradient(circle at 85% 15%, rgba(45,226,230,.13), transparent 25rem),
          #07152d;
        margin: 0;
      }
      body, button, a { font-family: Inter, ui-rounded, system-ui, -apple-system, sans-serif; }
      .topbar {
        align-items: center;
        backdrop-filter: blur(22px);
        background: rgba(4, 14, 32, .82);
        border-bottom: 1px solid var(--line);
        color: white;
        display: flex;
        gap: 18px;
        justify-content: space-between;
        min-height: 66px;
        padding: 10px clamp(16px, 4vw, 64px);
        position: sticky;
        top: 0;
        z-index: 50;
      }
      .brand { align-items: center; color: white; display: flex; gap: 12px; text-decoration: none; }
      .brand-copy { display: grid; line-height: 1.05; }
      .brand-copy strong { font-size: 15px; letter-spacing: .08em; text-transform: uppercase; }
      .brand-copy small { color: #8fc8ff; font-size: 11px; letter-spacing: .14em; margin-top: 5px; text-transform: uppercase; }
      .pokeball {
        background: linear-gradient(var(--red) 0 44%, #07152d 44% 56%, white 56%);
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 0 0 3px rgba(22,133,255,.35), 0 0 22px rgba(45,226,230,.45);
        height: 32px;
        position: relative;
        width: 32px;
      }
      .pokeball::after {
        background: white; border: 3px solid #07152d; border-radius: 50%;
        content: ""; height: 8px; left: 9px; position: absolute; top: 9px; width: 8px;
      }
      .toplinks { display: flex; flex-wrap: wrap; gap: 8px; }
      .pill, .cta {
        align-items: center; border: 1px solid var(--line); border-radius: 999px;
        color: white; display: inline-flex; font-size: 12px; font-weight: 750;
        gap: 7px; padding: 8px 13px; text-decoration: none; transition: .2s ease;
      }
      .pill { background: rgba(255,255,255,.05); }
      .pill:hover, .cta:hover { border-color: var(--cyan); box-shadow: 0 0 24px rgba(45,226,230,.22); transform: translateY(-1px); }
      .status-dot { background: #5eff91; border-radius: 50%; box-shadow: 0 0 12px #5eff91; height: 7px; width: 7px; }
      .hero {
        color: white; display: grid; gap: 40px; grid-template-columns: minmax(0, 1.15fr) minmax(300px, .85fr);
        margin: 0 auto; max-width: 1480px; overflow: hidden; padding: clamp(52px, 8vw, 110px) clamp(20px, 5vw, 80px) 58px;
        position: relative;
      }
      .hero::before {
        background-image: linear-gradient(rgba(123,202,255,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(123,202,255,.07) 1px, transparent 1px);
        background-size: 42px 42px; content: ""; inset: 0; mask-image: linear-gradient(to bottom, black, transparent); pointer-events: none; position: absolute;
      }
      .hero-copy, .visual { position: relative; z-index: 1; }
      .eyebrow {
        align-items: center; color: var(--cyan); display: flex; font-size: 12px; font-weight: 900;
        gap: 9px; letter-spacing: .18em; text-transform: uppercase;
      }
      .eyebrow::before { background: var(--cyan); box-shadow: 0 0 12px var(--cyan); content: ""; height: 2px; width: 30px; }
      h1 { font-size: clamp(48px, 8vw, 104px); letter-spacing: -.075em; line-height: .88; margin: 26px 0; max-width: 850px; }
      h1 span {
        background: linear-gradient(100deg, #fff 10%, #81d7ff 48%, var(--cyan));
        -webkit-background-clip: text; background-clip: text; color: transparent;
      }
      .intro { color: #b9d5ef; font-size: clamp(16px, 2vw, 20px); line-height: 1.65; margin: 0; max-width: 720px; }
      .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 30px; }
      .cta { border-radius: 14px; font-size: 14px; padding: 13px 18px; }
      .cta.primary { background: linear-gradient(135deg, #147cff, #00b8d9); border: 0; box-shadow: 0 14px 36px rgba(22,133,255,.28); }
      .metrics { display: grid; gap: 10px; grid-template-columns: repeat(4, minmax(90px, 1fr)); margin-top: 40px; max-width: 760px; }
      .metric {
        background: rgba(255,255,255,.045); border: 1px solid var(--line); border-radius: 16px;
        min-height: 88px; padding: 15px; position: relative; overflow: hidden;
      }
      .metric::after { background: var(--blue); bottom: 0; content: ""; height: 2px; left: 15px; opacity: .8; position: absolute; width: 28px; }
      .metric strong { display: block; font-size: clamp(19px, 3vw, 27px); letter-spacing: -.04em; }
      .metric span { color: #7faaca; display: block; font-size: 10px; font-weight: 800; letter-spacing: .1em; margin-top: 7px; text-transform: uppercase; }
      .visual { align-items: center; display: flex; justify-content: center; min-height: 420px; }
      .orb {
        aspect-ratio: 1; background: radial-gradient(circle, rgba(22,133,255,.38), rgba(45,226,230,.07) 47%, transparent 68%);
        border: 1px solid rgba(45,226,230,.2); border-radius: 50%; position: absolute; width: min(100%, 510px);
      }
      .orb::before, .orb::after { border: 1px dashed rgba(123,202,255,.3); border-radius: 50%; content: ""; inset: 8%; position: absolute; }
      .orb::after { inset: 22%; }
      .pokemon { filter: drop-shadow(0 28px 22px rgba(0,0,0,.35)); max-height: 310px; max-width: 48%; object-fit: contain; position: absolute; transition: transform .3s ease; }
      .pokemon:hover { transform: translateY(-8px) scale(1.04); }
      .pokemon.charizard { right: 6%; top: 2%; z-index: 3; }
      .pokemon.pikachu { bottom: 2%; left: 6%; max-height: 230px; z-index: 4; }
      .pokemon.bulbasaur { bottom: 10%; right: 4%; max-height: 185px; z-index: 2; }
      .scan {
        background: linear-gradient(90deg, transparent, rgba(45,226,230,.9), transparent);
        box-shadow: 0 0 28px var(--cyan); height: 1px; left: 5%; position: absolute; right: 5%; top: 42%; z-index: 5;
      }
      .doc-intro {
        align-items: end; background: #f5f8fc; border-radius: 32px 32px 0 0; color: var(--ink);
        display: flex; gap: 24px; justify-content: space-between; padding: 32px clamp(20px, 5vw, 80px) 22px;
      }
      .doc-intro small { color: #1685ff; font-size: 11px; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; }
      .doc-intro h2 { font-size: clamp(28px, 4vw, 48px); letter-spacing: -.05em; margin: 8px 0 0; }
      .doc-intro p { color: #587089; line-height: 1.55; margin: 0; max-width: 520px; }
      redoc { display: block; background: #f5f8fc; }
      redoc .redoc-wrap { background: #f5f8fc !important; }
      redoc .menu-content { border-right: 1px solid #dce8f4; }
      redoc .api-content h1, redoc .api-content h2, redoc .api-content h3 { letter-spacing: -.04em !important; }
      redoc .http-verb { border-radius: 999px !important; }
      @media (max-width: 980px) {
        .hero { grid-template-columns: 1fr; }
        .visual { min-height: 330px; }
        .metrics { grid-template-columns: repeat(2, 1fr); }
        .doc-intro { align-items: start; flex-direction: column; }
      }
      @media (max-width: 680px) {
        .topbar { align-items: flex-start; flex-direction: column; }
        .toplinks { width: 100%; }
        .pill { flex: 1; justify-content: center; }
        .hero { padding-top: 46px; }
        h1 { font-size: 52px; }
        .visual { min-height: 260px; }
        .pokemon { max-height: 210px; }
        .pokemon.pikachu { max-height: 155px; }
        .pokemon.bulbasaur { max-height: 120px; }
      }
    </style>
  </head>
  <body>
    <header class="topbar">
      <a class="brand" href="/api-docs">
        <span class="pokeball"></span>
        <span class="brand-copy"><strong>Pokémon GO API</strong><small>Developer Network</small></span>
      </a>
      <nav class="toplinks">
        <a class="pill" href="/swagger">Console interactive</a>
        <a class="pill" href="/api-docs.json">OpenAPI JSON</a>
        <a class="pill" href="/health"><span class="status-dot"></span><span id="status-label">API en ligne</span></a>
      </nav>
    </header>

    <main class="hero">
      <section class="hero-copy">
        <div class="eyebrow">API REST francophone · Version 1.0</div>
        <h1>Le Pokédex<br><span>pour les développeurs.</span></h1>
        <p class="intro">Une API Pokémon GO complète pour construire des applications, bots Discord, outils PvP, calculateurs Raid et collections connectées.</p>
        <div class="actions">
          <a class="cta primary" href="#reference">Explorer les endpoints</a>
          <a class="cta" href="/swagger">Tester une requête</a>
          <a class="cta" href="/api/v1/pokemon/pikachu">Voir Pikachu en JSON</a>
        </div>
        <div class="metrics">
          <div class="metric"><strong id="pokemon-count">1 416</strong><span>Pokémon & formes</span></div>
          <div class="metric"><strong id="move-count">282</strong><span>Attaques</span></div>
          <div class="metric"><strong id="route-count">47</strong><span>Endpoints</span></div>
          <div class="metric"><strong>18</strong><span>Types</span></div>
        </div>
      </section>
      <section class="visual" aria-label="Pokémon vedettes">
        <div class="orb"></div><div class="scan"></div>
        <img class="pokemon charizard" src="https://raw.githubusercontent.com/Matthieu-Vachet/PokemonGo-Assets-API/refs/heads/main/Pokemon/pm6.icon.png" alt="Dracaufeu">
        <img class="pokemon pikachu" src="https://raw.githubusercontent.com/Matthieu-Vachet/PokemonGo-Assets-API/refs/heads/main/Pokemon/pm25.icon.png" alt="Pikachu">
        <img class="pokemon bulbasaur" src="https://raw.githubusercontent.com/Matthieu-Vachet/PokemonGo-Assets-API/refs/heads/main/Pokemon/pm1.icon.png" alt="Bulbizarre">
      </section>
    </main>

    <section class="doc-intro" id="reference">
      <div><small>Référence technique</small><h2>Choisissez votre endpoint</h2></div>
      <p>Chaque route contient des paramètres préremplis, une réponse réelle et des exemples prêts à utiliser en curl, JavaScript et Python.</p>
    </section>

    <redoc
      spec-url="/api-docs.json"
      expand-responses="200"
      hide-download-button="false"
      native-scrollbars
      path-in-middle-panel
      required-props-first
      sort-props-alphabetically
      theme='{
        "colors": {
          "primary": { "main": "#1685ff" },
          "success": { "main": "#14b86e" },
          "http": { "get": "#1685ff" },
          "text": { "primary": "#102b49", "secondary": "#587089" },
          "border": { "dark": "#dce8f4", "light": "#edf3f8" }
        },
        "sidebar": { "width": "290px", "backgroundColor": "#f8fbff", "textColor": "#506a84", "activeTextColor": "#1685ff" },
        "rightPanel": { "backgroundColor": "#07152d", "textColor": "#edf8ff", "width": "38%" },
        "typography": {
          "fontFamily": "Inter, ui-rounded, system-ui, sans-serif",
          "fontSize": "15px",
          "lineHeight": "1.65em",
          "headings": { "fontFamily": "Inter, ui-rounded, system-ui, sans-serif", "fontWeight": "850" },
          "code": { "fontFamily": "SFMono-Regular, Consolas, monospace", "fontSize": "13px" }
        }
      }'
    ></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
    <script>
      function redocSectionFromHash(hash) {
        if (!hash) return null;
        const decoded = decodeURIComponent(hash.replace(/^#/, ""));
        const candidates = [
          decoded,
          decoded.split("/").slice(-2).join("/"),
          decoded.split("/").pop()
        ].filter(Boolean);
        for (const value of candidates) {
          const section = document.querySelector('[data-section-id="' + CSS.escape(value) + '"]');
          if (section) return section;
        }
        return document.getElementById(decoded) || document.getElementById(candidates.at(-1));
      }

      function navigateToRedocHash(hash, attempts = 0) {
        const section = redocSectionFromHash(hash);
        if (!section && attempts < 30) {
          window.setTimeout(() => navigateToRedocHash(hash, attempts + 1), 150);
          return;
        }
        if (!section) return;
        const topbar = document.querySelector(".topbar");
        const offset = (topbar ? topbar.offsetHeight : 0) + 18;
        const top = section.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: attempts ? "auto" : "smooth" });
      }

      document.addEventListener("click", event => {
        const link = event.target.closest('a[href^="#"]');
        if (!link || !link.hash) return;
        event.preventDefault();
        history.pushState(null, "", link.hash);
        navigateToRedocHash(link.hash);
      });
      window.addEventListener("hashchange", () => navigateToRedocHash(location.hash));
      window.addEventListener("load", () => {
        if (location.hash) navigateToRedocHash(location.hash);
      });

      Promise.all([
        fetch("/api/v1/stats/global").then(response => response.json()),
        fetch("/api-docs.json").then(response => response.json()),
        fetch("/health").then(response => response.json())
      ]).then(([stats, docs, health]) => {
        const totals = stats.data && stats.data.totals;
        if (totals) {
          document.getElementById("pokemon-count").textContent = totals.pokemon.toLocaleString("fr-FR");
          document.getElementById("move-count").textContent = totals.moves.toLocaleString("fr-FR");
        }
        document.getElementById("route-count").textContent = Object.keys(docs.paths || {}).length;
        document.getElementById("status-label").textContent = health.data && health.data.database === "connected" ? "Atlas connecté" : "API en ligne";
      }).catch(() => {});
    </script>
  </body>
</html>`;
}

module.exports = { redocPage };
