const { ApiError } = require("./api-error");

const leagueMap = {
  little: "littleCup",
  littlecup: "littleCup",
  great: "greatLeague",
  greatleague: "greatLeague",
  ultra: "ultraLeague",
  ultraleague: "ultraLeague",
  master: "masterLeague",
  masterleague: "masterLeague",
};

function normalizeLeague(value) {
  const league = leagueMap[String(value).toLowerCase()];
  if (!league) {
    throw new ApiError(400, `Ligue PvP invalide : ${value}`, "INVALID_PVP_LEAGUE");
  }
  return league;
}

module.exports = { normalizeLeague };
