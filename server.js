const express = require("express");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const cors = require("cors");
const axios = require("axios");

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static("public"));

/* =========================
   ENV CONFIG
========================= */

const API_KEY = process.env.POST_API_KEY;
const INTERNAL_KEY = process.env.INTERNAL_KEY || "88ENG2025";

if (!API_KEY) {
  console.error("❌ POST_API_KEY not found in environment variables");
  process.exit(1);
}

/* =========================
   BASIC ROUTES
========================= */

app.get("/", (req, res) => {
  res.send("88 Engineering AI Server is running");
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
  } catch (err) {
    console.error("❌ Missing file:", filePath);
    return "";
  }
}

/* =========================
   LOAD DATA FILES
========================= */

const companyData = loadFileSafe("data/company.txt");
const promptInfo = loadFileSafe("data/prompt-info.txt");
const promptPost = loadFileSafe("data/prompt-post.txt");
const promptTech = loadFileSafe("data/prompt-tech.txt");
const productSpecs = loadFileSafe("data/product-specs.txt");
const technicalData = loadFileSafe("data/technical-data.txt");

/* =========================
   CALL DEEPSEEK
========================= */

async function callDeepseek(systemPrompt, userInput, temperature = 0.4) {
  const response = await axios.post(
    "https://api.deepseek.com/chat/completions",
    {
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userInput }
      ],
      temperature
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
   AUTH CHECK
========================= */

function checkAuth(req, res) {
  if (req.headers["x-internal-key"] !== INTERNAL_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

/* =========================
   ROUTE : /info
========================= */

app.post("/info", async (req, res) => {
  try {
    if (!checkAuth(req, res)) return;

    const userInput = req.body.message;
    if (!userInput || userInput.length > 1500) {
      return res.status(400).json({ error: "Invalid input" });
    }

    const systemPrompt = `
${promptInfo}

========================
ข้อมูลบริษัท
========================
${companyData}
`;

    const reply = await callDeepseek(systemPrompt, userInput, 0.3);
    res.json({ reply });

  } catch (err) {
    console.error("INFO ERROR:", err.response?.data || err.message);
    res.status(500).json({ error: "DeepSeek API Error" });
  }
});

/* =========================
   ROUTE : /post
========================= */

app.post("/post", async (req, res) => {
  try {
    if (!checkAuth(req, res)) return;

    const userInput = req.body.message;
    if (!userInput || userInput.length > 1500) {
      return res.status(400).json({ error: "Invalid input" });
    }

    const systemPrompt = `
${promptPost}

========================
ข้อมูลบริษัท
========================
${companyData}
`;

    const reply = await callDeepseek(systemPrompt, userInput, 0.5);
    res.json({ reply });

  } catch (err) {
    console.error("POST ERROR:", err.response?.data || err.message);
    res.status(500).json({ error: "DeepSeek API Error" });
  }
});

/* =========================
   ROUTE : /tech
========================= */

app.post("/tech", async (req, res) => {
  try {
    if (!checkAuth(req, res)) return;

    const userInput = req.body.message;
    if (!userInput || userInput.length > 2000) {
      return res.status(400).json({ error: "Invalid input" });
    }

    const systemPrompt = `
${promptTech}

========================
ข้อมูลบริษัท
========================
${companyData}

========================
สเปคสินค้า
========================
${productSpecs}

========================
ข้อมูลเทคนิคเพิ่มเติม
========================
${technicalData}
`;

    const reply = await callDeepseek(systemPrompt, userInput, 0.2);
    res.json({ reply });

  } catch (err) {
    console.error("TECH ERROR:", err.response?.data || err.message);
    res.status(500).json({ error: "DeepSeek API Error" });
  }
});

/* =========================
   ROUTE : /check
========================= */

app.post("/check", async (req, res) => {
  try {
    if (!checkAuth(req, res)) return;

    const userInput = req.body.message;
    if (!userInput) {
      return res.status(400).json({ error: "Invalid input" });
    }

    const systemPrompt = `
คุณคือระบบช่วยช่างตรวจสอบอาการเครื่องล้างจาน
ให้วิเคราะห์อาการและแนะนำขั้นตอนตรวจสอบเป็นลำดับขั้น
`;

    const reply = await callDeepseek(systemPrompt, userInput, 0.2);
    res.json({ reply });

  } catch (err) {
    console.error("CHECK ERROR:", err.response?.data || err.message);
    res.status(500).json({ error: "DeepSeek API Error" });
  }
});

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT);
});
