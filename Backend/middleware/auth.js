import jwt from "jsonwebtoken";
import User from "../models/User.js";

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Not authorized, no token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }
    if (user.isBlocked) {
      return res
        .status(403)
        .json({ error: "Your account has been blocked by admin." });
    }

    req.userId = decoded.id;
    next();
  } catch (err) {
    res.status(401).json({ error: "Not authorized, invalid token" });
  }
};

export default protect;
