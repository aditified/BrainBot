import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Thread from "../models/Thread.js";
import protect from "../middleware/auth.js";
import adminOnly from "../middleware/admin.js";

const router = express.Router();

/* ---------- DASHBOARD ---------- */
router.get("/dashboard", protect, adminOnly, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalThreads = await Thread.countDocuments();

    const threads = await Thread.find({}, "messages updatedAt userId");
    const totalMessages = threads.reduce(
      (sum, t) => sum + t.messages.length,
      0,
    );

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    let messagesToday = 0;
    const activeUserIds = new Set();
    threads.forEach((t) => {
      t.messages.forEach((m) => {
        if (new Date(m.timestamp) >= startOfToday) {
          messagesToday++;
          activeUserIds.add(String(t.userId));
        }
      });
    });

    const recentThreads = await Thread.find({})
      .sort({ updatedAt: -1 })
      .limit(5)
      .populate("userId", "name email");

    const recentActivity = recentThreads.map((t) => ({
      threadId: t.threadId,
      title: t.title,
      user: t.userId ? t.userId.name : "Unknown",
      updatedAt: t.updatedAt,
    }));

    res.json({
      totalUsers,
      totalConversations: totalThreads,
      totalMessages,
      messagesToday,
      activeUsersToday: activeUserIds.size,
      recentActivity,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

/* ---------- USERS ---------- */
router.get("/users", protect, adminOnly, async (req, res) => {
  const { search } = req.query;
  try {
    const query = search
      ? {
          $or: [
            { name: new RegExp(search, "i") },
            { email: new RegExp(search, "i") },
          ],
        }
      : {};
    const users = await User.find(query, "-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.get("/users/:userId", protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId, "-password");
    if (!user) return res.status(404).json({ error: "User not found" });

    const threadCount = await Thread.countDocuments({ userId: user._id });
    res.json({ ...user.toObject(), threadCount });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

/* ---------- BLOCK / UNBLOCK USER (updated) ---------- */
router.patch("/users/:userId/block", protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // 🔒 Prevent blocking admin accounts (including self-lockout)
    if (user.isAdmin) {
      return res.status(400).json({ error: "Cannot block an admin account" });
    }

    user.isBlocked = !user.isBlocked;
    await user.save();
    res.json({ isBlocked: user.isBlocked });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to update user" });
  }
});

router.delete("/users/:userId", protect, adminOnly, async (req, res) => {
  try {
    await Thread.deleteMany({ userId: req.params.userId });
    const deletedUser = await User.findByIdAndDelete(req.params.userId);
    if (!deletedUser) return res.status(404).json({ error: "User not found" });
    res.json({ success: "User and their threads deleted" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

/* ---------- CHAT HISTORY ---------- */
router.get("/threads", protect, adminOnly, async (req, res) => {
  const { search } = req.query;
  try {
    let threads = await Thread.find({})
      .sort({ updatedAt: -1 })
      .populate("userId", "name email");

    if (search) {
      const regex = new RegExp(search, "i");
      threads = threads.filter(
        (t) => regex.test(t.title) || (t.userId && regex.test(t.userId.name)),
      );
    }

    const result = threads.map((t) => ({
      threadId: t.threadId,
      title: t.title,
      user: t.userId ? { name: t.userId.name, email: t.userId.email } : null,
      messageCount: t.messages.length,
      updatedAt: t.updatedAt,
    }));

    res.json(result);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to fetch threads" });
  }
});

router.get("/threads/:threadId", protect, adminOnly, async (req, res) => {
  try {
    const thread = await Thread.findOne({
      threadId: req.params.threadId,
    }).populate("userId", "name email");
    if (!thread) return res.status(404).json({ error: "Thread not found" });
    res.json(thread);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to fetch thread" });
  }
});

router.delete("/threads/:threadId", protect, adminOnly, async (req, res) => {
  try {
    const deleted = await Thread.findOneAndDelete({
      threadId: req.params.threadId,
    });
    if (!deleted) return res.status(404).json({ error: "Thread not found" });
    res.json({ success: "Thread deleted" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to delete thread" });
  }
});

/* ---------- ANALYTICS ---------- */
router.get("/analytics", protect, adminOnly, async (req, res) => {
  try {
    const threads = await Thread.find({}, "messages updatedAt userId").populate(
      "userId",
      "name",
    );

    // messages per day, last 7 days
    const dayBuckets = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dayBuckets[key] = 0;
    }

    const userMessageCounts = {};

    threads.forEach((t) => {
      t.messages.forEach((m) => {
        const key = new Date(m.timestamp).toISOString().slice(0, 10);
        if (key in dayBuckets) dayBuckets[key]++;
      });
      const uname = t.userId ? t.userId.name : "Unknown";
      userMessageCounts[uname] =
        (userMessageCounts[uname] || 0) + t.messages.length;
    });

    const mostActiveUsers = Object.entries(userMessageCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    res.json({
      messagesPerDay: Object.entries(dayBuckets).map(([date, count]) => ({
        date,
        count,
      })),
      mostActiveUsers,
      totalConversations: threads.length,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

/* ---------- ADMIN PROFILE ---------- */
router.put("/profile", protect, adminOnly, async (req, res) => {
  const { name, currentPassword, newPassword } = req.body;
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (name) user.name = name;

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: "Current password required" });
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }
      user.password = await bcrypt.hash(newPassword, 10);
    }

    await user.save();
    res.json({ name: user.name, email: user.email });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

export default router;
