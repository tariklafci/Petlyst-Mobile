const pool = require('../config/db');

// Single, consolidated system prompt that covers all inventory analysis needs
const systemPrompt = `You are VetInventoryGPT, a veterinary inventory management expert. Provide concise, actionable inventory insights with these guidelines:

1. Begin with a one-sentence summary of the overall inventory status.
2. Use bullet points for all lists and recommendations.
3. Focus on items needing attention - those below minimum thresholds or with less than 7 days of supply.
4. Include specific recommendations for reordering and inventory optimization.
5. Keep your response under 300 words, prioritizing actionable insights over general descriptions.`;

/* Inventory Items Structure:
 * {
 *   name: string, //item name
 *   current_quantity: number, //current stock
 *   min_quantity: number, //threshold
 *   clinic_id: number, //clinic id
 *   purchase_price: number, //purchase price
 *   sale_price: number //sale price
 * }
 */

/* Inventory Transactions Structure:
 * {
 *   transaction_type: string,
 *   quantity: number, //transaction quantity
 *   transaction_date: string,
 *   clinic_id: number
 * }
 */

const LLAMA_URL = 'http://10.0.0.25:5000/api/llama/generate';

async function callLlama(prompt, system_instruction = systemPrompt) {
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

// Helper function to process inventory data
async function processInventoryData(clinicIds) {
  const today = new Date('2025-05-06'); // Consistent reference date
  
  console.log('Processing inventory data for clinics:', clinicIds);
  
  // Safely parse clinicIds to integers, filtering out non-numeric values
  const numericClinicIds = clinicIds
    .map(id => {
      // Handle string, number, or null/undefined
      const parsed = parseInt(id);
      return isNaN(parsed) ? null : parsed;
    })
    .filter(id => id !== null); // Remove null values
  
  console.log('Numeric clinic IDs:', numericClinicIds);
  
  // Make sure we have at least one valid clinic ID
  if (numericClinicIds.length === 0) {
    console.error('No valid numeric clinic IDs found');
    throw new Error('No valid clinic IDs available for inventory data');
  }
  
  // Get inventory items using integers
  const itemsRes = await pool.query(
    `SELECT * 
       FROM inventory_items
      WHERE clinic_id = ANY($1::integer[])`,
    [numericClinicIds]
  );
  
  // Log query details for debugging
  console.log(`Found ${itemsRes.rows.length} inventory items for clinics: ${numericClinicIds.join(', ')}`);
  
  // For transactions, try both approaches - first with integer IDs
  let txRes;
  try {
    txRes = await pool.query(
      `SELECT *
         FROM inventory_transactions
        WHERE clinic_id::integer = ANY($1::integer[])
          AND transaction_type::text = 'usage'
        ORDER BY transaction_date ASC`,
      [numericClinicIds]
    );
  } catch (error) {
    console.log('First attempt failed, trying with string clinic IDs for transactions');
    // If that fails, try with the original string IDs
    txRes = await pool.query(
      `SELECT *
         FROM inventory_transactions
        WHERE clinic_id = ANY($1::varchar[])
          AND transaction_type::text = 'usage'
        ORDER BY transaction_date ASC`,
      [clinicIds]
    );
  }
  
  console.log(`Found ${txRes.rows.length} usage transactions for clinics: ${numericClinicIds.join(', ')}`);
  
  // Add debugging to see what fields are available
  if (txRes.rows.length > 0) {
    console.log('Sample transaction fields:', Object.keys(txRes.rows[0]));
    console.log('Sample transaction data:', JSON.stringify(txRes.rows[0]));
  }

  // Group transactions by item - update item_id to inventory_item_id
  const txByItem = {};
  txRes.rows.forEach(tx => {
    if (!txByItem[tx.inventory_item_id]) {
      txByItem[tx.inventory_item_id] = [];
    }
    txByItem[tx.inventory_item_id].push(tx);
  });

  // Calculate metrics for each item
  const metrics = itemsRes.rows.map(item => {
    // Get transactions for this item - using id to match inventory_item_id
    const itemTx = txByItem[item.id] || [];
    
    // Add debugging
    console.log(`Item ${item.name} (${item.id}) has ${itemTx.length} transactions`);
    
    // Calculate daily usage
    let dailyUsage = 0;
    let totalUsage = 0;
    
    if (itemTx.length > 0) {
      // Get earliest transaction date
      const firstTxDate = new Date(itemTx[0].transaction_date);
      
      // Calculate total usage
      itemTx.forEach(tx => {
        totalUsage += tx.quantity;
      });
      
      // Calculate days between first transaction and today
      const daysSinceFirstTx = Math.max(1, Math.floor((today - firstTxDate) / (1000 * 60 * 60 * 24)));
      
      // Calculate daily usage
      dailyUsage = totalUsage / daysSinceFirstTx;
      
      console.log(`Item ${item.name}: ${totalUsage} units used over ${daysSinceFirstTx} days = ${dailyUsage.toFixed(2)}/day`);
    }
    
    // Calculate days remaining
    const daysRemaining = dailyUsage > 0 ? Math.floor(item.current_quantity / dailyUsage) : null;
    
    return {
      item_id: item.id,
      name: item.name,
      current_quantity: item.current_quantity,
      min_quantity: item.min_quantity,
      daily_usage: dailyUsage.toFixed(2),
      days_remaining: daysRemaining === null ? 'N/A' : daysRemaining,
      is_below_minimum: item.current_quantity < item.min_quantity,
      needs_reorder: (item.current_quantity < item.min_quantity) || 
                    (daysRemaining !== null && daysRemaining < 7),
      profit_per_item: (item.sale_price - item.purchase_price).toFixed(2),
      purchase_price: item.purchase_price,
      sale_price: item.sale_price
    };
  });
  
  return metrics;
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

  try {
    // First attempt to get clinic_ids treating them as numeric
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

    console.log('Found clinic IDs:', clinicIds);
    return clinicIds;
  } catch (error) {
    console.error('Error in getClinicIdsFromRequest:', error);
    throw error;
  }
}

async function getClinicName(req) {
  const userId = req.user && (req.user.user_id || req.user.userId);
  if (!userId) {
    const err = new Error('User not authenticated');
    err.status = 401;
    throw err;
  }

  const clinicIds = await getClinicIdsFromRequest(req);

  // Safely parse clinicIds to integers, filtering out non-numeric values
  const numericClinicIds = clinicIds
    .map(id => {
      const parsed = parseInt(id);
      return isNaN(parsed) ? null : parsed;
    })
    .filter(id => id !== null);
  
  if (numericClinicIds.length === 0) {
    console.error('No valid numeric clinic IDs found');
    throw new Error('No valid clinic IDs available for clinic names');
  }

  try {
    // Use database casting to handle potential type mismatches
    const clinicName = await pool.query(
      `SELECT clinic_name
         FROM clinics
        WHERE clinic_id = ANY($1::integer[])`,
      [numericClinicIds]
    );

    const clinicNames = clinicName.rows.map(r => r.clinic_name);
    
    if (clinicNames.length === 0) {
      const err = new Error('No clinic names found for this clinic');
      err.status = 403;
      throw err;
    }

    return clinicNames;
  } catch (error) {
    console.error('Error in getClinicName:', error);
    throw error;
  }
}

exports.checkReorder = async (req, res) => {
  try {
    const clinicIds = await getClinicIdsFromRequest(req);
    const clinicName = await getClinicName(req);
    const metrics = await processInventoryData(clinicIds);
    
    // Filter only items that need reordering
    const itemsNeedingReorder = metrics.filter(item => item.needs_reorder);
    
    // Create a concise prompt focusing only on reordering needs
    let prompt = `Analyze reordering needs for ${clinicName.join(', ')} clinic inventory:`;
    
    if (itemsNeedingReorder.length === 0) {
      prompt += `\n\nAll ${metrics.length} inventory items are adequately stocked.`;
    } else {
      prompt += `\n\n${itemsNeedingReorder.length} of ${metrics.length} items need attention:`;
      
      // Add details only for items needing reorder
      itemsNeedingReorder.forEach(item => {
        const reason = item.is_below_minimum 
          ? `Below minimum (${item.current_quantity}/${item.min_quantity})` 
          : `Low supply (${item.days_remaining} days remaining)`;
          
        prompt += `\n• ${item.name}: ${reason}, uses ${item.daily_usage}/day`;
      });
    }

    const data = await callLlama(prompt);
    
    res.json({ 
      title: data.title, 
      code: data.code, 
      raw: data.raw,
      items_needing_reorder: itemsNeedingReorder
    });
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
    
    // Create a concise prompt focusing only on days of stock remaining
    let prompt = `Analyze days of stock remaining for ${clinicName.join(', ')} clinic:`;
    
    // Sort by days remaining (low to high), with N/A at the end
    const sortedItems = [...metrics].sort((a, b) => {
      if (a.days_remaining === 'N/A') return 1;
      if (b.days_remaining === 'N/A') return -1;
      return a.days_remaining - b.days_remaining;
    });
    
    // Add key items data
    sortedItems.forEach(item => {
      prompt += `\n• ${item.name}: ${item.days_remaining} days remaining (Current: ${item.current_quantity}, Usage: ${item.daily_usage}/day)`;
    });

    const data = await callLlama(prompt);
    
    res.json({ 
      title: data.title, 
      code: data.code, 
      raw: data.raw,
      stock_days: sortedItems.map(item => ({
        name: item.name,
        days_remaining: item.days_remaining,
        current_quantity: item.current_quantity,
        daily_usage: item.daily_usage
      }))
    });
  } catch (err) {
    console.error('calculateStockDays error:', err);
    res.status(err.status || 500).json({ error: err.message });
  }
};

exports.getInventoryMetrics = async (req, res) => {
  try {
    const clinicIds = await getClinicIdsFromRequest(req);
    const clinicName = await getClinicName(req);
    const metrics = await processInventoryData(clinicIds);
    
    // Create summary statistics
    const potentialRevenue = metrics.reduce((sum, item) => 
      sum + (item.current_quantity * item.sale_price), 0).toFixed(2);
    
    const potentialProfit = metrics.reduce((sum, item) => 
      sum + (item.current_quantity * (item.sale_price - item.purchase_price)), 0).toFixed(2);
    
    const needsReorderCount = metrics.filter(item => item.needs_reorder).length;
    
    // Create a concise prompt with key metrics
    let prompt = `Provide a comprehensive inventory analysis for ${clinicName.join(', ')} clinic:

SUMMARY:
• Total items: ${metrics.length}
• Items needing reorder: ${needsReorderCount}
• Total potential revenue: $${potentialRevenue}
• Total potential profit: $${potentialProfit}

CRITICAL ITEMS (need attention):`;

    // Add only critical items to keep the prompt focused
    const criticalItems = metrics.filter(item => 
      item.needs_reorder || 
      (item.days_remaining !== 'N/A' && item.days_remaining < 14)
    );
    
    if (criticalItems.length === 0) {
      prompt += "\n• No critical items - all inventory at healthy levels";
    } else {
      criticalItems.forEach(item => {
        let status = "";
        if (item.is_below_minimum) {
          status = "BELOW MINIMUM THRESHOLD";
        } else if (item.days_remaining !== 'N/A' && item.days_remaining < 14) {
          status = `LOW STOCK (${item.days_remaining} days remaining)`;
        } else {
          status = `ATTENTION (${item.days_remaining} days remaining)`;
        }
        
        prompt += `\n• ${item.name}: ${status}
  - Stock: ${item.current_quantity}/${item.min_quantity} min
  - Usage: ${item.daily_usage}/day
  - Profit: $${item.profit_per_item}/unit`;
      });
    }

    // Add request for specific recommendations
    prompt += `\n\nPlease provide:
1. Specific reordering recommendations
2. Inventory optimization strategies
3. Profit maximization opportunities`;

    const data = await callLlama(prompt);
    
    res.json({
      title: data.title,
      code: data.code,
      raw: data.raw,
      metrics: {
        summary: {
          total_items: metrics.length,
          needs_reorder: needsReorderCount,
          potential_revenue: potentialRevenue,
          potential_profit: potentialProfit
        },
        items: metrics
      }
    });
  } catch (err) {
    console.error('getInventoryMetrics error:', err);
    res.status(err.status || 500).json({ error: err.message });
  }
};