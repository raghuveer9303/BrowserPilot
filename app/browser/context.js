const { DOMElementNode, DOMTextNode } = require('../dom/views');

class BrowserContext {
  constructor(context) {
    this.context = context;
    this.currentPage = null;
  }

  async get_current_page() {
    if (!this.currentPage) {
      this.currentPage = await this.context.newPage();
    }
    return this.currentPage;
  }

  async get_state() {
    const page = await this.get_current_page();
    const url = page.url();
    const title = await page.title();
    const html = await this.get_page_html();
    
    return {
      url,
      title,
      html,
      timestamp: Date.now()
    };
  }

  async navigate_to(url) {
    const page = await this.get_current_page();
    await page.goto(url);
  }

  async refresh_page() {
    const page = await this.get_current_page();
    await page.reload();
  }

  async go_back() {
    const page = await this.get_current_page();
    await page.goBack();
  }

  async get_page_html() {
    const page = await this.get_current_page();
    return await page.content();
  }

  async execute_javascript(code) {
    const page = await this.get_current_page();
    return await page.evaluate(code);
  }

  async click_element_node(selector) {
    const page = await this.get_current_page();
    await page.click(selector);
  }

  async input_text_element_node(selector, text) {
    const page = await this.get_current_page();
    await page.fill(selector, text);
  }

  async take_screenshot() {
    const page = await this.get_current_page();
    return await page.screenshot();
  }
}

module.exports = { BrowserContext };