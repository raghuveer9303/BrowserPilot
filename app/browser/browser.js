const { chromium } = require('playwright');

class Browser {
  constructor(config = {}) {
    this.config = {
      headless: config.headless ?? false,
      slowMo: config.slowMo ?? 50,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ],
      ...config
    };
    this.browser = null;
  }

  async _init() {
    if (!this.browser) {
      this.browser = await chromium.launch(this.config);
    }
    return this.browser;
  }

  async new_context() {
    await this._init();
    return await this.browser.newContext();
  }

  get_playwright_browser() {
    return this.browser;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = { Browser };