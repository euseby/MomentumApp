const express = require("express");
const { getCurrentUser } = require("../services/current-user");
const { addLedgerEntry, getWalletBalances } = require("../services/ledger");

const ALLOWED_AMOUNTS = new Set([50, 100, 200]);

function createStripeRouter(repository, stripeClient, frontendUrl = process.env.FRONTEND_URL || "http://localhost:8080") {
  const router = express.Router();
  const mockEnabled = !stripeClient && process.env.NODE_ENV !== "production" && process.env.ALLOW_MOCK_TOPUP !== "false";

  router.get("/api/stripe/config", (req, res) => {
    res.json({ stripeEnabled: Boolean(stripeClient), mockEnabled });
  });

  router.post("/api/stripe/checkout", async (req, res) => {
    try {
      const user = await getCurrentUser(req, repository);
      if (!stripeClient) return res.status(503).json({ error: "Stripe test mode nu este configurat." });
      const amountRon = Number(req.body?.amountRon);
      if (!ALLOWED_AMOUNTS.has(amountRon)) return res.status(400).json({ error: "Alege o sumă de 50, 100 sau 200 RON." });

      const session = await stripeClient.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "ron",
            product_data: { name: "Alimentare portofel Oasis (simulat)" },
            unit_amount: amountRon * 100,
          },
          quantity: 1,
        }],
        metadata: { userId: user.id, amountRon: String(amountRon), currency: "RON_SIM" },
        success_url: `${frontendUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendUrl}/dashboard?stripe=cancel`,
      });
      return res.json({ url: session.url, sessionId: session.id });
    } catch (error) {
      return res.status(error.status || 502).json({ error: error.status ? "Utilizator demo necunoscut." : "Nu am putut crea sesiunea Stripe." });
    }
  });

  router.get("/api/stripe/confirm", async (req, res) => {
    try {
      const user = await getCurrentUser(req, repository);
      if (!stripeClient) return res.status(503).json({ error: "Stripe test mode nu este configurat." });
      const sessionId = String(req.query.session_id || "");
      if (!sessionId) return res.status(400).json({ error: "session_id este obligatoriu." });
      const session = await stripeClient.checkout.sessions.retrieve(sessionId);
      if (session.metadata?.userId !== user.id || session.metadata?.currency !== "RON_SIM") {
        return res.status(403).json({ error: "Sesiunea nu aparține acestui portofel." });
      }
      if (session.payment_status !== "paid") return res.status(402).json({ error: "Plata test nu este confirmată." });
      const amountRon = Number(session.metadata.amountRon);
      if (!ALLOWED_AMOUNTS.has(amountRon)) return res.status(400).json({ error: "Suma sesiunii nu este permisă." });

      await addLedgerEntry(repository, {
        userId: user.id,
        currency: "RON_SIM",
        amount: amountRon,
        kind: "stripe_test_topup",
        refType: "stripe_session",
        refId: session.id,
        idempotencyKey: `stripe:${session.id}:ron-sim`,
      });
      return res.json({ confirmed: true, balances: await getWalletBalances(repository, user.id) });
    } catch (error) {
      return res.status(error.status || 502).json({ error: error.status ? error.message : "Nu am putut confirma sesiunea Stripe." });
    }
  });

  router.post("/api/stripe/mock-topup", async (req, res) => {
    try {
      const user = await getCurrentUser(req, repository);
      if (!mockEnabled) return res.status(404).json({ error: "Alimentarea demo nu este disponibilă." });
      const amountRon = Number(req.body?.amountRon);
      const idempotencyKey = req.body?.idempotencyKey;
      if (typeof idempotencyKey !== "string" || !idempotencyKey.trim()) {
        return res.status(400).json({ error: "idempotencyKey este obligatoriu." });
      }
      if (!ALLOWED_AMOUNTS.has(amountRon)) return res.status(400).json({ error: "Alege o sumă de 50, 100 sau 200 RON." });
      await addLedgerEntry(repository, {
        userId: user.id,
        currency: "RON_SIM",
        amount: amountRon,
        kind: "mock_test_topup",
        refType: "mock_checkout",
        refId: String(idempotencyKey || ""),
        idempotencyKey: `mock-topup:${String(idempotencyKey || "")}`,
      });
      return res.json({ confirmed: true, simulated: true, balances: await getWalletBalances(repository, user.id) });
    } catch (error) {
      return res.status(error.status || 502).json({ error: error.status ? error.message : "Nu am putut confirma alimentarea simulată." });
    }
  });

  return router;
}

module.exports = { createStripeRouter, ALLOWED_AMOUNTS };
