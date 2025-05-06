const pool = require('../config/db');

const systemPromptBase = `You are VetInventoryGPT, a veterinary inventory management expert. When given a prompt about inventory and transaction data, follow these rules:

1. Address practicing veterinarians in clear, concise language.
2. Reference only the provided “Inventory Items” and “Inventory Transactions” JSON datasets. Do not guess or hallucinate values.
3. Always begin with a one-sentence summary, followed by a bulleted list.
4. Do not output any code, metadata, or unstructured thoughts. Only provide clear analysis and results.
Respond directly to the user prompt that follows.`;

const systemPromptReorder = `
   - Only consider transactions where transaction_type is "usage".
   - Calculate daily usage as: total usage quantity / number of full calendar days between the earliest usage transaction date and today's date (2025-05-06).
   - Recommend reorder only if:
     • current_stock < min_quantity
     OR
     • days_remaining < 7 (days_remaining = current_stock / daily_usage)
   - Clearly explain which items need reorder and why, e.g., "Stock is below minimum threshold" or "Expected to run out in X days."`;

const systemPromptDaysRemaining = `
   - Use only "usage" transactions.
   - Calculate daily usage: total usage quantity / number of full calendar days between the earliest usage date and 2025-05-06.
   - For each item, compute: days_remaining = current_stock / daily_usage
   - Present each item as: “Item Name: X days remaining.”`;


const LLAMA_URL = 'http://10.0.0.25:5000/api/llama/generate';

async function callLlama(prompt, system_instruction) {
  const resp = await fetch(LLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: system_instruction,
      prompt: prompt
    })
  });

  if (!resp.ok) throw new Error(`Llama service responded ${resp.status}`);
  return resp.json();
}


// now just pull the user ID from req.user
async function getClinicIdsFromRequest(req) {
  // Check for both formats
  const userId = req.user && (req.user.user_id || req.user.userId);
  if (!userId) {
    const err = new Error('User not authenticated');
    err.status = 401;
    throw err;
  }

  const vetClinics = await pool.query(
    `SELECT clinic_id
       FROM clinic_veterinarians
      WHERE veterinarian_id = $1`,
    [userId]
  );

  const clinicIds = vetClinics.rows.map(r => r.clinic_id);
  if (clinicIds.length === 0) {
    const err = new Error('No clinic associations found for this user');
    err.status = 403;
    throw err;
  }

  return clinicIds;
}

async function getClinicName(req) {

  const userId = req.user && (req.user.user_id || req.user.userId);
  if (!userId) {
    const err = new Error('User not authenticated');
    err.status = 401;
    throw err;
  }

  const clinicIds = await getClinicIdsFromRequest(req);

  const clinicName = await pool.query(
    `SELECT clinic_name
       FROM clinics
      WHERE clinic_id = ANY($1)`,
    [clinicIds]
  );

  const clinicNames = clinicName.rows.map(r => r.clinic_name);
  
  if (clinicNames.length === 0) {
    const err = new Error('No clinic names found for this clinic');
    err.status = 403;
    throw err;
  }

  return clinicNames;
}

exports.checkReorder = async (req, res) => {
  try {
    const clinicIds = await getClinicIdsFromRequest(req);
    const clinicName = await getClinicName(req);
    const itemsRes = await pool.query(
      `SELECT * 
         FROM inventory_items
        WHERE clinic_id = ANY($1)`,
      [clinicIds]
    );
    const txRes = await pool.query(
      `SELECT *
         FROM inventory_transactions
        WHERE clinic_id = ANY($1)`,
      [clinicIds]
    );

    const prompt = `Based on my current inventory and transaction history for clinic ${clinicName.join(
      ', '
    )}, do I need to reorder any vaccine? 

Inventory Items:
${JSON.stringify(itemsRes.rows)}

Inventory Transactions:
${JSON.stringify(txRes.rows)}

Answer succinctly.`;

    const system_instruction = systemPromptBase + systemPromptReorder;
    const data = await callLlama(prompt, system_instruction);

    res.json({ title: data.title, code: data.code, raw: data.raw });
  } catch (err) {
    console.error('checkReorder error:', err);
    res.status(err.status || 500).json({ error: err.message });
  }
};

exports.calculateStockDays = async (req, res) => {
  try {
    const clinicIds = await getClinicIdsFromRequest(req);
    const clinicName = await getClinicName(req);
    const itemsRes = await pool.query(
      `SELECT * 
         FROM inventory_items
        WHERE clinic_id = ANY($1)`,
      [clinicIds]
    );
    const txRes = await pool.query(
      `SELECT *
         FROM inventory_transactions
        WHERE clinic_id = ANY($1)`,
      [clinicIds]
    );

    const prompt = `Given my inventory and usage history for clinic ${clinicName.join(
      ', '
    )}, how many days of stock do I have left for each item, assuming recent usage patterns continue?

Inventory Items:
${JSON.stringify(itemsRes.rows)}

Inventory Transactions:
${JSON.stringify(txRes.rows)}

Provide one line per item: item name – days of stock remaining.`;

    const system_instruction = systemPromptBase + systemPromptDaysRemaining;
    const data = await callLlama(prompt, system_instruction);
    res.json({ title: data.title, code: data.code, raw: data.raw });
  } catch (err) {
    console.error('calculateStockDays error:', err);
    res.status(err.status || 500).json({ error: err.message });
  }
};
