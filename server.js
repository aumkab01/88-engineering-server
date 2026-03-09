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
  console.error("❌ POST_API_KEY not found in ENV");
  process.exit(1);
}

/* =========================
CONFIG
========================= */

const MAX_PROMPT_LENGTH = 15000;

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
LOAD TXT FROM FOLDER
========================= */

function loadFolderTxt(folderPath) {

  try {

    const fullPath = path.join(__dirname, folderPath);

    if (!fs.existsSync(fullPath)) {
      console.log("⚠ folder missing:", folderPath);
      return "";
    }

    const files = fs.readdirSync(fullPath)
      .filter(f => f.endsWith(".txt"))
      .sort();

    if (files.length === 0) {
      console.log("⚠ no txt files:", folderPath);
      return "";
    }

    let combined = "";

    for (const file of files) {

      const filePath = path.join(fullPath, file);

      try {

        const content = fs.readFileSync(filePath, "utf8");

        combined += "\n\n" + content;

      } catch {

        console.log("⚠ read error:", file);

      }

    }

    return combined;

  } catch (err) {

    console.log("⚠ folder read error:", err.message);
    return "";

  }

}

/* =========================
PROMPT LIMITER
========================= */

function trimPrompt(text) {

  if (!text) return "";

  if (text.length > MAX_PROMPT_LENGTH) {

    console.log("⚠ prompt trimmed");

    return text.slice(0, MAX_PROMPT_LENGTH);

  }

  return text;

}

/* =========================
LOAD KNOWLEDGE
========================= */

console.log("Loading knowledge base...");

const companyData = loadFileSafe("data/company.txt");

const infoData = loadFolderTxt("data/INFO");
const postData = loadFolderTxt("data/POST");
const techData = loadFolderTxt("data/CHEAK");

const promptInfo = loadFileSafe("data/prompt-info.txt");
const promptPost = loadFileSafe("data/prompt-post.txt");
const promptTech = loadFileSafe("data/prompt-tech.txt");

console.log("Knowledge loaded");

/* =========================
DEEPSEEK CALL
========================= */

async function callDeepseek(systemPrompt, userInput, temp = 0.4) {

  const MAX_PROMPT = 15000;

  if(systemPrompt.length > MAX_PROMPT){
    console.log("⚠ prompt trimmed");
    systemPrompt = systemPrompt.slice(-MAX_PROMPT);
  }

  try{

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
        timeout: 30000
      }
    );

    return response.data?.choices?.[0]?.message?.content || "AI ไม่สามารถตอบได้";

  }catch(err){

    console.log("❌ DeepSeek error");

    if(err.response){
      console.log(err.response.data);
    }else{
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

    console.log("INFO ROUTE ERROR:", err.message);

    res.status(500).json({ error: "AI error" });

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

    console.log("POST ROUTE ERROR:", err.message);

    res.status(500).json({ error: "AI error" });

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

    console.log("CHECK ROUTE ERROR:", err.message);

    res.status(500).json({ error: "AI error" });

  }

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

