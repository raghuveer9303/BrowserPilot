const { DOMElementNode, DOMTextNode } = require('./views');

class DomService {
  constructor(page) {
    this.page = page;
  }

  async get_clickable_elements(highlight = false) {
    const elements = await this.page.evaluate(() => {
      const clickable = [];
      const elements = document.querySelectorAll('a, button, [role="button"], input[type="submit"]');
      
      elements.forEach((el, index) => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          clickable.push({
            tag: el.tagName.toLowerCase(),
            text: el.innerText || el.value,
            index,
            attributes: {
              id: el.id,
              class: el.className,
              href: el.href,
              type: el.type
            }
          });
        }
      });
      
      return clickable;
    });

    if (highlight) {
      await this._highlight_elements(elements);
    }

    return elements;
  }

  async _build_dom_tree() {
    return await this.page.evaluate(() => {
      function processNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
          return {
            type: 'text',
            content: node.textContent.trim()
          };
        }
        
        if (node.nodeType === Node.ELEMENT_NODE) {
          const attributes = {};
          for (const attr of node.attributes) {
            attributes[attr.name] = attr.value;
          }
          
          return {
            type: 'element',
            tag: node.tagName.toLowerCase(),
            attributes,
            children: Array.from(node.childNodes)
              .map(child => processNode(child))
              .filter(Boolean)
          };
        }
        
        return null;
      }
      
      return processNode(document.body);
    });
  }

  async _highlight_elements(elements) {
    await this.page.evaluate((elements) => {
      elements.forEach(({ index, attributes }) => {
        const el = document.querySelector(`#${attributes.id}`) || 
                  document.querySelector(`.${attributes.class}`);
        if (el) {
          const highlight = document.createElement('div');
          highlight.style.position = 'absolute';
          highlight.style.border = '2px solid red';
          highlight.style.zIndex = '10000';
          
          const rect = el.getBoundingClientRect();
          highlight.style.top = `${rect.top}px`;
          highlight.style.left = `${rect.left}px`;
          highlight.style.width = `${rect.width}px`;
          highlight.style.height = `${rect.height}px`;
          
          document.body.appendChild(highlight);
        }
      });
    }, elements);
  }
}

module.exports = { DomService };