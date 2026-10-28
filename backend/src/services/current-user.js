const { repository: defaultRepository } = require("../repo");

async function getCurrentUser(req, repository = defaultRepository) {
  const requestedId = req.get?.("x-demo-user") || req.headers?.["x-demo-user"] || "demo-ioana";
  const user = await repository.getUser(String(requestedId));
  if (!user) {
    const error = new Error("Demo user not found.");
    error.status = 401;
    throw error;
  }
  return user;
}

module.exports = { getCurrentUser };