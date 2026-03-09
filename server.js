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
const VISION_KEY = process.env.VISION_KEY;
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
CALL DEEPSEEK (TEXT AI)
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
IMAGE ANALYSIS (OPENROUTER)
========================= */

async function analyzeImage(base64, mimeType) {

  if (!VISION_KEY) return "";

  try {

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "qwen/qwen2.5-vl-72b-instruct",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this commercial dishwasher repair photo. Identify visible machine parts, pumps, motors, heating elements, pipes, panels or possible damage."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64}`
                }
              }
            ]
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${VISION_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const text =
      response.data?.choices?.[0]?.message?.content || "";

    return text;

  } catch (err) {

    console.log("Vision error:", err.response?.data || err.message);
    return "";

  }

}

/* =========================
PROCESS IMAGES
========================= */

async function processImages(images) {

  const results = [];

  for (let i = 0; i < images.length; i++) {

    console.log("Analyzing image", i + 1);

    try {

      const response = await fetch(
        "https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-base",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.HF_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            inputs: images[i]
          })
        }
      );

      const data = await response.json();

      console.log("Vision result:", data);

      if (Array.isArray(data) && data[0]?.generated_text) {
        results.push(data[0].generated_text);
      } else {
        results.push("No description");
      }

    } catch (error) {

      console.error("Vision error:", error);
      results.push("Vision error");

    }

  }

  return results.join("\n");

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
