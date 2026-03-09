const express = require("express");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const cors = require("cors");
const axios = require("axios");
const multer = require("multer");

dotenv.config();

const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static("public"));

/* =========================
UPLOAD CONFIG
========================= */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

/* =========================
ENV CONFIG
========================= */

const API_KEY = process.env.POST_API_KEY;
const INTERNAL_KEY = process.env.INTERNAL_KEY || "88ENG2025";

if (!API_KEY) {
  console.error("POST_API_KEY not found");
  process.exit(1);
}

/* =========================
BASIC ROUTES
========================= */

app.get("/", (req, res) => {
  res.send("88 Engineering AI Server running");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

/* =========================
SAFE FILE LOAD
========================= */

function loadFileSafe(filePath) {
  try {
    return fs.readFileSync(path.join(__dirname, filePath), "utf8");
  } catch {
    return "";
  }
}

/* =========================
LOAD TXT FROM FOLDER
========================= */

function loadFolderTxt(folderPath) {

  try {

    const fullPath = path.join(__dirname, folderPath);

    if (!fs.existsSync(fullPath)) return "";

    const files = fs.readdirSync(fullPath)
      .filter(f => f.endsWith(".txt"));

    let combined = "";

    for (const file of files) {

      const content = fs.readFileSync(
        path.join(fullPath, file),
        "utf8"
      );

      combined += "\n" + content;

    }

    return combined;

  } catch {

    return "";

  }

}

/* =========================
LOAD DATA
========================= */

const companyData = loadFileSafe("data/company.txt");

const infoData = loadFolderTxt("data/INFO");
const postData = loadFolderTxt("data/POST");
const techData = loadFolderTxt("data/CHEAK");

const promptInfo = loadFileSafe("data/prompt-info.txt");
const promptPost = loadFileSafe("data/prompt-post.txt");
const promptTech = loadFileSafe("data/prompt-tech.txt");

/* =========================
CALL DEEPSEEK
========================= */

async function callDeepseek(systemPrompt, userInput, temp = 0.4) {

  const response = await axios.post(
    "https://api.deepseek.com/chat/completions",
    {
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userInput }
      ],
      temperature: temp
    },
    {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );

  return response.data?.choices?.[0]?.message?.content || "AI ไม่สามารถตอบได้";

}

/* =========================
AUTH
========================= */

function checkAuth(req, res) {

  if (req.headers["x-internal-key"] !== INTERNAL_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }

  return true;

}

/* =========================
INFO ROUTE
========================= */

app.post("/info", upload.any(), async (req, res) => {

  try {

    if (!checkAuth(req, res)) return;

    const message = req.body.message || "";

    const systemPrompt = `
${companyData}

${infoData}

${promptInfo}
`;

    const reply = await callDeepseek(systemPrompt, message, 0.3);

    res.json({ reply });

  } catch (err) {

    console.error("INFO ERROR:", err);
    res.status(500).json({ error: "AI Error" });

  }

});

/* =========================
POST ROUTE
========================= */

app.post("/post", upload.any(), async (req, res) => {

  try {

    if (!checkAuth(req, res)) return;

    const message = req.body.message || "";

    const systemPrompt = `
${companyData}

${postData}

${promptPost}
`;

    const reply = await callDeepseek(systemPrompt, message, 0.5);

    res.json({ reply });

  } catch (err) {

    console.error("POST ERROR:", err);
    res.status(500).json({ error: "AI Error" });

  }

});

/* =========================
TECH ROUTE
========================= */

app.post("/check", upload.any(), async (req, res) => {

  try {

    if (!checkAuth(req, res)) return;

    const message = req.body.message || "";

    const systemPrompt = `
${companyData}

${techData}

${promptTech}
`;

    const reply = await callDeepseek(systemPrompt, message, 0.2);

    res.json({ reply });

  } catch (err) {

    console.error("CHECK ERROR:", err);
    res.status(500).json({ error: "AI Error" });

  }

});

/* =========================
START SERVER
========================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
