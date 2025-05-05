"use strict";
const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "credentialsDontPost/.env"),
});

const TEXT_ENCODING = "utf8";
process.stdin.setEncoding(TEXT_ENCODING);

const express = require("express");
const http = require("http");
const { MongoClient, ServerApiVersion } = require("mongodb");

const mongoURI = process.env.MONGO_CONNECTION_STRING;
const mongoClient = new MongoClient(mongoURI, {
  serverApi: ServerApiVersion.v1,
});

let collectionHandle;
mongoClient.connect()
  .then(() => {
    collectionHandle = mongoClient
      .db(process.env.MONGO_DB_NAME)
      .collection(process.env.MONGO_COLLECTION);
  })
  .catch(err => {
    console.error("Database connection failed:", err);
    process.exit(1);
  });

const port = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const router = express.Router();

app.set("view engine", "ejs");
app.set("views", path.resolve(__dirname, "templates"));
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use((req, res, next) => {
  req.storage = collectionHandle;
  next();
});

app.use("/", router);

router.get("/", (req, res) => {
  res.render("index");
});

router.get("/add", (req, res) => {
  res.render("addForm");
});

router.post("/processAdd", (req, res) => {
  const entry = {
    name: req.body.name.toLowerCase().trim(),
    type: req.body.type,
    level: Number(req.body.level),
    dateAdded: new Date().toLocaleDateString()
  };

  req.storage.insertOne(entry)
    .then(() => res.render("processAdd", entry))
    .catch(err => {
      console.error("Insert error:", err);
      res.status(500).send("Data storage failure");
    });
});

router.get("/retrieve", (req, res) => {
  res.render("retrieveForm");
});

router.post("/processRetrieve", (req, res) => {
  req.storage.find({}).toArray()
    .then(results => {
      const tableHTML = generateTable(results);
      res.render("processRetrieve", { tableContent: tableHTML });
    })
    .catch(err => {
      console.error("Query error:", err);
      res.status(500).send("Data retrieval issue");
    });
});

router.get("/api", (req, res) => {
  res.render("apiForm");
});

router.post("/processAPI", async (req, res) => {
  try {
    const name = req.body.name.trim().toLowerCase();
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}`);
    if (!response.ok) throw new Error("No matching Pokémon found");
    const data = await response.json();
    res.render("processAPI", { sprite: data.sprites.front_default, name });
  } catch (err) {
    console.error("API error:", err);
    res.status(404).render("apiError", { error: err.message });
  }
});

server.listen(port, () => {
  console.log(`Server active at http://localhost:${port}`);
  console.log("Type 'stop' to shutdown:");
  process.stdin.on("readable", () => handleTermination(mongoClient));
});

function handleTermination(dbClient) {
  const input = process.stdin.read();
  if (input?.trim().toLowerCase() === "stop") {
    console.log("Initiating shutdown...");
    dbClient.close()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  }
}

function generateTable(entries) {
  if (!entries.length) return "<p>No Pokémon entries available</p>";

  let table = `
    <table class="pokedex-table">
      <tr>
        <th>Name</th>
        <th>Type</th>
        <th>Level</th>
        <th>Date Added</th>
      </tr>`;

  entries.forEach(entry => {
    table += `
      <tr>
        <td>${entry.name}</td>
        <td>${entry.type}</td>
        <td>${entry.level}</td>
        <td>${entry.dateAdded}</td>
      </tr>`;
  });

  return table + "</table>";
}
