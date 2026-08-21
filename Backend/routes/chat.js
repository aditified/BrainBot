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

      const assistantReply = await getOpenAIAPIResponse(content);
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
      thread = new Thread({
        threadId,
        userId: req.userId,
        title: message,
        messages: [{ role: "user", content: message }],
      });
    } else {
      thread.messages.push({ role: "user", content: message });
    }

    let assistantReply = "";
    for await (const textChunk of streamGeminiResponse(message)) {
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
    sendStreamEvent(res, "error", {
      error: "Unable to generate a response. Please try again.",
    });
  } finally {
    res.end();
  }
});

export default router;
