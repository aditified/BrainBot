// import "dotenv/config";

// const getOpenAIAPIResponse = async (message) => {
//   const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

//   const options = {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//     },
//     body: JSON.stringify({
//       contents: [
//         {
//           parts: [{ text: message }],
//         },
//       ],
//     }),
//   };

//   try {
//     const response = await fetch(url, options);
//     const data = await response.json();

//     console.log("Gemini raw response:", JSON.stringify(data, null, 2)); // keep for now, remove once confirmed working

//     if (!data.candidates || !data.candidates[0]) {
//       console.log("Unexpected Gemini response:", data);
//       return "Sorry, I couldn't generate a response right now.";
//     }

//     return data.candidates[0].content.parts[0].text;
//   } catch (err) {
//     console.log(err);
//     return "Something went wrong while contacting the AI.";
//   }
// };

// export default getOpenAIAPIResponse;
import "dotenv/config";

const GEMINI_MODEL = "gemini-3.6-flash";

const getGeminiUrl = (method, streaming = false) => {
  const suffix = streaming ? "?alt=sse" : "";
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:${method}${suffix}`;
};

const getOpenAIAPIResponse = async (message, retries = 2) => {
  const url = `${getGeminiUrl("generateContent")}?key=${process.env.GEMINI_API_KEY}`;

  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: message }],
        },
      ],
    }),
  };

  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!data.candidates || !data.candidates[0]) {
      // Retry on temporary overload (503) or rate limit (429)
      if (
        (data.error?.code === 503 || data.error?.code === 429) &&
        retries > 0
      ) {
        console.log(`Gemini busy, retrying... (${retries} left)`);
        await new Promise((r) => setTimeout(r, 1500)); // wait 1.5s
        return getOpenAIAPIResponse(message, retries - 1);
      }

      console.log("Unexpected Gemini response:", data);
      return "Sorry, I couldn't generate a response right now.";
    }

    return data.candidates[0].content.parts[0].text;
  } catch (err) {
    console.log(err);
    return "Something went wrong while contacting the AI.";
  }
};

export default getOpenAIAPIResponse;

// Gemini sends streamGenerateContent responses as server-sent events. This
// generator yields only text deltas so the API route can forward them safely.
export async function* streamGeminiResponse(message) {
  const response = await fetch(
    `${getGeminiUrl("streamGenerateContent", true)}&key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: message }] }],
      }),
    },
  );

  if (!response.ok || !response.body) {
    const errorText = await response.text();
    throw new Error(`Gemini streaming request failed (${response.status}): ${errorText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const processEvent = (event) => {
    const dataLine = event
      .split("\n")
      .find((line) => line.startsWith("data:"));

    if (!dataLine) return null;

    const data = JSON.parse(dataLine.slice(5).trim());
    return data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("") || null;
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder
      .decode(value || new Uint8Array(), { stream: !done })
      .replace(/\r\n/g, "\n");

    let separatorIndex;
    while ((separatorIndex = buffer.indexOf("\n\n")) !== -1) {
      const event = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      const text = processEvent(event);
      if (text) yield text;
    }

    if (done) break;
  }

  const finalText = processEvent(buffer);
  if (finalText) yield finalText;
}
