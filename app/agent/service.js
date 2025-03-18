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
        boundingBox: el.boundingBox,
        isClickable: true,
        isVisible: el.boundingBox.width > 0 && el.boundingBox.height > 0
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
      const result = await this._executeAction(action);
      results.push(result);
    }
    return results;
  }

  async _executeAction(action) {
    try {
        switch (action.type) {
            case 'click':
                if (action.boundingBox) {
                    await this.browserContext.page.mouse.click(
                        action.boundingBox.x + action.boundingBox.width / 2,
                        action.boundingBox.y + action.boundingBox.height / 2
                    );
                } else {
                    await this.browserContext.click_element_node(action.selector);
                }
                return { success: true, action: 'click' };

            case 'input':
                await this.browserContext.input_text_element_node(action.selector, action.text);
                return { success: true, action: 'input' };

            case 'navigate':
                await this.browserContext.navigate_to(action.url);
                return { success: true, action: 'navigate' };

            case 'extract':
                const content = await this.browserContext.page.$eval(action.selector, el => el.textContent);
                return { success: true, action: 'extract', content };

            default:
                throw new Error(`Unknown action type: ${action.type}`);
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
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