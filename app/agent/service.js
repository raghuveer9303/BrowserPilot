const { MessageManager } = require('../message_manager/service');
const { PlaywrightGemini } = require('../playwright-gemini');

class Agent {
  constructor(browserContext) {
    this.browserContext = browserContext;
    this.messageManager = new MessageManager();
    this.systemPrompt = `You are a browser automation assistant. You can control the browser by returning valid JSON actions.
    Available actions:
    - click: { "type": "click", "selector": "CSS_SELECTOR" }
    - input: { "type": "input", "selector": "CSS_SELECTOR", "text": "TEXT" }
    - navigate: { "type": "navigate", "url": "URL" }
    - extract: { "type": "extract", "selector": "CSS_SELECTOR" }`;
  }

  async run(task) {
    try {
      // Add system prompt
      this.messageManager.add_state_message({ role: 'system', content: this.systemPrompt });
      
      // Get page state and add to context
      const state = await this.browserContext.get_state();
      this.messageManager.add_state_message({
        url: state.url,
        title: state.title,
        elements: await this._getVisibleElements()
      });

      // Add user task
      this.messageManager.add_state_message({ role: 'user', content: task });

      // Get LLM action plan
      const actions = await this._getActionPlan();
      
      // Execute actions
      const results = await this._executeActions(actions);

      return {
        success: true,
        actions: actions,
        results: results
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async _getVisibleElements() {
    const elements = await this.browserContext.get_clickable_elements();
    return elements.map((el, index) => ({
      index,
      selector: el.selector,
      tag: el.tag,
      text: el.text,
      isClickable: true
    }));
  }

  async _getActionPlan() {
    const gemini = new PlaywrightGemini({
      apiKey: process.env.GEMINI_API_KEY
    });

    const response = await gemini.chat(this.messageManager.get_messages());
    return this._parseActions(response);
  }

  async _executeActions(actions) {
    const results = [];
    for (const action of actions) {
      const result = await this.browserContext.execute_action(action);
      results.push(result);
    }
    return results;
  }

  _parseActions(response) {
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (error) {
      throw new Error(`Invalid action format: ${error.message}`);
    }
  }
}

module.exports = { Agent };