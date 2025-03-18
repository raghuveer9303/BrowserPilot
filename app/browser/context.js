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

  async execute_action(action) {
    const page = await this.get_current_page();
    
    switch(action.type) {
      case 'click':
        await page.click(action.selector);
        return { success: true, action: 'click' };
        
      case 'input':
        await page.fill(action.selector, action.text);
        return { success: true, action: 'input' };
        
      case 'navigate':
        await page.goto(action.url);
        return { success: true, action: 'navigate' };
        
      case 'extract':
        const content = await page.$eval(action.selector, el => el.textContent);
        return { success: true, action: 'extract', content };
        
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  async get_clickable_elements() {
    const page = await this.get_current_page();
    return await page.evaluate(() => {
        const elements = document.querySelectorAll('a, button, [role="button"], input[type="submit"]');
        return Array.from(elements).map((el) => {
            const rect = el.getBoundingClientRect();
            return {
                tag: el.tagName.toLowerCase(),
                text: el.innerText || el.value || '',
                selector: generateUniqueSelector(el),
                boundingBox: {
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height
                },
                attributes: {
                    id: el.id,
                    class: el.className,
                    href: el.href,
                    type: el.type,
                }
            };
        });

        function generateUniqueSelector(el) {
            if (el.id) return `#${el.id}`;
            if (el.className) {
                const classes = el.className.split(' ').filter(Boolean);
                if (classes.length) return `.${classes.join('.')}`;
            }
            return `${el.tagName.toLowerCase()}`;
        }
    });
  }
}

module.exports = { BrowserContext };