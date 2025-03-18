// Action execution controller
// - Controller class
// - act() method to handle actions
// - action() decorator equivalent for registering handlers
// - Default built-in actions:
//   * click_element, input_text, go_to_url
//   * scroll_down, scroll_up
//   * extract_content, search_google
//   * switch_tab, open_tab, close_tab
//   * done action to complete tasks

class Controller {
  constructor(browserContext) {
    this.browserContext = browserContext;
    this.actions = new Map();
    this.registerDefaultActions();
  }

  registerDefaultActions() {
    this.registerAction('click_element', async (params) => {
      await this.browserContext.click_element_node(params.selector);
      return { success: true, action: 'click' };
    });

    this.registerAction('input_text', async (params) => {
      await this.browserContext.input_text_element_node(params.selector, params.text);
      return { success: true, action: 'input' };
    });

    this.registerAction('go_to_url', async (params) => {
      await this.browserContext.navigate_to(params.url);
      return { success: true, action: 'navigate' };
    });

    this.registerAction('scroll_down', async (params) => {
      await this.browserContext.execute_javascript(`
        window.scrollBy(0, ${params.amount || 300});
      `);
      return { success: true, action: 'scroll' };
    });

    this.registerAction('extract_content', async (params) => {
      const content = await this.browserContext.execute_javascript(`
        return document.querySelector('${params.selector}')?.textContent;
      `);
      return { success: true, action: 'extract', content };
    });
  }

  registerAction(name, handler) {
    this.actions.set(name, handler);
  }

  async act(actionName, params) {
    const handler = this.actions.get(actionName);
    if (!handler) {
      throw new Error(`Unknown action: ${actionName}`);
    }
    return await handler(params);
  }
}

module.exports = { Controller };