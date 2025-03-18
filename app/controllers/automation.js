const express = require('express');
const router = express.Router();
const { Agent } = require('../agent/service');
const { BrowserContext } = require('../browser/context');

class AutomationController {
  constructor() {
    this.router = router;
    this.setupRoutes();
  }

  setupRoutes() {
    // Execute automation task
    this.router.post('/execute', this.executeTask.bind(this));
    
    // Get page state
    this.router.get('/state/:sessionId', this.getPageState.bind(this));
    
    // Control browser
    this.router.post('/control/:sessionId', this.controlBrowser.bind(this));
  }

  async executeTask(req, res) {
    try {
      const { sessionId, task } = req.body;
      
      if (!global.sessions[sessionId]) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const session = global.sessions[sessionId];
      const agent = new Agent(new BrowserContext(session.context));
      
      const result = await agent.run(task);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getPageState(req, res) {
    try {
      const { sessionId } = req.params;
      
      if (!global.sessions[sessionId]) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const session = global.sessions[sessionId];
      const browserContext = new BrowserContext(session.context);
      const state = await browserContext.get_state();
      
      res.json(state);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async controlBrowser(req, res) {
    try {
      const { sessionId } = req.params;
      const { action } = req.body;
      
      if (!global.sessions[sessionId]) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const session = global.sessions[sessionId];
      const browserContext = new BrowserContext(session.context);
      
      const result = await browserContext.execute_action(action);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new AutomationController().router;