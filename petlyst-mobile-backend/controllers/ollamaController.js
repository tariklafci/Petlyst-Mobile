exports.generateResponse = async (req, res) => {
  const { prompt, history } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  // 1) Stitch together history + new turn
  let convoPrompt = '';
  if (Array.isArray(history)) {
    history.forEach(({ sender, text }) => {
      const who = sender === 'bot' ? 'Assistant' : 'User';
      convoPrompt += `${who}: ${text}\n`;
    });
  }
  convoPrompt += `User: ${prompt}\nAssistant:`;

  try {
    // 2) Call your Flask /api/llama/generate
    const llamaRes = await fetch('http://10.0.0.25:5000/api/llama/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: convoPrompt }),
    });

    if (!llamaRes.ok) {
      throw new Error(`Llama service responded ${llamaRes.status}`);
    }
    const data = await llamaRes.json();

    // 3) Reply to client
    return res.status(200).json({
      title: data.title,
      code: data.code,
      raw: data.raw
    });
  } catch (err) {
    console.error('⚠️ Llama call failed:', err.message);
    return res.status(500).json({ error: 'Failed to fetch from Llama service' });
  }
};
