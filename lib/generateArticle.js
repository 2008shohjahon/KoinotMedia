import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL = "gemini-2.5-pro";

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is not configured`);
  return value;
}

function parseResponse(content) {
  const cleaned = String(content || "")
    .replace(/^```json\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return {
      title: "Koinot yangiliklari",
      dek: "Astronomiya olamidagi so‘nggi yangilik.",
      article: cleaned,
      factCheck: []
    };
  }
}

export async function generateArticle(newsItem) {
  const genAI = new GoogleGenerativeAI(required("GEMINI_API_KEY"));
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.7,
      maxOutputTokens: 3200
    }
  });

  const prompt = `Siz KOINOT MEDIA nashrining tajribali o‘zbek jurnalistisiz. Vazifangiz — astronomiya yangiligini o‘zbek tilida tabiiy, ravon va inson jurnalisti yozgandek yoritish. Ohang professional, qiziqarli, tushunarli va iliq-atmosferali bo‘lsin. Robotik iboralar, ortiqcha rasmiylik, clickbait va asossiz hayajondan saqlaning.

Faqat berilgan manba matnidagi tasdiqlangan faktlarga tayaning. Faktlarni sarlavha, sana, tashkilot, missiya nomi va ilmiy atamalar bo‘yicha sinchiklab tekshiring. Manbada yo‘q raqam, sana, iqtibos yoki xulosani o‘ylab topmang. Noaniq joylarni ehtiyotkor ifoda bilan yozing. Maqolani nashrga tayyor holatda qayta o‘qing va faktik xatolarni tuzating.

Quyidagi RSS yangiligi asosida maqola tayyorlang.

MANBA: ${newsItem.source}
Sarlavha: ${newsItem.title}
Sana: ${newsItem.publishedAt || "Ko‘rsatilmagan"}
URL: ${newsItem.link}
Qisqa mazmun: ${newsItem.summary}

Talablar:
- 500–750 so‘z atrofida tabiiy o‘zbekcha maqola yozing.
- Sarlavha aniq va jozibador, lekin clickbait bo‘lmasin.
- Kirish qismi o‘quvchini kosmik hodisaga olib kirsin; asosiy qismda faktlar va ilmiy kontekstni tushuntiring.
- Yakunda yangilikning ahamiyatini qisqa, iliq va mulohazali tarzda yakunlang.
- Matnda manba URL’ini alohida takrorlamang; u dastur tomonidan qo‘shiladi.
- Fakt-check natijasida muhim tekshirilgan faktlarni 2–5 bandda sanab o‘ting.

Faqat quyidagi JSON obyektini qaytaring:
{
  "title": "...",
  "dek": "1-2 jumlalik qisqa izoh",
  "article": "to‘liq maqola",
  "factCheck": ["tekshirilgan fakt 1", "tekshirilgan fakt 2"]}`;

  let result;
  try {
    result = await model.generateContent(prompt);
  } catch (err) {
    // Surface a clearer error for calling code/logs
    throw new Error(`Gemini API error: ${err?.message || String(err)}`);
  }

  // Try to extract text from several possible SDK response shapes.
  let content = null;
  try {
    if (result?.response && typeof result.response.text === "function") {
      content = result.response.text();
    } else if (typeof result?.response === "string") {
      content = result.response;
    } else if (Array.isArray(result?.output) && result.output.length) {
      // Common pattern: output[0].content or output[0].content[0].text
      const out = result.output[0].content;
      if (typeof out === "string") content = out;
      else if (Array.isArray(out) && out[0] && typeof out[0].text === "string") content = out[0].text;
      else if (out && typeof out.text === "string") content = out.text;
    } else if (Array.isArray(result?.candidates) && result.candidates[0]) {
      const cand = result.candidates[0];
      if (typeof cand === "string") content = cand;
      else if (cand?.content && typeof cand.content === "string") content = cand.content;
      else if (cand?.text && typeof cand.text === "string") content = cand.text;
    }
  } catch (e) {
    // ignore extraction errors and fall back to stringifying result
  }

  if (!content) {
    // Last resort: stringify a trimmed portion of the raw result to avoid empty returns
    try {
      content = JSON.stringify(result).slice(0, 20000);
    } catch (e) {
      content = String(result || "");
    }
  }

  const article = parseResponse(content);
  if (!article.title || !article.article) {
    throw new Error("Gemini response is missing title or article");
  }

  return {
    title: article.title.trim(),
    dek: String(article.dek || "").trim(),
    article: article.article.trim(),
    factCheck: Array.isArray(article.factCheck) ? article.factCheck.map(String).slice(0, 5) : [],
    source: newsItem.source,
    sourceUrl: newsItem.link,
    imageUrl: newsItem.imageUrl || null
  };
}
