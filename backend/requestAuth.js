const jwt = require("jsonwebtoken");

function createRequestAuthHelpers({ jwtSecret, normalizeEmail }) {
  function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Access token required" });
    }

    jwt.verify(token, jwtSecret, (err, user) => {
      if (err) {
        if (err.name === "TokenExpiredError") {
          return res.status(401).json({ message: "Token expired" });
        }
        return res.status(401).json({ message: "Invalid token" });
      }

      req.user = user;
      next();
    });
  }

  function getTokenUserFromRequest(req) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return { user: null, error: null };
    }

    try {
      const user = jwt.verify(token, jwtSecret);
      return { user, error: null };
    } catch (error) {
      if (error?.name === "TokenExpiredError") {
        return { user: null, error: { status: 401, message: "Token expired" } };
      }

      return { user: null, error: { status: 401, message: "Invalid token" } };
    }
  }

  function resolveRequestUserEmail(req, { allowBodyUserEmail = false } = {}) {
    const tokenResult = getTokenUserFromRequest(req);
    if (tokenResult.error) {
      return tokenResult;
    }

    const tokenEmail = String(tokenResult.user?.email || "").trim();
    if (tokenEmail) {
      return { user: tokenResult.user, email: normalizeEmail(tokenEmail), error: null };
    }

    const headerEmail = String(req.headers["x-user-email"] || "").trim();
    if (headerEmail) {
      return { user: null, email: normalizeEmail(headerEmail), error: null };
    }

    if (allowBodyUserEmail) {
      const bodyEmail = String(req.body?.userEmail || "").trim();
      if (bodyEmail) {
        return { user: null, email: normalizeEmail(bodyEmail), error: null };
      }
    }

    return { user: null, email: "", error: null };
  }

  return {
    authenticateToken,
    getTokenUserFromRequest,
    resolveRequestUserEmail,
  };
}

module.exports = {
  createRequestAuthHelpers,
};