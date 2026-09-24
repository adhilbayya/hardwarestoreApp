const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const dbPath = path.join(
  process.env.APPDATA,
  "com.adhil.hardwareapp",
  "hardware_store.db",
);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log("Connected to the database.");
});

db.serialize(() => {
  db.get(`SELECT * FROM invoices ORDER BY id DESC LIMIT 1`, (err, row) => {
    if (err) {
      console.error(err.message);
    }
    console.log(row);
  });
});

db.close();
