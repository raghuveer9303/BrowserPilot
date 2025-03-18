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

  async clickElement(selector) {
    try {
      // First try standard click
      await this.page.click(selector);
    } catch (error) {
      // If standard click fails, try JS click
      await this.page.evaluate((selector) => {
        const element = document.querySelector(selector);
        if (element) element.click();
      }, selector);
    }
  }
  
  async typeText(selector, text) {
    // Clear field and type with proper focus handling
    await this.page.evaluate((selector) => {
      const element = document.querySelector(selector);
      if (element) element.focus();
    }, selector);
    
    await this.page.fill(selector, text);
  }
  
  async smartScroll(direction = 'down', amount = null) {
    await this.page.evaluate(({ direction, amount }) => {
      const scrollValue = amount || window.innerHeight * 0.8;
      window.scrollBy(0, direction === 'down' ? scrollValue : -scrollValue);
    }, { direction, amount });
  }

  async analyzePage() {
    return await this.page.evaluate(() => {
      // Find all interactive elements
      const interactiveElements = [];
      const elements = document.querySelectorAll('a, button, input, select, textarea, [role="button"]');
      
      elements.forEach((el, index) => {
        // Get element metadata
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        
        const isVisible = window.getComputedStyle(el).display !== 'none' && 
                          window.getComputedStyle(el).visibility !== 'hidden';
        if (!isVisible) return;
        
        // Add element to collection
        interactiveElements.push({
          index,
          tagName: el.tagName,
          id: el.id,
          className: el.className,
          text: el.innerText || el.value,
          rect: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          },
          isVisible: true
        });
      });
      
      return {
        url: window.location.href,
        title: document.title,
        interactiveElements
      };
    });
  }

  async executeCommand(command) {
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