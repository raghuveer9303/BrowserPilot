const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { Browser } = require('./browser/browser');
const { BrowserContext } = require('./browser/context');
const { Agent } = require('./agent/service');
const automationController = require('./controllers/automation');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Global session storage
global.sessions = {};

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session cleanup interval
setInterval(() => {
  const now = Date.now();
  Object.entries(sessions).forEach(([id, session]) => {
    if (now - session.lastActivity > 30 * 60 * 1000) { // 30 minutes timeout
      session.browser.close();
      delete sessions[id];
    }
  });
}, 5 * 60 * 1000); // Check every 5 minutes

// Routes
app.use('/api/automation', automationController);

// Session management routes
app.post('/api/session/create', async (req, res) => {
  try {
    const sessionId = uuidv4();
    const { startUrl } = req.body;
    
    const browser = new Browser({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--start-maximized',
        `--display=:99`
      ]
    });
    
    const context = await browser.new_context();
    const page = await context.newPage();
    
    sessions[sessionId] = {
      browser,
      context,
      page,
      lastActivity: Date.now()
    };
    
    if (startUrl) {
      await page.goto(startUrl);
    }
    
    res.json({ 
      sessionId,
      status: 'created'
    });
  } catch (error) {
    console.error('Session creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Browser control endpoint
app.post('/api/browser/:sessionId/action', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { action } = req.body;
    
    if (!sessions[sessionId]) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const session = sessions[sessionId];
    const browserContext = new BrowserContext(session.context);
    const result = await browserContext.execute_action(action);
    
    session.lastActivity = Date.now();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI control endpoint
app.post('/api/ai/command', async (req, res) => {
  try {
    const { sessionId, command } = req.body;
    
    if (!sessions[sessionId]) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const session = sessions[sessionId];
    const browserContext = new BrowserContext(session.context);
    const agent = new Agent(browserContext);
    
    const result = await agent.run(command);
    
    session.lastActivity = Date.now();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected');
  
  socket.on('join-session', (sessionId) => {
    if (sessions[sessionId]) {
      socket.join(sessionId);
      socket.emit('session-joined', { status: 'connected' });
    }
  });
  
  socket.on('browser-command', async (data) => {
    try {
      const { sessionId, command, params } = data;
      
      if (!sessions[sessionId]) {
        socket.emit('error', { message: 'Session not found' });
        return;
      }
      
      const session = sessions[sessionId];
      const browserContext = new BrowserContext(session.context);
      
      let result;
      switch (command) {
        case 'back':
          await browserContext.go_back();
          result = { status: 'success' };
          break;
        case 'forward':
          await session.page.goForward();
          result = { status: 'success' };
          break;
        case 'refresh':
          await browserContext.refresh_page();
          result = { status: 'success' };
          break;
        case 'navigate':
          await browserContext.navigate_to(params.url);
          result = { status: 'success' };
          break;
        default:
          throw new Error(`Unknown command: ${command}`);
      }
      
      session.lastActivity = Date.now();
      socket.emit('command-result', result);
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
});

// Viewer route
app.get('/view/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  if (!sessions[sessionId]) {
    return res.status(404).send('Session not found');
  }
  res.sendFile(path.join(__dirname, 'public', 'viewer.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});