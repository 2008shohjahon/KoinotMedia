import fetch from "node-fetch";

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is not configured`);
  return value;
}

function htmlEscape(value = "") {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
}

function chunks(text, size = 3900) {
  const result = [];
  let remaining = String(text || "");
  while (remaining.length > size) {
    let splitAt = remaining.lastIndexOf("\n", size);
    if (splitAt < 500) splitAt = size;
    result.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  if (remaining) result.push(remaining);
  return result;
}

async function telegram(method, body) {
  const token = required("BOT_TOKEN");
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000)
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(`Telegram ${method} failed: ${data.description || response.status}`);
  return data.result;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function sendArticleToTelegram(article) {
  const chatId = required("CHANNEL_ID");
  const title = htmlEscape(article.title);
  const dek = htmlEscape(article.dek);
  const caption = `<b>${title}</b>${dek ? `\n\n${dek}` : ""}`.slice(0, 1024);
  let imageSent = false;

  if (article.imageUrl) {
    try {
      await telegram("sendPhoto", { chat_id: chatId, photo: article.imageUrl, caption, parse_mode: "HTML" });
      imageSent = true;
    } catch (error) {
      console.error(JSON.stringify({ event: "telegram_photo_failed", title: article.title, error: error.message }));
    }
  }

  if (!imageSent) {
    await telegram("sendMessage", { chat_id: chatId, text: caption, parse_mode: "HTML", disable_web_page_preview: false });
  }

  await wait(500);
  const body = [
    article.article,
    "",
    `Manba: ${article.source}`,
    article.sourceUrl,
    article.factCheck?.length ? `\nFakt-chek: ${article.factCheck.join("; ")}` : ""
  ].filter(Boolean).join("\n");

  for (const part of chunks(body)) {
    await telegram("sendMessage", { chat_id: chatId, text: part, disable_web_page_preview: true });
    await wait(500);
  }

  return { imageSent, title: article.title };
}

export { telegram };
