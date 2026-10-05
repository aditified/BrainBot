import express from "express";
import Thread from "../models/Thread.js";
import getOpenAIAPIResponse, { streamGeminiResponse } from "../utils/openai.js";
import protect from "../middleware/auth.js";

const router = express.Router();

// Get all threads for the logged-in user only
router.get("/thread", protect, async (req, res) => {
  try {
    const threads = await Thread.find({ userId: req.userId }).sort({
      updatedAt: -1,
    });
    res.json(threads);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to fetch threads" });
  }
});

router.get("/thread/:threadId", protect, async (req, res) => {
  const { threadId } = req.params;

  try {
    const thread = await Thread.findOne({ threadId, userId: req.userId });

    if (!thread) {
      return res.status(404).json({ error: "Thread not found" });
    }

    res.json(thread.messages);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to fetch chat" });
  }
});

const formatHistoryForGemini = (messages, maxTurns = 30) => {
  const geminiContents = messages
    .filter((m) => m.content && m.content.trim())
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  let history = geminiContents.slice(-maxTurns);
  while (history.length > 0 && history[0].role !== "user") {
    history.shift();
  }
  return history;
};

router.put(
  "/thread/:threadId/message/:messageId",
  protect,
  async (req, res) => {
    const { threadId, messageId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: "Missing updated content" });
    }

    try {
      const thread = await Thread.findOne({ threadId, userId: req.userId });

      if (!thread) {
        return res.status(404).json({ error: "Thread not found" });
      }

      const msgIndex = thread.messages.findIndex(
        (msg) => msg._id.toString() === messageId,
      );

      if (msgIndex === -1) {
        return res.status(404).json({ error: "Message not found" });
      }

      thread.messages = thread.messages.slice(0, msgIndex);
      thread.messages.push({ role: "user", content });

      const history = formatHistoryForGemini(thread.messages);
      const assistantReply = await getOpenAIAPIResponse(history);
      thread.messages.push({ role: "assistant", content: assistantReply });

      thread.updatedAt = new Date();
      await thread.save();

      res.json({ reply: assistantReply, messages: thread.messages });
    } catch (err) {
      console.log(err);
      res.status(500).json({ error: "Failed to update message" });
    }
  },
);

router.delete("/thread/:threadId", protect, async (req, res) => {
  const { threadId } = req.params;

  try {
    const deletedThread = await Thread.findOneAndDelete({
      threadId,
      userId: req.userId,
    });

    if (!deletedThread) {
      return res.status(404).json({ error: "Thread not found" });
    }

    res.status(200).json({ success: "Thread deleted successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to delete thread" });
  }
});

const sendStreamEvent = (res, event, data) => {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
};

router.post("/chat", protect, async (req, res) => {
  const { threadId, message } = req.body;

  if (!threadId || !message) {
    return res.status(400).json({ error: "missing required fields" });
  }

  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();

  try {
    let thread = await Thread.findOne({ threadId, userId: req.userId });

    if (!thread) {
      const generatedTitle =
        message.length > 45 ? `${message.slice(0, 42).trim()}...` : message;
      thread = new Thread({
        threadId,
        userId: req.userId,
        title: generatedTitle,
        messages: [{ role: "user", content: message }],
      });
    } else {
      thread.messages.push({ role: "user", content: message });
    }

    const conversationHistory = formatHistoryForGemini(thread.messages);

    let assistantReply = "";
    for await (const textChunk of streamGeminiResponse(conversationHistory)) {
      assistantReply += textChunk;
      sendStreamEvent(res, "delta", { text: textChunk });
    }

    if (!assistantReply) {
      throw new Error("Gemini returned an empty streamed response");
    }

    thread.messages.push({ role: "assistant", content: assistantReply });
    thread.updatedAt = new Date();

    await thread.save();
    sendStreamEvent(res, "done", {
      reply: assistantReply,
      messages: thread.messages,
    });
  } catch (err) {
    console.log(err);
    const errStr = (err?.message || "") + " " + (err?.raw || "");
    let errorMessage = "Unable to generate a response. Please try again.";

    if (
      err.status === 429 ||
      errStr.includes("429") ||
      errStr.includes("RESOURCE_EXHAUSTED") ||
      errStr.toLowerCase().includes("quota")
    ) {
      errorMessage =
        "You have hit your daily limit. Please try again 24 hours later.";
    }

    sendStreamEvent(res, "error", {
      error: errorMessage,
    });
  } finally {
    res.end();
  }
});

export default router;
