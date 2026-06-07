function swaggerPage() {
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#07152d">
    <title>Pokémon GO API · Console Swagger</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
    <style>
      html { box-sizing: border-box; }
      *, *::before, *::after { box-sizing: inherit; }
      body { background: #f5f8fc; margin: 0; }
      .swagger-ui .topbar { background: linear-gradient(90deg, #07152d, #12396b); }
      .swagger-ui .topbar-wrapper img, .swagger-ui .topbar-wrapper span { display: none; }
      .swagger-ui .topbar-wrapper::before {
        color: white; content: "Pokémon GO API · Console interactive";
        font: 800 15px/1 system-ui, sans-serif; letter-spacing: .04em;
      }
      .swagger-ui .info .title { color: #07152d; }
      .swagger-ui .opblock.opblock-get { background: rgba(22,133,255,.06); border-color: #1685ff; }
      .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #1685ff; }
      .swagger-ui .btn.execute { background: #1685ff; border-color: #1685ff; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
    <script>
      window.addEventListener("load", () => {
        SwaggerUIBundle({
          url: "/api-docs.json",
          dom_id: "#swagger-ui",
          deepLinking: true,
          displayRequestDuration: true,
          filter: true,
          persistAuthorization: true,
          presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
          layout: "StandaloneLayout"
        });
      });
    </script>
  </body>
</html>`;
}

module.exports = { swaggerPage };
