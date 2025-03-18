const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { chromium } = require('playwright');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { PlaywrightGemini } = require('./playwright-gemini');
const { Agent } = require('./agent/service'); // Import the Agent class
const { BrowserContext } = require('./browser/context'); // Import BrowserContext

// Add environment variables check
if (!process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY environment variable is required');
  process.exit(1);
}

// Initialize express app
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Session storage
const sessions = {};
const aiAgents = {};


// API endpoints for Browser-Use functionality
// - Session management
// - Agent initialization and task execution
// - Action handling
// - LLM integration
// - DOM state access
// - Screenshot and visualization


// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
// Add this to your server.js file
app.use('/vnc', express.static('/usr/share/novnc'));

// In your session creation endpoint
app.post('/api/session/create', async (req, res) => {
  try {
    const sessionId = uuidv4();
    const { startUrl } = req.body;
    
    console.log(`Creating session with ID: ${sessionId}, URL: ${startUrl || 'https://example.com'}`);
    
    // Launch browser with proper configuration for container environment
    const browser = await chromium.launch({
      headless: false,
      // Don't specify executablePath, let Playwright find it
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        `--display=:99`
      ]
    });
    
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      // Navigate to URL with timeout
      await page.goto(startUrl || 'https://example.com', { 
        timeout: 30000,
        waitUntil: 'domcontentloaded'
      });
      console.log(`Successfully navigated to ${startUrl || 'https://example.com'}`);
    } catch (navigationError) {
      console.error(`Navigation error: ${navigationError.message}`);
      // Continue anyway - we'll still create the session
    }
    
    // Store session
    sessions[sessionId] = {
      browser,
      context,
      page,
      isUserControlled: false,
      lastActivity: Date.now()
    };
    
    console.log(`Session ${sessionId} created successfully`);
    
    res.json({ 
      sessionId: sessionId,
      viewUrl: `/view/${sessionId}`,
      status: 'created'
    });
    
    // Set session timeout
    setTimeout(() => checkSessionTimeout(sessionId), 60000);
    
  } catch (error) {
    console.error('Failed to create session:', error);
    res.status(500).json({ error: 'Failed to create browser session: ' + error.message });
  }
});

// Update session creation
app.post('/api/session/create', async (req, res) => {
  try {
    const sessionId = uuidv4();
    const { startUrl } = req.body;
    
    // Launch browser with proper configuration
    const browser = await chromium.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--start-maximized',
        `--display=:99`
      ]
    });
    
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir: 'videos/' }
    });
    
    // Initialize the session
    sessions[sessionId] = {
      browser,
      context,
      page: await context.newPage(),
      agent: new Agent(new BrowserContext(context)),
      isUserControlled: false,
      lastActivity: Date.now()
    };

    // Navigate to start URL
    await sessions[sessionId].page.goto(startUrl || 'https://example.com');
    
    res.json({ 
      sessionId,
      viewUrl: `/view/${sessionId}`,
      status: 'created'
    });
    
  } catch (error) {
    console.error('Session creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// AI control interface route
app.get('/ai-control', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'ai-control.html'));
});


// AI command endpoint
app.post('/api/ai/command', async (req, res) => {
  try {
    const { sessionId, command } = req.body;

    if (!sessionId || !sessions[sessionId]) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessions[sessionId];

    // Initialize the agent if not already done
    if (!aiAgents[sessionId]) {
      const browserContext = new BrowserContext(session.context);
      aiAgents[sessionId] = new Agent(browserContext);
    }

    const agent = aiAgents[sessionId];

    // Add DOM analysis to context
    const pageAnalysis = await agent.analyzePage();

    // Execute with enhanced context
    const result = await agent.run(command);

    // Return results with DOM information
    res.json({
      result,
      pageAnalysis: {
        url: pageAnalysis.url,
        title: pageAnalysis.title,
        elementCount: pageAnalysis.interactiveElements.length,
      },
      status: 'success',
    });
  } catch (error) {
    console.error('AI command error:', error);
    res.status(500).json({ error: error.message });
  }
});

// AI chat endpoint
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    
    if (!sessionId || !sessions[sessionId]) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Get or create AI agent for this session
    if (!aiAgents[sessionId]) {
      aiAgents[sessionId] = new PlaywrightGemini({
        apiKey: process.env.GEMINI_API_KEY
      });
    }
    
    const agent = aiAgents[sessionId];
    await agent.connectToPage(sessions[sessionId].page);
    
    // Chat with the AI
    const response = await agent.chat([
      { role: 'user', content: message }
    ]);
    
    // Update last activity timestamp
    sessions[sessionId].lastActivity = Date.now();
    
    res.json({
      response,
      status: 'success'
    });
    
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Clean up AI agents when sessions are closed
const originalCleanupSession = cleanupSession;
cleanupSession = async function(sessionId) {
  if (aiAgents[sessionId]) {
    delete aiAgents[sessionId];
  }
  await originalCleanupSession(sessionId);
};



app.post('/api/session/:sessionId/control', async (req, res) => {
  const { sessionId } = req.params;
  const { enable } = req.body;
  
  if (!sessions[sessionId]) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  sessions[sessionId].isUserControlled = enable;
  res.json({ status: 'success', isUserControlled: enable });
});

app.post('/api/session/:sessionId/execute', async (req, res) => {
  const { sessionId } = req.params;
  const { actions } = req.body;
  
  if (!sessions[sessionId]) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  if (sessions[sessionId].isUserControlled) {
    return res.status(400).json({ error: 'Session is in user control mode' });
  }
  
  try {
    const { page } = sessions[sessionId];
    const results = [];
    
    for (const action of actions) {
      let result;
      
      switch (action.type) {
        case 'click':
          await page.click(action.selector);
          result = { status: 'success', action: 'click' };
          break;
        case 'type':
          await page.fill(action.selector, action.value);
          result = { status: 'success', action: 'type' };
          break;
        case 'extract':
          const extracted = await page.evaluate((selector) => {
            return document.querySelector(selector)?.innerText || null;
          }, action.selector);
          result = { status: 'success', action: 'extract', data: extracted };
          break;
        default:
          result = { status: 'error', message: 'Unknown action type' };
      }
      
      results.push(result);
    }
    
    // Update last activity
    sessions[sessionId].lastActivity = Date.now();
    
    res.json({ results });
    
  } catch (error) {
    console.error('Failed to execute actions:', error);
    res.status(500).json({ error: 'Failed to execute actions' });
  }
});

app.get('/view/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  if (!sessions[sessionId]) {
    return res.status(404).send('Session not found');
  }
  
  res.sendFile(path.join(__dirname, 'public', 'viewer.html'));
});

app.delete('/api/session/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  
  if (!sessions[sessionId]) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  await cleanupSession(sessionId);
  res.json({ status: 'terminated' });
});

// Socket.io for real-time communication
io.on('connection', (socket) => {
  console.log('Client connected');
  let currentSessionId = null;
  
  socket.on('join-session', (sessionId) => {
    currentSessionId = sessionId;
    socket.join(sessionId);
    console.log(`Client joined session: ${sessionId}`);
    
    if (sessions[sessionId]) {
      sessions[sessionId].lastActivity = Date.now();
    }
  });
  
  socket.on('browser-command', async (data) => {
    const { sessionId, command, params } = data;
    
    if (!sessions[sessionId] || !sessions[sessionId].isUserControlled) {
      socket.emit('error', { message: 'Session not found or not in user control mode' });
      return;
    }
    
    try {
      const { page } = sessions[sessionId];
      
      switch (command) {
        case 'click':
          await page.click(params.selector);
          break;
        case 'type':
          await page.fill(params.selector, params.text);
          break;
        case 'navigate':
          await page.goto(params.url);
          break;
        case 'back':
          await page.goBack();
          break;
        case 'forward':
          await page.goForward();
          break;
        case 'refresh':
          await page.reload();
          break;
      }
      
      sessions[sessionId].lastActivity = Date.now();
      socket.emit('command-result', { status: 'success' });
      
    } catch (error) {
      console.error('Browser command error:', error);
      socket.emit('command-result', { status: 'error', message: error.message });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Helper functions
async function cleanupSession(sessionId) {
  if (sessions[sessionId]) {
    try {
      const { browser } = sessions[sessionId];
      await browser.close();
    } catch (error) {
      console.error(`Error closing browser for session ${sessionId}:`, error);
    }
    
    delete sessions[sessionId];
    console.log(`Session ${sessionId} cleaned up`);
  }
}

function checkSessionTimeout(sessionId) {
  const session = sessions[sessionId];
  if (!session) return;
  
  const now = Date.now();
  const inactiveTime = now - session.lastActivity;
  
  // Close sessions inactive for more than 30 minutes
  if (inactiveTime > 30 * 60 * 1000) {
    console.log(`Session ${sessionId} timed out after inactivity`);
    cleanupSession(sessionId);
  } else {
    // Check again later
    setTimeout(() => checkSessionTimeout(sessionId), 60000);
  }
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});