const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("FBS 3.0 backend running");
});

app.listen(3001, () => {
  console.log("Backend running on port 3001");
});
