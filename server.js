const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || '*' }));
app.use(express.json({ limit: '4mb' }));

const MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

// ─────────────────────────────────────────────
// CORE AI HELPER
// ─────────────────────────────────────────────

async function callClaude(system, user, maxTokens = 1024) {
  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }]
    })
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  const d = await res.json();
  return d.content[0].text;
}

function parseJSON(raw) {
  try { return JSON.parse(raw.replace(/```(?:json)?|```/g, '').trim()); }
  catch { return null; }
}

// ─────────────────────────────────────────────
// AI SYSTEM PROMPTS
// ─────────────────────────────────────────────

const ASSISTANT_SYSTEM = `You are RentGuard AI, an expert AI property management assistant for small landlords (1–10 units). You are knowledgeable, direct, and practical. You help with:

CORE EXPERTISE:
• Tenant screening advice and best practices
• Lease clause interpretation and drafting guidance
• Maintenance triage — diagnosing issues, prioritizing urgency, suggesting DIY vs professional
• Rent pricing analysis and market context
• Fair Housing Act compliance — proactive guidance
• Eviction process guidance (general, not legal advice)
• State-specific landlord-tenant law context
• Cash flow and ROI optimization
• Vendor communication templates
• Tenant communication templates (late rent notices, lease renewal, maintenance follow-up)

CRITICAL RULES:
• Always clarify you provide general guidance, not legal advice
• For evictions, always recommend consulting a local attorney
• For Fair Housing questions, be extremely thorough and cautious
• For maintenance emergencies (gas leak, flooding, no heat in winter), always direct to emergency services first
• Be concise — landlords are busy. Get to the point.
• When generating templates, make them professional and legally cautious
• Never fabricate state laws — say "laws vary by state, verify locally" when unsure

RESPONSE STYLE:
• Lead with the direct answer
• Use bullet points for multi-step guidance
• Keep responses under 300 words unless a template is requested
• End templates with a [CUSTOMIZE THIS] note on any blank field

You have context about the landlord's specific properties when provided. Use it to give personalized answers.`;

const TENANT_SCREENING_SYSTEM = `You are a tenant screening advisor for a small landlord. Analyze the provided applicant information and generate a screening report.

SCREENING CRITERIA (apply consistently to ALL applicants — Fair Housing requires identical standards):
• Income: Gross monthly income should be ≥ 3x monthly rent
• Credit: Score below 580 = high risk, 580-649 = moderate risk, 650+ = acceptable
• Rental history: Prior evictions = significant red flag; late payments = moderate concern
• Employment: Verify stability — length of employment matters
• References: Character references from prior landlords are valuable

FAIR HOUSING MANDATORY RULES:
• Apply IDENTICAL criteria to every applicant
• NEVER factor in race, color, national origin, religion, sex, familial status, disability
• NEVER ask about immigration status
• NEVER factor in source of income in states where it is a protected class
• Document your criteria in writing before screening begins

RESPOND ONLY WITH VALID JSON:
{
  "overallScore": <integer 0-100>,
  "recommendation": <"approve"|"conditional"|"decline">,
  "incomeCheck": { "passed": <bool>, "ratio": <number or null>, "note": "<string>" },
  "creditCheck": { "passed": <bool>, "score": <number or null>, "note": "<string>" },
  "rentalHistory": { "passed": <bool>, "note": "<string>" },
  "employmentCheck": { "passed": <bool>, "note": "<string>" },
  "redFlags": ["<string>"],
  "positives": ["<string>"],
  "summary": "<2-3 sentence professional assessment>",
  "fairHousingNote": "<reminder about consistent criteria application>"
}`;

const MAINTENANCE_SYSTEM = `You are a property maintenance triage expert. Analyze the described maintenance issue and provide actionable guidance for a small landlord.

TRIAGE LEVELS:
• EMERGENCY (respond within 1 hour): Gas leak, flooding/burst pipe, no heat in winter, structural danger, fire hazard, electrical sparking, sewage backup
• URGENT (respond within 24 hours): No hot water, HVAC failure in extreme temps, broken locks, pest infestation, refrigerator failure
• ROUTINE (schedule within 7 days): Minor leaks, appliance issues, cosmetic damage, normal wear items
• SCHEDULED (next available): Cosmetic repairs, preventative maintenance, upgrades

RESPOND ONLY WITH VALID JSON:
{
  "triageLevel": <"emergency"|"urgent"|"routine"|"scheduled">,
  "category": "<plumbing|electrical|hvac|structural|appliance|pest|cosmetic|other>",
  "estimatedCost": { "low": <number>, "high": <number>, "currency": "USD" },
  "diyPossible": <boolean>,
  "diyRisk": <"none"|"low"|"medium"|"high">,
  "immediateSteps": ["<step>"],
  "professionalNeeded": <boolean>,
  "vendorType": "<plumber|electrician|hvac_tech|general_contractor|pest_control|none>",
  "tenantCommunication": "<ready-to-send message to tenant>",
  "landlordNotes": "<private notes for landlord>",
  "preventionTip": "<how to prevent recurrence>"
}`;

const LEASE_SYSTEM = `You are a lease drafting assistant for small landlords. Generate professional, legally-cautious lease clauses and communications.

IMPORTANT PRINCIPLES:
• Always include "consult a local attorney before use" disclaimer
• Use plain language tenants can understand
• Be fair but protect the landlord's legitimate interests
• Flag any clause that may have state-specific requirements
• Never include illegal clauses (e.g., waiving tenant's rights, discriminatory terms)

Generate requested lease content professionally. Always end with: "⚠️ This is a template for reference only. Have a licensed attorney in your state review before use."`;

const CASHFLOW_SYSTEM = `You are a rental property cash flow analyst. Analyze the provided property financials and generate insights.

ANALYZE:
• Gross rental income vs market rate
• Operating expense ratio (should be 35-45% for most residential)
• Net Operating Income (NOI)
• Cash-on-cash return
• Cap rate estimate
• Vacancy rate impact
• Deferred maintenance risk
• Rent increase opportunity

RESPOND ONLY WITH VALID JSON:
{
  "monthlyGrossIncome": <number>,
  "monthlyExpenses": <number>,
  "monthlyNOI": <number>,
  "annualNOI": <number>,
  "expenseRatio": <number>,
  "cashOnCash": <number or null>,
  "capRate": <number or null>,
  "marketRentAnalysis": "<string>",
  "rentIncreaseOpportunity": <number>,
  "topExpenseConcerns": ["<string>"],
  "recommendations": ["<string>"],
  "healthScore": <integer 0-100>,
  "healthLabel": <"excellent"|"good"|"fair"|"poor">,
  "summary": "<2-3 sentence assessment>"
}`;

// ─────────────────────────────────────────────
// LICENSE KEY SYSTEM
// ─────────────────────────────────────────────

// Production: replace with database
const KEY_DB = new Map([
  ['RG-DEMO-00000000', { tier: 'landlord', units: 3, name: 'Demo Landlord', active: true }],
]);

function genKey(tier) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let k = '';
  for (let i = 0; i < 8; i++) k += chars[Math.floor(Math.random() * chars.length)];
  return `RG-${tier.toUpperCase().slice(0,4)}-${k}`;
}

// ─────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────

app.get('/health', (_, res) => res.json({ ok: true, product: 'RentGuard AI', v: '1.0.0' }));

// Validate key
app.post('/api/validate-key', (req, res) => {
  const key = req.body?.key?.toUpperCase().trim();
  const data = KEY_DB.get(key);
  if (!data?.active) return res.json({ valid: false });
  res.json({ valid: true, tier: data.tier, units: data.units, name: data.name });
});

// ── AI ASSISTANT ──
app.post('/api/assistant', async (req, res) => {
  const { key, question, context } = req.body;
  if (!KEY_DB.get(key?.toUpperCase())?.active) return res.status(401).json({ error: 'Invalid key' });
  if (!question?.trim()) return res.status(400).json({ error: 'Question required' });

  const contextBlock = context
    ? `\n\nLANDLORD CONTEXT:\n${JSON.stringify(context, null, 2)}`
    : '';

  try {
    const answer = await callClaude(
      ASSISTANT_SYSTEM,
      `${question.trim()}${contextBlock}`,
      1200
    );
    res.json({ answer, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── TENANT SCREENING ──
app.post('/api/screening', async (req, res) => {
  const { key, applicant, monthlyRent } = req.body;
  if (!KEY_DB.get(key?.toUpperCase())?.active) return res.status(401).json({ error: 'Invalid key' });

  const prompt = `Screen this rental applicant for a $${monthlyRent}/month unit:

Applicant information:
- Monthly income: $${applicant.income || 'Not provided'}
- Credit score: ${applicant.creditScore || 'Not provided'}
- Employment: ${applicant.employment || 'Not provided'}
- Rental history: ${applicant.rentalHistory || 'Not provided'}
- Prior evictions: ${applicant.evictions || 'None reported'}
- References: ${applicant.references || 'Not provided'}
- Additional notes: ${applicant.notes || 'None'}

Monthly rent: $${monthlyRent}`;

  try {
    const raw = await callClaude(TENANT_SCREENING_SYSTEM, prompt, 900);
    const result = parseJSON(raw);
    if (!result) throw new Error('Parse error');
    res.json({ result, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── MAINTENANCE TRIAGE ──
app.post('/api/maintenance', async (req, res) => {
  const { key, issue, property, unit } = req.body;
  if (!KEY_DB.get(key?.toUpperCase())?.active) return res.status(401).json({ error: 'Invalid key' });

  const prompt = `Triage this maintenance issue:

Property: ${property || 'Not specified'}
Unit: ${unit || 'Not specified'}
Issue reported: ${issue}`;

  try {
    const raw = await callClaude(MAINTENANCE_SYSTEM, prompt, 900);
    const result = parseJSON(raw);
    if (!result) throw new Error('Parse error');
    res.json({ result, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── LEASE TOOLS ──
app.post('/api/lease', async (req, res) => {
  const { key, type, context } = req.body;
  if (!KEY_DB.get(key?.toUpperCase())?.active) return res.status(401).json({ error: 'Invalid key' });

  const LEASE_TYPES = {
    late_notice: 'Late rent notice letter',
    renewal_letter: 'Lease renewal offer letter',
    move_in_checklist: 'Move-in inspection checklist',
    move_out_notice: 'Move-out notice and instructions',
    rent_increase: 'Rent increase notice',
    pet_addendum: 'Pet addendum clause',
    parking_addendum: 'Parking addendum clause',
    no_smoking: 'No-smoking addendum',
    maintenance_clause: 'Tenant maintenance responsibilities clause',
    entry_notice: 'Landlord entry notice template'
  };

  const typeName = LEASE_TYPES[type] || type;
  const prompt = `Generate a professional ${typeName} for a small landlord.
Context: ${JSON.stringify(context || {})}
Make it thorough, professional, and legally cautious. Use [BRACKETS] for fields to customize.`;

  try {
    const content = await callClaude(LEASE_SYSTEM, prompt, 1200);
    res.json({ content, type, typeName, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CASH FLOW ANALYSIS ──
app.post('/api/cashflow', async (req, res) => {
  const { key, property } = req.body;
  if (!KEY_DB.get(key?.toUpperCase())?.active) return res.status(401).json({ error: 'Invalid key' });

  const prompt = `Analyze this rental property's financials:

Monthly rent: $${property.rent || 0}
Mortgage/financing: $${property.mortgage || 0}/month
Property taxes: $${property.taxes || 0}/month
Insurance: $${property.insurance || 0}/month
HOA fees: $${property.hoa || 0}/month
Utilities paid by landlord: $${property.utilities || 0}/month
Average maintenance: $${property.maintenance || 0}/month
Property management: $${property.management || 0}/month
Other expenses: $${property.other || 0}/month
Purchase price/current value: $${property.value || 0}
Down payment: $${property.downPayment || 0}
Market: ${property.market || 'Not specified'}
Property type: ${property.propertyType || 'Single family rental'}`;

  try {
    const raw = await callClaude(CASHFLOW_SYSTEM, prompt, 900);
    const result = parseJSON(raw);
    if (!result) throw new Error('Parse error');
    res.json({ result, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: generate key ──
app.post('/api/admin/generate-key', (req, res) => {
  if (req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { tier = 'landlord', units = 5, name = 'New Customer' } = req.body;
  const key = genKey(tier);
  KEY_DB.set(key, { tier, units, name, active: true, createdAt: new Date().toISOString() });
  res.json({ key, tier, units, name });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`RentGuard AI API v1.0.0 — port ${PORT}`));
