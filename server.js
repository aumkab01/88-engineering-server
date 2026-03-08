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
LOAD DATA FILES
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

  return response.data.choices?.[0]?.message?.content || "AI ไม่สามารถตอบได้";
}

/* =========================
GEMINI IMAGE ANALYSIS
========================= */

async function analyzeImage(base64, mimeType) {

  if (!GEMINI_KEY) return "";

  try {

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        contents: [
          {
            role: "user",
            parts: [
              {
                text: "Describe what you see in this image. Focus on dishwasher machines, pumps, motors, heating elements, control panels and error codes."
              },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64
                }
              }
            ]
          }
        ]
      }
    );

    const text =
      response.data?.candidates?.[0]?.content?.parts
        ?.map(p => p.text)
        .join(" ") || "";

    return text;

  } catch (err) {

    console.log("Gemini error:", err.response?.data || err.message);
    return "";

  }

}

/* =========================
PROCESS MULTIPLE IMAGES
========================= */

async function processImages(files) {

  let description = "";
  let previews = [];

  if (!files || files.length === 0)
    return { description, previews };

  const tasks = files.map(async (file, index) => {

    const base64 = file.buffer.toString("base64");
    const mimeType = file.mimetype;

    previews.push(`data:${mimeType};base64,${base64}`);

    const desc = await analyzeImage(base64, mimeType);

    if (!desc) {
      return `Image ${index + 1}: Unable to analyze image`;
    }

    return `Image ${index + 1}: ${desc}`;

  });

  const results = await Promise.all(tasks);

  description = results.join("\n");

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
INFO ROUTE
========================= */

app.post("/info", upload.any(), async (req, res) => {

  try {

    if (!checkAuth(req, res)) return;

    const message = req.body.message || "";
    const files = req.files || [];

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
    const files = req.files || [];

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

    console.error("POST ERROR:", err);
    res.status(500).json({ error: "AI Error" });

  }

});

/* =========================
CHECK MACHINE
========================= */

app.post("/check", upload.any(), async (req, res) => {

  try {

    if (!checkAuth(req, res)) return;

    const message = req.body.message || "";
    const files = req.files || [];

    const { description, previews } = await processImages(files);

    const systemPrompt = `
คุณคือผู้ช่วยช่างเครื่องล้างจานเชิงเทคนิค
ให้วิเคราะห์จากอาการและรูปภาพ
ตอบแบบช่างจริง
บอกสาเหตุที่เป็นไปได้
และขั้นตอนตรวจเช็ค
`;

    const finalInput = `
Machine Problem:
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
