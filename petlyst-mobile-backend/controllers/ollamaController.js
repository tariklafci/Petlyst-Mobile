exports.generateResponse = async (req, res) => {
  const { prompt, history } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  // 1) Stitch together history + new user turn into one prompt blob
  let convoPrompt = '';
  if (Array.isArray(history)) {
    // Client is sending you the previous messages
    history.forEach(({ sender, text }) => {
      const who = sender === 'bot' ? 'Assistant' : 'User';
      convoPrompt += `${who}: ${text}\n`;
    });
  }
  // Append this new question and cue the assistant
  convoPrompt += `User: ${prompt}\nAssistant:`;

  try {
    // 2) Call your Flask /api/llama/generate
    const llamaRes = await fetch('http://192.168.0.101:5000/api/llama/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: convoPrompt }),
    });

    if (!llamaRes.ok) {
      throw new Error(`Llama service responded ${llamaRes.status}`);
    }

    const data = await llamaRes.json();

    // 3) Return exactly what the app needs
    return res.status(200).json({
      title: data.title,
      code: data.code,
      raw: data.raw,
    });
  } catch (err) {
    console.error('⚠️ Llama call failed:', err.message);
    return res.status(500).json({ error: 'Failed to fetch from Llama service' });
  }
};
