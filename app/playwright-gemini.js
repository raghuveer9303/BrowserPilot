const { GoogleGenerativeAI } = require('@google/generative-ai');

class PlaywrightGemini {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY;
    this.model = options.model || 'gemini-2.0-flash';
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.page = null;
    this.chatHistory = [];
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
      throw new Error('No browser page connected');
    }

    // Add command to history
    this.chatHistory.push({ role: 'user', content: command });

    // Get page context for the AI
    const pageInfo = await this._getPageInfo();

    // Create prompt for Gemini
    const prompt = `
You are a browser automation assistant.
Current URL: ${pageInfo.url}
Page Title: ${pageInfo.title}

The user has requested: "${command}"

Your task is to control the browser by responding with a valid JSON object containing actions.
Valid actions are:
- navigate(url): Navigate to a URL
- click(selector): Click on an element matching the CSS selector
- type(selector, text): Type text into an element matching the CSS selector
- extract(selector): Extract text from an element matching the CSS selector

Example response:
{
  "action": "click",
  "params": {
    "selector": ".login-button"
  },
  "explanation": "Clicking the login button"
}`;

    try {
      // Generate response from Gemini
      const model = this.genAI.getGenerativeModel({ model: this.model });
      const result = await model.generateContent(prompt);
      const response = result.response.text();

      // Parse action from response
      let action;
      try {
        // Find JSON in the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          action = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No valid JSON found in response');
        }
      } catch (parseError) {
        console.error('Error parsing action:', parseError);
        throw new Error(`Failed to parse AI response: ${response}`);
      }

      // Execute the action
      const actionResult = await this._executeAction(action);

      // Add AI response to history
      this.chatHistory.push({ 
        role: 'assistant', 
        content: `Executed: ${action.explanation || action.action}`
      });

      return {
        action,
        result: actionResult,
        explanation: action.explanation || 'Action executed successfully'
      };
    } catch (error) {
      console.error('Error executing command:', error);
      throw error;
    }
  }

  async _executeAction(action) {
    switch (action.action) {
      case 'navigate':
        await this.page.goto(action.params.url);
        return { success: true, url: action.params.url };
      
      case 'click':
        await this.page.click(action.params.selector);
        return { success: true, selector: action.params.selector };
      
      case 'type':
        await this.page.fill(action.params.selector, action.params.text);
        return { success: true, selector: action.params.selector, text: action.params.text };
      
      case 'extract':
        const text = await this.page.evaluate((selector) => {
          const element = document.querySelector(selector);
          return element ? element.textContent : null;
        }, action.params.selector);
        return { success: true, selector: action.params.selector, text };
      
      default:
        throw new Error(`Unknown action: ${action.action}`);
    }
  }

  async _getPageInfo() {
    return await this.page.evaluate(() => ({
      url: window.location.href,
      title: document.title,
      visibleText: document.body.innerText.slice(0, 1000) // First 1000 chars of visible text
    }));
  }

  async chat(messages) {
    // Combine provided messages with chat history
    const allMessages = [...this.chatHistory, ...messages];
    
    // Get page context
    const pageInfo = await this._getPageInfo();
    
    // Add system message with page context
    const systemMessage = `
You are a helpful browser assistant.
Current URL: ${pageInfo.url}
Page Title: ${pageInfo.title}
Visible text excerpt: ${pageInfo.visibleText}

You can suggest actions like "click on X" or "navigate to Y" but don't pretend to execute them yourself.
Provide conversational responses to help the user navigate the web page.`;

    // Generate response
    const model = this.genAI.getGenerativeModel({ model: this.model });
    const chat = model.startChat({
      history: allMessages.slice(0, -1).map(msg => ({
        role: msg.role === 'system' ? 'user' : msg.role,
        parts: [{ text: msg.content }]
      })),
      generationConfig: {
        temperature: 0.2,
      }
    });

    const lastMessage = messages[messages.length - 1];
    const combinedPrompt = `${systemMessage}\n\nUser message: ${lastMessage.content}`;
    
    const result = await chat.sendMessage(combinedPrompt);
    const response = result.response.text();
    
    // Update chat history
    this.chatHistory.push(lastMessage);
    this.chatHistory.push({ role: 'assistant', content: response });
    
    return response;
  }
}

module.exports = { PlaywrightGemini };