const { GoogleGenerativeAI } = require('@google/generative-ai');

class PlaywrightGemini {
  constructor({ apiKey }) {
    if (!apiKey) {
      throw new Error('API key is required for Google Gemini integration');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.page = null;
  }

  async connectToPage(page) {
    this.page = page;
  }

  async chat(messages) {
    if (!this.page) {
      throw new Error('No page connected to PlaywrightGemini');
    }

    const formattedMessages = messages.map((msg) => ({
      role: msg.role === 'system' ? 'user' : msg.role,
      parts: [{ text: msg.content }],
    }));

    const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
    const chat = model.startChat({
      history: formattedMessages.slice(0, -1),
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        topK: 40,
      },
    });

    const lastMessage = formattedMessages[formattedMessages.length - 1];
    const result = await chat.sendMessage(lastMessage.parts[0].text);
    return result.response.text();
  }
}

module.exports = { PlaywrightGemini };