import User from "../models/User.js";

const adminOnly = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);

    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: "Access denied. Admins only." });
    }

    next();
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to verify admin access" });
  }
};

export default adminOnly;
