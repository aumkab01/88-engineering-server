const express = require("express");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static("public"));

/* =========================
   โหลด ENV
========================= */
dotenv.config();

const INTERNAL_KEY = "88ENG2025";
const API_KEY = process.env.INFO_API_KEY;   // ใช้ตัวเดียวทั้งระบบ

if (!API_KEY) {
  console.error("❌ INFO_API_KEY not found in environment variables");
  process.exit(1);
}

/* =========================
   โหลดไฟล์ Prompt
========================= */
const companyData = fs.readFileSync(
  path.join(__dirname, "data/company.txt"),
  "utf8"
);

const promptInfo = fs.readFileSync(
  path.join(__dirname, "data/prompt-info.txt"),
  "utf8"
);

const promptPost = fs.readFileSync(
  path.join(__dirname, "data/prompt-post.txt"),
  "utf8"
);

/* =========================
   FUNCTION เรียก DeepSeek
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
      temperature: temperature
    },
    {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      }
    }
  );

  return response.data.choices[0].message.content;
}

/* =========================
   ROUTE : /info
========================= */
app.post("/info", async (req, res) => {
  try {

    if (req.headers["x-internal-key"] !== INTERNAL_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }

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
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "DeepSeek API Error" });
  }
});

/* =========================
   ROUTE : /post
========================= */
app.post("/post", async (req, res) => {
  try {

    if (req.headers["x-internal-key"] !== INTERNAL_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }

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
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "DeepSeek API Error" });
  }
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
