const { parse } = require("csv-parse/sync");
const pdfParse = require("pdf-parse");
const categoryRules = require("../rules/categories.json");

const HEADER_SYNONYMS = {
  date: ["data", "date", "transaction date", "booking date"],
  description: ["descriere", "detalii tranzactie", "detalii", "description", "beneficiar", "merchant", "payee"],
  amount: ["suma", "amount", "valoare", "transaction amount"],
  debit: ["debit", "withdrawal", "cheltuiala"],
  credit: ["credit", "deposit", "incasare"],
};

const fold = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

function parseDate(value) {
  const text = String(value || "").trim();
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  match = text.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  return null;
}

function parseAmount(value) {
  let text = String(value || "").trim().replace(/\s/g, "").replace(/[RON€]/gi, "");
  if (!text) return null;
  const negative = /^\(.*\)$/.test(text) || text.startsWith("-");
  text = text.replace(/[()]/g, "").replace(/^[+-]/, "");
  const comma = text.lastIndexOf(",");
  const dot = text.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    const decimal = comma > dot ? "," : ".";
    text = text.replace(decimal === "," ? /\./g : /,/g, "").replace(decimal, ".");
  } else if (comma >= 0) {
    text = text.replace(/\./g, "").replace(",", ".");
  }
  const number = Number(text);
  if (!Number.isFinite(number)) return null;
  return negative ? -Math.abs(number) : number;
}

function normalizeMerchant(description) {
  const folded = fold(description);
  if (/\b(transfer|virament)\b/.test(folded)) return "Transfer";
  return folded
    .replace(/\b(plata pos|cumparare pos|card payment|pos)\b/g, " ")
    .replace(/\b(terminal|term|id)\s*\d+\b/g, " ")
    .replace(/\b(bucuresti|cluj|iasi|timisoara|brasov|romania)\b/g, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "Necunoscut";
}

function categorize(merchant) {
  const normalized = fold(merchant);
  for (const [category, patterns] of Object.entries(categoryRules)) {
    if (category === "altele") continue;
    if (patterns.some((pattern) => new RegExp(pattern, "i").test(normalized))) return category;
  }
  return "altele";
}

function resolveHeader(headers, field) {
  const candidates = HEADER_SYNONYMS[field].map(fold);
  return headers.findIndex((header) => candidates.includes(fold(header)));
}

function parseStatementCsv(buffer) {
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  if (!text.trim()) throw new Error("Fișierul CSV este gol.");
  const firstLine = text.split(/\r?\n/, 1)[0];
  const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
  let rows;
  try {
    rows = parse(text, { delimiter, bom: true, skip_empty_lines: true, relax_column_count: true, trim: true });
  } catch {
    throw new Error("Nu am putut citi CSV-ul. Verifică separatorul și antetul.");
  }
  if (rows.length < 2) throw new Error("Extrasul nu conține tranzacții.");

  const headers = rows[0];
  const dateIndex = resolveHeader(headers, "date");
  const descriptionIndex = resolveHeader(headers, "description");
  const amountIndex = resolveHeader(headers, "amount");
  const debitIndex = resolveHeader(headers, "debit");
  const creditIndex = resolveHeader(headers, "credit");
  if (dateIndex < 0 || descriptionIndex < 0 || (amountIndex < 0 && debitIndex < 0 && creditIndex < 0)) {
    throw new Error("CSV-ul trebuie să conțină coloane pentru dată, descriere și sumă/debit/credit.");
  }

  const transactions = [];
  for (const row of rows.slice(1)) {
    const date = parseDate(row[dateIndex]);
    const description = String(row[descriptionIndex] || "").trim();
    if (!date || !description) continue;

    let amount;
    if (amountIndex >= 0) {
      amount = parseAmount(row[amountIndex]);
    } else {
      const debitText = debitIndex >= 0 ? String(row[debitIndex] || "").trim() : "";
      const creditText = creditIndex >= 0 ? String(row[creditIndex] || "").trim() : "";
      const debit = debitText ? parseAmount(debitText) : 0;
      const credit = creditText ? parseAmount(creditText) : 0;
      if (debit === null || credit === null) continue;
      amount = Math.abs(credit) - Math.abs(debit);
    }
    if (amount === null || amount === 0) continue;

    const merchantNorm = normalizeMerchant(description);
    const category = categorize(merchantNorm);
    transactions.push({ date, merchantNorm, category, amountRon: amount });
  }
  if (!transactions.length) throw new Error("Nu am găsit tranzacții valide în extras.");
  return transactions;
}

function parseStatementText(text) {
  const transactions = [];
  const transactionPattern = /^\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}[./]\d{4})\s+(.+?)\s+(-?\(?\d[\d., ]*\)?)(?:\s*RON)?\s*$/i;
  for (const line of String(text || "").split(/\r?\n/)) {
    const match = line.match(transactionPattern);
    if (!match) continue;
    const date = parseDate(match[1]);
    const amount = parseAmount(match[3]);
    const description = match[2].trim();
    if (!date || amount === null || amount === 0 || !description) continue;
    const merchantNorm = normalizeMerchant(description);
    transactions.push({ date, merchantNorm, category: categorize(merchantNorm), amountRon: amount });
  }
  if (transactions.length < 2) {
    throw new Error("Nu am putut citi suficient de clar tranzacțiile din PDF. Folosește extrasul demo sau exportă CSV.");
  }
  return transactions;
}

async function parseStatementPdf(buffer) {
  let extracted;
  try {
    extracted = await pdfParse(buffer);
  } catch {
    throw new Error("Nu am putut citi PDF-ul. Folosește extrasul demo sau exportă CSV.");
  }
  return parseStatementText(extracted.text);
}

module.exports = { parseStatementCsv, parseStatementPdf, parseStatementText, parseDate, parseAmount, normalizeMerchant, categorize };