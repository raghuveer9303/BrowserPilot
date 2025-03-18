const express = require('express');
const { BrowserUse } = require('browser-use');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { v4: uuidv4 } = require('uuid');

// Setup BrowserUse API router
function setupBrowserUseAPI(app, sessions) {
  // Initialize Google Gemini API
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'your-api-key');
  
  // Initialize BrowserUse with custom Gemini configuration
  const browserUse = new BrowserUse({
    // Override the default LLM provider with our custom Gemini implementation
    llmProvider: {
      chat: async function(messages) {
        // Convert BrowserUse message format to Gemini format
        const formattedMessages = messages.map(msg => ({
          role: msg.role === 'system' ? 'user' : msg.role, // Gemini doesn't have system role
          parts: [{ text: msg.content }]
        }));
        
        // Create Gemini model instance
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        
        // Start chat session
        const chat = model.startChat({
          history: formattedMessages.slice(0, -1),
          generationConfig: {
            temperature: 0.2,
            topP: 0.8,
            topK: 40,
          }
        });
        
        // Get response for the last message
        const lastMessage = formattedMessages[formattedMessages.length - 1];
        const result = await chat.sendMessage(lastMessage.parts[0].text);
        const response = result.response.text();
        
        return response;
      }
    },
    browserWSEndpoint: null, // Will connect to our Playwright instances
  });

  // Endpoint to process LLM commands
  app.post('/api/llm/command', async (req, res) => {
    try {
      const { sessionId, command } = req.body;
      
      if (!sessionId || !sessions[sessionId]) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      const session = sessions[sessionId];
      
      // Connect BrowserUse to the existing Playwright page
      await browserUse.connectToPage(session.page);
      
      // Process the natural language command
      const result = await browserUse.executeCommand(command);
      
      // Update last activity timestamp
      session.lastActivity = Date.now();
      
      res.json({ 
        result,
        status: 'success'
      });
      
    } catch (error) {
      console.error('LLM command error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Chat interface for conversational browser control
  app.post('/api/llm/chat', async (req, res) => {
    try {
      const { sessionId, message, history = [] } = req.body;
      
      if (!sessionId || !sessions[sessionId]) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      const session = sessions[sessionId];
      
      // Connect BrowserUse to the existing Playwright page
      await browserUse.connectToPage(session.page);
      
      // Get current page information for context
      const pageInfo = await session.page.evaluate(() => {
        return {
          url: window.location.href,
          title: document.title,
          elementCount: document.querySelectorAll('*').length
        };
      });
      
      // Add page context to the conversation
      const contextualHistory = [
        { role: 'system', content: `Current page: ${pageInfo.url} (${pageInfo.title})` },
        ...history,
        { role: 'user', content: message }
      ];
      
      // Process the chat message
      const chatResponse = await browserUse.chat(contextualHistory);
      
      // Update last activity timestamp
      session.lastActivity = Date.now();
      
      res.json({
        response: chatResponse,
        pageInfo,
        status: 'success'
      });
      
    } catch (error) {
      console.error('LLM chat error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get screenshot with highlights
  app.get('/api/llm/screenshot/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { selector } = req.query;
      
      if (!sessionId || !sessions[sessionId]) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      const session = sessions[sessionId];
      
      // Connect BrowserUse to the existing Playwright page
      await browserUse.connectToPage(session.page);
      
      // Take screenshot with optional element highlight
      let screenshot;
      if (selector) {
        screenshot = await browserUse.screenshotWithHighlight(selector);
      } else {
        screenshot = await session.page.screenshot({ type: 'png' });
      }
      
      // Update last activity timestamp
      session.lastActivity = Date.now();
      
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': screenshot.length
      });
      res.end(screenshot);
      
    } catch (error) {
      console.error('Screenshot error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return browserUse;
}

module.exports = { setupBrowserUseAPI };