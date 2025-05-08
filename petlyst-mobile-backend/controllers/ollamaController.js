const pool = require('../config/db');

exports.generateResponse = async (req, res) => {
  const { prompt, history } = req.body;

  // 0) Validate
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }
  if (!req.user || !req.user.sub) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  // 1) Decode userId
  const userId = parseInt(req.user.sub, 10);
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  try {
    // 2) Fetch the owner's pets
    const petsRes = await pool.query(
      `SELECT
         pet_id, pet_name, pet_species, pet_breed, pet_gender,
         pet_birth_date, chip_number, pet_photo
       FROM public.pets
       WHERE pet_owner_id = $1
         AND pet_status = 'active'`,
      [userId]
    );
    const pets = petsRes.rows;

    const examPromises = pets.map(async pet => {
      const examRes = await pool.query(
        `SELECT e.examination_id, e.examination_date, e.weight, e.temperature,
                json_agg(json_build_object(
                  'diagnosis_id', d.diagnosis_id,
                  'name', d.diagnosis_name,
                  'severity', d.severity,
                  'notes', d.notes
                )) AS diagnoses
         FROM public.examinations e
         LEFT JOIN public.diagnoses d
           ON d.examination_id = e.examination_id
         WHERE e.pet_id = $1
         ORDER BY e.examination_date DESC
         LIMIT 1
         GROUP BY e.examination_id`,
        [pet.pet_id]
      );
      return { petId: pet.pet_id, lastExam: examRes.rows[0] || null };
    });
    const exams = await Promise.all(examPromises);

    const systemInstruction = `
You are a professional and friendly AI assistant specialized in veterinary medicine.
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

    let convoPrompt = '';
    if (Array.isArray(history)) {
      history.forEach(({ sender, text }) => {
        const who = sender === 'bot' ? 'Assistant' : 'User';
        convoPrompt += `${who}: ${text}\n`;
      });
    }
    convoPrompt += `User: ${prompt}\nAssistant:`;

    const petInfoLines = pets.map(p => {
      const birth = p.pet_birth_date
        ? `born ${p.pet_birth_date.toISOString().split('T')[0]}`
        : '';
      return `- ${p.pet_name} (${p.pet_species}, ${p.pet_breed}, ${p.pet_gender}) ${birth}`;
    });
    let augmentedPrompt = 
      `I am the owner of the following pets:\n` +
      petInfoLines.join('\n') +
      '\n\n';

    exams.forEach(({ petId, lastExam }) => {
      if (lastExam) {
        augmentedPrompt += `Latest exam for pet ID ${petId} on ${lastExam.examination_date.toISOString().split('T')[0]}: ` +
          `weight ${lastExam.weight} kg, temp ${lastExam.temperature}°C. ` +
          `Diagnoses: ${lastExam.diagnoses.map(d => `${d.name} (${d.severity})`).join(', ')}.\n`;
      }
    });
    augmentedPrompt += '\n';

    const llamaBody = {
      system_instruction: systemInstruction,
      prompt: augmentedPrompt + convoPrompt
    };

    const llamaRes = await fetch('http://10.0.0.25:5000/api/llama/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(llamaBody),
    });
    if (!llamaRes.ok) {
      throw new Error(`Llama service responded ${llamaRes.status}`);
    }
    const data = await llamaRes.json();

    // 8) Return the assistant’s reply
    return res.status(200).json({
      title: data.title,
      code: data.code,
      raw: data.raw
    });

  } catch (err) {
    console.error('⚠️ generateResponse error:', err);
    return res.status(500).json({ error: err.message });
  }
};
