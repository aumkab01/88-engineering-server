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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

/* =========================
ENV CONFIG
========================= */

const API_KEY = process.env.POST_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
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
SAFE FILE LOADER
========================= */

function loadFileSafe(filePath) {
  try {
    return fs.readFileSync(path.join(__dirname, filePath), "utf8");
  } catch {
    return "";
  }
}

/* =========================
LOAD DATA
========================= */

const companyData = loadFileSafe("data/company.txt");
const promptInfo = loadFileSafe("data/prompt-info.txt");
const promptPost = loadFileSafe("data/prompt-post.txt");

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
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`
      }
    }
  );

  return response.data.choices[0].message.content;

}

/* =========================
GEMINI IMAGE ANALYSIS
========================= */

async function analyzeImage(base64) {

  if (!GEMINI_KEY) return "";

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      contents: [
        {
          parts: [
            {
              text: "Describe this image briefly. Focus on machines, control panels, mechanical parts, and error displays."
            },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64
              }
            }
          ]
        }
      ]
    }
  );

  return response.data.candidates[0].content.parts[0].text;

}

/* =========================
PROCESS MULTIPLE IMAGES
========================= */

async function processImages(files) {

  let description = "";
  let previews = [];

  if (!files || files.length === 0)
    return { description, previews };

  for (let i = 0; i < files.length; i++) {

    const base64 = files[i].buffer.toString("base64");

    previews.push(`data:${files[i].mimetype};base64,${base64}`);

    const desc = await analyzeImage(base64);

    description += `Image ${i + 1}: ${desc}\n`;

  }

  return { description, previews };

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
INFO
========================= */

app.post("/info", upload.array("images", 5), async (req, res) => {

  try {

    if (!checkAuth(req, res)) return;

    const message = req.body.message;
    const files = req.files;

    const { description, previews } = await processImages(files);

    const systemPrompt = `
${promptInfo}

Company Info
${companyData}
`;

    const finalInput = `
User Question:
${message}

Images Context:
${description}
`;

    const reply = await callDeepseek(systemPrompt, finalInput, 0.3);

    res.json({
      reply,
      images: previews
    });

  } catch (err) {

    console.log(err.message);
    res.status(500).json({ error: "AI Error" });

  }

});

/* =========================
POST
========================= */

app.post("/post", upload.array("images", 5), async (req, res) => {

  try {

    if (!checkAuth(req, res)) return;

    const message = req.body.message;
    const files = req.files;

    const { description, previews } = await processImages(files);

    const systemPrompt = `
${promptPost}

Company Info
${companyData}
`;

    const finalInput = `
User Request:
${message}

Images Context:
${description}
`;

    const reply = await callDeepseek(systemPrompt, finalInput, 0.5);

    res.json({
      reply,
      images: previews
    });

  } catch (err) {

    console.log(err.message);
    res.status(500).json({ error: "AI Error" });

  }

});

/* =========================
CHECK MACHINE
========================= */

app.post("/check", upload.array("images", 5), async (req, res) => {

  try {

    if (!checkAuth(req, res)) return;

    const message = req.body.message;
    const files = req.files;

    const { description, previews } = await processImages(files);

    const systemPrompt = `
คุณคือผู้ช่วยช่างเครื่องล้างจาน
ให้วิเคราะห์อาการและแนะนำการตรวจสอบ
`;

    const finalInput = `
User Problem:
${message}

Images Context:
${description}
`;

    const reply = await callDeepseek(systemPrompt, finalInput, 0.2);

    res.json({
      reply,
      images: previews
    });

  } catch (err) {

    console.log(err.message);
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
