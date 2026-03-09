const express = require("express");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const cors = require("cors");
const axios = require("axios");
const multer = require("multer");

dotenv.config();

const app = express();

app.use(express.json({ limit: "50mb" }));
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
  console.error("❌ POST_API_KEY not found in ENV");
  process.exit(1);
}

/* =========================
LOAD FILE SAFE
========================= */

function loadFileSafe(filePath) {

  try {

    const full = path.join(__dirname, filePath);

    if (!fs.existsSync(full)) {
      console.log("⚠ file missing:", filePath);
      return "";
    }

    return fs.readFileSync(full, "utf8");

  } catch (err) {

    console.log("⚠ file load error:", filePath);
    return "";

  }

}

/* =========================
LOAD TXT RECURSIVE
อ่านไฟล์ใน subfolder ได้
========================= */

function loadFolderTxtRecursive(folderPath) {

  const fullPath = path.join(__dirname, folderPath);

  if (!fs.existsSync(fullPath)) {
    console.log("⚠ folder missing:", folderPath);
    return "";
  }

  let combined = "";

  function readDir(dir) {

    const items = fs.readdirSync(dir);

    for (const item of items) {

      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {

        readDir(itemPath);

      } else if (item.endsWith(".txt")) {

        try {

          const content = fs.readFileSync(itemPath, "utf8");

          combined += `\n\n===== ${item} =====\n\n${content}`;

        } catch (err) {

          console.log("⚠ read error:", item);

        }

      }

    }

  }

  readDir(fullPath);

  return combined;

}

/* =========================
LOAD KNOWLEDGE BASE
========================= */

console.log("Loading knowledge base...");

const companyData = loadFileSafe("data/company.txt");

const infoData = loadFolderTxtRecursive("data/INFO");
const postData = loadFolderTxtRecursive("data/POST");

/* เปลี่ยนจาก CHEAK → TECH */
const techData = loadFolderTxtRecursive("data/TECH");

const promptInfo = loadFileSafe("data/prompt-info.txt");
const promptPost = loadFileSafe("data/prompt-post.txt");
const promptTech = loadFileSafe("data/prompt-tech.txt");

console.log("Knowledge loaded");

/* =========================
CALL AI
========================= */

async function callDeepseek(systemPrompt, userInput, temp = 0.4) {

  try {

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
        },
        timeout: 60000
      }
    );

    return response.data?.choices?.[0]?.message?.content || "AI ไม่สามารถตอบได้";

  } catch (err) {

    console.log("❌ DeepSeek error");

    if (err.response) {
      console.log(err.response.data);
    } else {
      console.log(err.message);
    }

    return "AI server error";

  }

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

  if (!checkAuth(req, res)) return;

  const message = req.body.message || "";

  const systemPrompt = `
${companyData}

${infoData}

${promptInfo}
`;

  const reply = await callDeepseek(systemPrompt, message, 0.3);

  res.json({ reply });

});

/* =========================
POST ROUTE
========================= */

app.post("/post", upload.any(), async (req, res) => {

  if (!checkAuth(req, res)) return;

  const message = req.body.message || "";

  const systemPrompt = `
${companyData}

${postData}

${promptPost}
`;

  const reply = await callDeepseek(systemPrompt, message, 0.5);

  res.json({ reply });

});

/* =========================
TECH ROUTE
========================= */

app.post("/tech", upload.any(), async (req, res) => {

  if (!checkAuth(req, res)) return;

  const message = req.body.message || "";

  const systemPrompt = `
${companyData}

${techData}

${promptTech}
`;

  const reply = await callDeepseek(systemPrompt, message, 0.2);

  res.json({ reply });

});

/* =========================
SERVER START
========================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log("=================================");
  console.log("88 Engineering AI Server Started");
  console.log("PORT:", PORT);
  console.log("=================================");

});
