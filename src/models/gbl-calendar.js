const { createCurrentDatasetModel } = require("./current-dataset");

module.exports = createCurrentDatasetModel({
  modelName: "GblCalendar",
  collectionName: "gbl_calendar",
  domain: "gbl-calendar",
});
