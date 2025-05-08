const pool = require('../config/db');

// Helper to build the system instruction for the AI
function getSystemInstruction() {
  return `You are a professional and friendly AI assistant specialized in veterinary medicine.
You help pet owners by answering questions related to the health, behavior, care, and general well-being
of pets (such as cats, dogs, rabbits, birds, and small mammals).

You are knowledgeable about:
- Common symptoms and conditions in pets (e.g., skin issues, vomiting, coughing, behavioral changes)
- Pet vaccination schedules
- Nutritional and dietary needs
- Preventive care (e.g., deworming, flea and tick control)
- When to see a veterinarian in person

Your tone is empathetic, informative, and responsible. You always encourage users to consult a licensed veterinarian
for diagnosis or emergency care.

If the question is not related to pets or animal care, politely respond:
"I'm here to help with pet-related topics. Please ask me anything about your pet's health, care, or behavior."

Never provide information on:
- Human health
- Legal or financial issues
- Non-animal-related topics
`.trim();
}

// Helper to build the conversation prompt history
function buildConversationPrompt(history = [], userPrompt) {
  const convo = history.map(({ sender, text }) => {
    const who = sender === 'bot' ? 'Assistant' : 'User';
    return `${who}: ${text}`;
  }).join('\n');
  return `${convo}\nUser: ${userPrompt}\nAssistant:`;
}

exports.generateResponse = async (req, res) => {
  const { prompt, history } = req.body;

  // Validate inputs
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }
  if (!req.user || !req.user.sub) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  const userId = parseInt(req.user.sub, 10);
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  try {
    // Fetch active pets and their latest examination in one query using DISTINCT ON
    const petQuery = `
      SELECT
        p.pet_id,
        p.pet_name,
        p.pet_species,
        p.pet_breed,
        p.pet_gender,
        p.pet_birth_date,
        e.examination_date,
        e.weight,
        e.temperature,
        COALESCE(json_agg(json_build_object(
          'diagnosis_id', d.diagnosis_id,
          'name',        d.diagnosis_name,
          'severity',    d.severity,
          'notes',       d.notes
        )) FILTER (WHERE d.diagnosis_id IS NOT NULL), '[]') AS diagnoses
      FROM public.pets p
      LEFT JOIN LATERAL (
        SELECT *
        FROM public.examinations ex
        WHERE ex.pet_id = p.pet_id
        ORDER BY ex.examination_date DESC
        LIMIT 1
      ) e ON true
      LEFT JOIN public.diagnoses d ON d.examination_id = e.examination_id
      WHERE p.pet_owner_id = $1
        AND p.pet_status = 'active'
      GROUP BY p.pet_id, e.examination_id
      ORDER BY p.pet_id;
    `;
    const { rows: pets } = await pool.query(petQuery, [userId]);

    if (!pets.length) {
      return res.status(200).json({
        title: "No Pets Found",
        code: null,
        raw: "I couldn't find any active pets in your profile. Please add a pet to get started!"
      });
    }

    // Build augmented prompt
    const petInfoLines = pets.map(p => {
      const birthday = p.pet_birth_date
        ? `born ${p.pet_birth_date.toISOString().split('T')[0]}`
        : '';
      return `- ${p.pet_name} (${p.pet_species}, ${p.pet_breed}, ${p.pet_gender}) ${birthday}`;
    });

    let augmentedPrompt = `I am the owner of the following pets:\n${petInfoLines.join('\n')}\n\n`;
    pets.forEach(p => {
      if (p.examination_date) {
        augmentedPrompt += `Latest exam for ${p.pet_name} on ${p.examination_date.toISOString().split('T')[0]}: ` +
          `weight ${p.weight} kg, temp ${p.temperature}°C. ` +
          `Diagnoses: ${p.diagnoses.map(d => `${d.name} (${d.severity})`).join(', ')}.\n`;
      }
    });
    augmentedPrompt += '\n';

    const llamaBody = {
      system_instruction: getSystemInstruction(),
      prompt: augmentedPrompt + buildConversationPrompt(history, prompt)
    };

    // Call Llama API
    const llamaRes = await fetch('http://10.0.0.25:5000/api/llama/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(llamaBody)
    });
    if (!llamaRes.ok) {
      throw new Error(`Llama service responded ${llamaRes.status}`);
    }
    const data = await llamaRes.json();

    // Return the assistant’s reply
    return res.status(200).json({
      title: data.title,
      code: data.code,
      raw: data.raw
    });

  } catch (err) {
    console.error('⚠️ generateResponse error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
