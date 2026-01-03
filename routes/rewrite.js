var express = require('express');
var router = express.Router();
var { GoogleGenerativeAI } = require('@google/generative-ai');

// Gemini API Key
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyCiHOZWkYUR0xzU55oiPyCd1kHL2LH7j5k';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Rewrite text using Gemini
router.post('/rewrite', async function(req, res, next) {
  try {
    const { text, style, creativity } = req.body;

    // Validate input
    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Text is required'
      });
    }

    // Style mapping
    const stylePrompts = {
      professional: 'Rewrite this text in a professional and formal tone while maintaining the original meaning.',
      casual: 'Rewrite this text in a casual and friendly tone while maintaining the original meaning.',
      creative: 'Rewrite this text in a creative and engaging way while maintaining the original meaning.',
      academic: 'Rewrite this text in an academic and scholarly tone while maintaining the original meaning.',
      simple: 'Rewrite this text in simple and easy-to-understand language while maintaining the original meaning.',
    };

    const stylePrompt = stylePrompts[style] || stylePrompts.professional;
    const creativityLevel = creativity || 7; // 1-10 scale

    // Build the prompt
    const prompt = `${stylePrompt}
    
Please rewrite the following text. Make it natural and maintain the original meaning. Do not add any explanations or comments, just provide the rewritten text.

Original text:
${text}`;

    // Get the Gemini model (using gemini-1.5-flash for faster responses)
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: creativityLevel / 10, // Scale 1-10 to 0.1-1.0
        topP: 0.95,
        topK: 40,
      }
    });

    // Generate content
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const rewrittenText = response.text().trim();

    if (!rewrittenText) {
      return res.status(500).json({
        success: false,
        error: 'No rewritten text was generated. Please try again.'
      });
    }

    res.json({
      success: true,
      data: {
        originalText: text,
        rewrittenText: rewrittenText,
        style: style || 'professional',
        creativity: creativityLevel
      }
    });

  } catch (error) {
    console.error('Error rewriting text:', error);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to rewrite text. Please try again later.'
    });
  }
});

module.exports = router;

