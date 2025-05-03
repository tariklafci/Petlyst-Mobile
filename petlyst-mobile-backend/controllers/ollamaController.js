const pool = require('../config/db');

exports.generateResponse = async (req, res) => {
    const { prompt } = req.body;
  
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
  
    try {
      const fetchResponse = await fetch('http://10.0.1.2:5000/api/llama/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
  
      if (!fetchResponse.ok) {
        throw new Error(`Llama service responded with status ${fetchResponse.status}`);
      }
  
      const data = await fetchResponse.json();
  
      res.status(200).json({
        title: data.title,
        raw: data.raw
      });
  
    } catch (error) {
      console.error('Error contacting Llama service:', error.message);
      res.status(500).json({ error: 'Failed to fetch data from Llama service' });
    }
  };
  