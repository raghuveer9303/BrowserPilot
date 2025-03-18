// Core agent functionality
// - Agent class with constructor, initialization logic
// - run() method to execute tasks
// - step() method for taking individual steps
// - get_next_action() to query LLM
// - multi_act() to execute actions
// - _validate_output() for checking results
// - Planning/reasoning functions

class Agent {
  constructor(browserContext) {
    this.browserContext = browserContext;
    this.history = [];
    this.messageManager = new MessageManager();
  }

  async run(task) {
    try {
      const result = await this.step(task);
      return {
        success: true,
        result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async step(task) {
    // Get current page state
    const state = await this.browserContext.get_state();
    
    // Get next action from LLM
    const action = await this.get_next_action(state, task);
    
    // Execute action(s)
    const result = await this.multi_act(action);
    
    // Validate result
    this._validate_output(result);
    
    return result;
  }

  async get_next_action(state, task) {
    // Add context about the current page state
    this.messageManager.add_state_message({
      url: state.url,
      title: state.title,
      elements: await this.browserContext.get_clickable_elements()
    });

    // Add the user's task
    this.messageManager.add_state_message({
      task: task
    });

    // Get LLM response
    const gemini = new PlaywrightGemini({
      apiKey: process.env.GEMINI_API_KEY
    });

    const response = await gemini.chat(this.messageManager.get_messages());
    return this._parse_llm_response(response);
  }

  async multi_act(actions) {
    const results = [];
    for (const action of actions) {
      const result = await this.browserContext.execute_action(action);
      results.push(result);
      this.history.push({
        action,
        result,
        timestamp: Date.now()
      });
    }
    return results;
  }

  _validate_output(result) {
    if (!result) {
      throw new Error('Action produced no result');
    }
    // Add more validation as needed
  }

  async analyzePage() {
    const state = await this.browserContext.get_state(); // Get the current page state
    const clickableElements = await this.browserContext.get_clickable_elements(); // Fetch clickable elements
    return {
      url: state.url,
      title: state.title,
      interactiveElements: clickableElements,
    };
  }

  async executeCommand(command, context = {}) {
    // Example: Handle a "navigate" command
    if (command.type === 'navigate') {
      await this.browserContext.navigate_to(command.url);
      return { success: true, action: 'navigate', url: command.url };
    }

    // Add more command handling logic as needed
    throw new Error(`Unknown command type: ${command.type}`);
  }

  _parse_llm_response(response) {
    try {
      // Parse the LLM response into structured actions
      const actions = JSON.parse(response);
      return Array.isArray(actions) ? actions : [actions];
    } catch (error) {
      throw new Error(`Invalid LLM response format: ${error.message}`);
    }
  }
}

module.exports = { Agent };