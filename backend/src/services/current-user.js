const { repository: defaultRepository } = require("../repo");
const { createClient } = require("@supabase/supabase-js");

const supabaseAuth = process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

async function verifySupabaseToken(token) {
  if (!supabaseAuth) {
    const error = new Error("Configurează SUPABASE_URL și SUPABASE_ANON_KEY în backend/.env.");
    error.status = 503;
    throw error;
  }

  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data.user) {
    const invalidToken = new Error("Sesiunea nu este validă. Autentifică-te din nou.");
    invalidToken.status = 401;
    throw invalidToken;
  }
  return data.user;
}

async function getCurrentUser(req, repository = defaultRepository, tokenVerifier) {
  const authorization = req.get?.("authorization") || req.headers?.authorization || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    const requestedDemoId = req.get?.("x-demo-user") || req.headers?.["x-demo-user"];
    if (process.env.NODE_ENV === "test" && requestedDemoId) {
      const demoUser = await repository.getUser(String(requestedDemoId));
      if (demoUser) return demoUser;
    }
    const error = new Error("Autentificarea este necesară.");
    error.status = 401;
    throw error;
  }

  const verifier = tokenVerifier || req.app?.locals?.supabaseTokenVerifier || verifySupabaseToken;
  const authUser = await verifier(match[1]);
  if (!authUser?.id) {
    const error = new Error("Sesiunea nu este validă. Autentifică-te din nou.");
    error.status = 401;
    throw error;
  }

  const requestedDemoId = req.get?.("x-demo-user") || req.headers?.["x-demo-user"];
  if (requestedDemoId && process.env.NODE_ENV !== "production") {
    const demoUser = await repository.getUser(String(requestedDemoId));
    if (demoUser) return demoUser;
  }

  return repository.getOrCreateAuthUser(authUser);
}

module.exports = { getCurrentUser, verifySupabaseToken };