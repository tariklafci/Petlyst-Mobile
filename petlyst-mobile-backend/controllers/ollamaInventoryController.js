const pool = require('../config/db');

// Single, consolidated system prompt that covers all inventory analysis needs
const systemPrompt = `You are VetInventoryGPT, a veterinary inventory management expert. Provide concise, actionable inventory insights with these guidelines:

1. Begin with a one-sentence summary of the overall inventory status with the CLINIC NAME.
2. Use bullet points for all lists and recommendations.
3. Focus on items needing attention - those below minimum thresholds or with less than 7 days of supply.
4. Include specific recommendations for reordering and inventory optimization.
5. Keep your response under 300 words, prioritizing actionable insights over general descriptions.
6. Only use the data provided in the response, do NOT make up any information.`;

const LLAMA_URL = 'http://10.0.0.25:5000/api/llama/generate';

async function callLlama(prompt, system_instruction = systemPrompt) {
  const resp = await fetch(LLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system_instruction, prompt })
  });
  if (!resp.ok) throw new Error(`Llama service responded ${resp.status}`);
  return resp.json();
}

async function processInventoryData(clinicIds) {
  const today = new Date();
  const numericClinicIds = clinicIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
  if (!numericClinicIds.length) throw new Error('No valid clinic IDs available for inventory data');

  // fetch items explicitly casting param to integer[]
  const itemsRes = await pool.query(
    `SELECT * FROM inventory_items WHERE clinic_id = ANY($1::integer[])`,
    [numericClinicIds]
  );

  // Get usage transactions directly without JOIN - this is simpler and more reliable
  // The issue could be with clinic_id casting or JOIN conditions
  const txRes = await pool.query(
    `SELECT * FROM inventory_transactions
     WHERE transaction_type = 'usage'
     ORDER BY transaction_date`,
    []
  );

  console.log(`Found ${txRes.rows.length} total usage transactions`);
  
  // For debugging, let's see what item IDs we have in transactions
  const transactionItemIds = [...new Set(txRes.rows.map(tx => tx.inventory_item_id))];
  console.log(`Transaction item IDs: ${transactionItemIds.join(', ')}`);
  
  // For debugging, let's see what item IDs we have in inventory
  const inventoryItemIds = itemsRes.rows.map(item => item.id);
  console.log(`Inventory item IDs: ${inventoryItemIds.join(', ')}`);

  // Group transactions by inventory_item_id
  const txByItem = {};
  txRes.rows.forEach(tx => {
    const key = tx.inventory_item_id;
    if (!key) return;
    if (!txByItem[key]) txByItem[key] = [];
    txByItem[key].push(tx);
  });

  return itemsRes.rows.map(item => {
    // Get transactions for this item using its ID - direct match
    const itemTx = txByItem[item.id] || [];
    console.log(`Processing ${item.name} (${item.id}): found ${itemTx.length} transactions`);

    // Calculate total usage and time period
    const totalUsage = itemTx.reduce((sum, tx) => sum + tx.quantity, 0);
    
    let daysSinceFirst = 1;
    if (itemTx.length > 0) {
      // Sort transactions by date to ensure we get the earliest one
      const sortedTx = [...itemTx].sort((a, b) => 
        new Date(a.transaction_date) - new Date(b.transaction_date)
      );
      
      const firstDate = new Date(sortedTx[0].transaction_date);
      daysSinceFirst = Math.max(1, Math.floor((today - firstDate) / (1000 * 60 * 60 * 24)));
      console.log(`${item.name}: First transaction on ${firstDate.toISOString().split('T')[0]}, ${daysSinceFirst} days ago`);
    }

    // Calculate daily usage and days remaining
    const dailyUsage = totalUsage / daysSinceFirst;
    console.log(`${item.name}: ${totalUsage} units over ${daysSinceFirst} days = ${dailyUsage.toFixed(2)}/day`);

    const daysRemaining = dailyUsage > 0 ? Math.floor(item.current_quantity / dailyUsage) : null;
    const neededToMin = Math.max(0, item.min_quantity - item.current_quantity);

    return {
      item_id: item.id,
      name: item.name,
      current_quantity: item.current_quantity,
      min_quantity: item.min_quantity,
      daily_usage: dailyUsage.toFixed(2),
      days_remaining: daysRemaining === null ? 'N/A' : daysRemaining,
      is_below_minimum: item.current_quantity < item.min_quantity,
      needs_reorder:
        item.current_quantity < item.min_quantity ||
        (daysRemaining !== null && daysRemaining < 7),
      needed_to_minimum: neededToMin,
      profit_per_item: (item.sale_price - item.purchase_price).toFixed(2),
      purchase_price: item.purchase_price,
      sale_price: item.sale_price
    };
  });
}

async function getClinicIdsFromRequest(req) {
  const userId = req.user && (req.user.user_id || req.user.userId);
  if (!userId) {
    const err = new Error('User not authenticated'); err.status = 401; throw err;
  }
  const vetClinics = await pool.query(
    `SELECT clinic_id FROM clinic_veterinarians WHERE veterinarian_id = $1`,
    [userId]
  );
  const clinicIds = vetClinics.rows.map(r => r.clinic_id);
  if (!clinicIds.length) { const err = new Error('No clinic associations found for this user'); err.status = 403; throw err; }
  return clinicIds;g
}

async function getClinicName(req) {
  const clinicIds = await getClinicIdsFromRequest(req);
  const numeric = clinicIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
  if (!numeric.length) throw new Error('No valid clinic IDs available for clinic names');

  const res = await pool.query(
    `SELECT clinic_name FROM clinics WHERE clinic_id = ANY($1::integer[])`,
    [numeric]
  );
  const names = res.rows.map(r => r.clinic_name);
  if (!names.length) { const err = new Error('No clinic names found for this clinic'); err.status = 403; throw err; }
  return names;
}

exports.checkReorder = async (req, res) => {
  try {
    const clinicIds = await getClinicIdsFromRequest(req);
    const clinicName = await getClinicName(req);
    const metrics = await processInventoryData(clinicIds);

    const itemsNeeding = metrics.filter(m => m.needs_reorder);
    let prompt = `Analyze reordering needs for ${clinicName.join(', ')} clinic inventory:`;

    if (!itemsNeeding.length) {
      prompt += `\n\nAll ${metrics.length} inventory items are adequately stocked.`;
    } else {
      prompt += `\n\n${itemsNeeding.length} of ${metrics.length} items need attention:`;
      itemsNeeding.forEach(item => {
        const reason = item.is_below_minimum
          ? `Below minimum (${item.current_quantity}/${item.min_quantity})`
          : `Low supply (${item.days_remaining} days remaining)`;
        prompt += `\n• ${item.name}: ${reason}, needs ${item.needed_to_minimum} more to reach minimum, uses ${item.daily_usage}/day`;
      });
    }

    const data = await callLlama(prompt);
    res.json({ title: data.title, code: data.code, raw: data.raw, itemsNeeding });
  } catch (err) {
    console.error('checkReorder error:', err);
    res.status(err.status || 500).json({ error: err.message });
  }
};

exports.calculateStockDays = async (req, res) => {
  try {
    const clinicIds = await getClinicIdsFromRequest(req);
    const clinicName = await getClinicName(req);
    const metrics = await processInventoryData(clinicIds);

    let prompt = `Analyze days of stock remaining for each item in ${clinicName.join(', ')} clinic:`;    
    const sorted = [...metrics].sort((a, b) => {
      if (a.days_remaining === 'N/A') return 1;
      if (b.days_remaining === 'N/A') return -1;
      return a.days_remaining - b.days_remaining;
    });
    sorted.forEach(item => {
      prompt += `\n• ${item.name}: ${item.days_remaining} days remaining (Current: ${item.current_quantity}, Usage: ${item.daily_usage}/day)`;
    });

    const data = await callLlama(prompt);
    res.json({ title: data.title, code: data.code, raw: data.raw, stockDays: sorted });
  } catch (err) {
    console.error('calculateStockDays error:', err);
    res.status(err.status || 500).json({ error: err.message });
  }
};

