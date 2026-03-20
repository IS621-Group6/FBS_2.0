const axios = require("axios");

const fs = require("fs");

function logToFile(message) {
  fs.appendFileSync("health.log", message + "\n");
}

setInterval(async () => {
  try {
    const res = await axios.get("http://localhost:3001/api/health");

    if (res.data.status !== "OK") {
      console.error("⚠️ HEALTH ISSUE:", res.data);
    } else {
      const time = new Date().toISOString();

      console.log(`Health OK: ${time}`);
      logToFile(`OK ${time}`);
    }

  } catch (err) {
      const time = new Date().toISOString();

      console.error("🚨 SERVICE DOWN:", err.message);
      logToFile(`DOWN ${time} ${err.message}`);
  }
}, 5000); // runs every 5 seconds