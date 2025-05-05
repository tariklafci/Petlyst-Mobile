// src/controllers/inventoryController.js

const pool = require('../config/db');
const jwt = require('jsonwebtoken');

const LLAMA_URL = 'http://10.0.0.25:5000/api/llama/generate';
const JWT_SECRET = process.env.JWT_SECRET;

// helper to call your Llama service
async function callLlama(prompt) {
  const resp = await fetch(LLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });
  if (!resp.ok) throw new Error(`Llama service responded ${resp.status}`);
  return resp.json();
}

// helper to extract clinic IDs for the veterinarian in the bearer token
async function getClinicIdsFromRequest(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    const err = new Error('Authorization token missing');
    err.status = 401;
    throw err;
  }

  const token = auth.slice('Bearer '.length);
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (e) {
    const err = new Error('Invalid token');
    err.status = 401;
    throw err;
  }

  const userId = payload.user_id;
  const vetClinics = await pool.query(
    'SELECT clinic_id FROM clinic_veterinarians WHERE veterinarian_id = $1',
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

exports.checkReorder = async (req, res) => {
  try {
    const clinicIds = await getClinicIdsFromRequest(req);

    const itemsRes = await pool.query(
      'SELECT * FROM inventory_items WHERE clinic_id = ANY($1)',
      [clinicIds]
    );
    const txRes = await pool.query(
      'SELECT * FROM inventory_transactions WHERE clinic_id = ANY($1)',
      [clinicIds]
    );

    const prompt = `Based on my current inventory and transaction history for clinic(s) ${clinicIds.join(', ')}, do I need to reorder any vaccine?

Inventory Items:
${JSON.stringify(itemsRes.rows)}

Inventory Transactions:
${JSON.stringify(txRes.rows)}

Answer succinctly.`;

    const data = await callLlama(prompt);
    res.json({ title: data.title, code: data.code, raw: data.raw });
  } catch (err) {
    console.error('checkReorder error:', err);
    res.status(err.status || 500).json({ error: err.message });
  }
};

exports.calculateStockDays = async (req, res) => {
  try {
    const clinicIds = await getClinicIdsFromRequest(req);

    const itemsRes = await pool.query(
      'SELECT * FROM inventory_items WHERE clinic_id = ANY($1)',
      [clinicIds]
    );
    const txRes = await pool.query(
      'SELECT * FROM inventory_transactions WHERE clinic_id = ANY($1)',
      [clinicIds]
    );

    const prompt = `Given my inventory and usage history for clinic(s) ${clinicIds.join(', ')}, how many days of stock do I have left for each item, assuming recent usage patterns continue?

Inventory Items:
${JSON.stringify(itemsRes.rows)}

Inventory Transactions:
${JSON.stringify(txRes.rows)}

Provide one line per item: item name – days of stock remaining.`;

    const data = await callLlama(prompt);
    res.json({ title: data.title, code: data.code, raw: data.raw });
  } catch (err) {
    console.error('calculateStockDays error:', err);
    res.status(err.status || 500).json({ error: err.message });
  }
};

exports.averageWeeklyConsumption = async (req, res) => {
  try {
    const clinicIds = await getClinicIdsFromRequest(req);

    const itemsRes = await pool.query(
      'SELECT * FROM inventory_items WHERE clinic_id = ANY($1)',
      [clinicIds]
    );
    const txRes = await pool.query(
      'SELECT * FROM inventory_transactions WHERE clinic_id = ANY($1)',
      [clinicIds]
    );

    const prompt = `What is the average weekly consumption of each inventory item for clinic(s) ${clinicIds.join(', ')}, based on my transaction history?

Inventory Items:
${JSON.stringify(itemsRes.rows)}

Inventory Transactions:
${JSON.stringify(txRes.rows)}

List each item with its average weekly usage.`;

    const data = await callLlama(prompt);
    res.json({ title: data.title, code: data.code, raw: data.raw });
  } catch (err) {
    console.error('averageWeeklyConsumption error:', err);
    res.status(err.status || 500).json({ error: err.message });
  }
};

exports.identifySlowMoving = async (req, res) => {
  try {
    const clinicIds = await getClinicIdsFromRequest(req);

    const itemsRes = await pool.query(
      'SELECT * FROM inventory_items WHERE clinic_id = ANY($1)',
      [clinicIds]
    );
    const txRes = await pool.query(
      'SELECT * FROM inventory_transactions WHERE clinic_id = ANY($1)',
      [clinicIds]
    );

    const prompt = `Identify which items in my inventory for clinic(s) ${clinicIds.join(', ')} are slow‐moving (i.e., haven’t been used much recently), based on transaction history.

Inventory Items:
${JSON.stringify(itemsRes.rows)}

Inventory Transactions:
${JSON.stringify(txRes.rows)}

Return a short list of item names that qualify as slow-moving.`;

    const data = await callLlama(prompt);
    res.json({ title: data.title, code: data.code, raw: data.raw });
  } catch (err) {
    console.error('identifySlowMoving error:', err);
    res.status(err.status || 500).json({ error: err.message });
  }
};
