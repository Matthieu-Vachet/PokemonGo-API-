const express = require("express");
const app = express();

app.use(express.json());

// Routes will be added here

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
