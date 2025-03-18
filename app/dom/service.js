const { DOMElementNode, DOMTextNode } = require('./views');

class DomService {
  constructor(page) {
    this.page = page;
  }

  async get_clickable_elements(highlight = false) {
    const elements = await this.page.evaluate(() => {
      const clickable = [];
      const elems = document.querySelectorAll('a, button, [role="button"], input[type="submit"]');
      elems.forEach((el, index) => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          clickable.push({
            tag: el.tagName.toLowerCase(),
            text: el.innerText || el.value || '',
            index,
            selector: generateUniqueSelector(el),
            attributes: {
              id: el.id,
              class: el.className,
              href: el.href,
              type: el.type
            }
          });
        }
      });
      function generateUniqueSelector(el) {
        if (el.id) return '#' + el.id;
        if (el.className) {
          const classes = el.className.split(' ').filter(Boolean);
          if (classes.length) return '.' + classes.join('.');
        }
        return el.tagName.toLowerCase();
      }
      return clickable;
    });

    if (highlight) {
      await this._highlight_elements(elements);
    }
    return elements;
  }

  async _highlight_elements(elements) {
    await this.page.evaluate((elements) => {
      elements.forEach(({ selector }) => {
        const el = document.querySelector(selector);
        if (el) {
          const highlight = document.createElement('div');
          highlight.style.position = 'absolute';
          highlight.style.border = '2px solid red';
          highlight.style.zIndex = '10000';
          const rect = el.getBoundingClientRect();
          highlight.style.top = `${rect.top + window.scrollY}px`;
          highlight.style.left = `${rect.left + window.scrollX}px`;
          highlight.style.width = `${rect.width}px`;
          highlight.style.height = `${rect.height}px`;
          document.body.appendChild(highlight);
        }
      });
    }, elements);
  }
  
  async extract_dom_tree() {
    // Extract a serialized DOM tree starting from the document's body.
    const tree = await this.page.evaluate(() => {
      function processNode(node) {
        if (!node) return null;
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent.trim();
          return text ? { type: 'text', content: text } : null;
        }
        if (node.nodeType === Node.ELEMENT_NODE) {
          const children = [];
          node.childNodes.forEach(child => {
            const processed = processNode(child);
            if (processed) {
              children.push(processed);
            }
          });
          return {
            type: 'element',
            tag: node.tagName.toLowerCase(),
            attributes: Array.from(node.attributes).reduce((attrs, attr) => {
              attrs[attr.name] = attr.value;
              return attrs;
            }, {}),
            children: children
          };
        }
        return null;
      }
      return processNode(document.body);
    });
    return tree;
  }

  async _processDomTree() {
    // Retrieve the DOM tree and calculate metrics: total node count and maximum depth.
    const domTree = await this.extract_dom_tree();
    
    function traverse(node, depth = 0) {
      if (!node) return { count: 0, maxDepth: depth };
      let count = 1;
      let maxDepth = depth;
      if (node.children && node.children.length > 0) {
        node.children.forEach(child => {
          const result = traverse(child, depth + 1);
          count += result.count;
          if (result.maxDepth > maxDepth) {
            maxDepth = result.maxDepth;
          }
        });
      }
      return { count, maxDepth };
    }
    
    const metrics = traverse(domTree);
    return { tree: domTree, metrics };
  }

  async highlightElement(selector) {
    await this.page.evaluate((selector) => {
      const element = document.querySelector(selector);
      if (element) {
        const highlight = document.createElement('div');
        highlight.style.position = 'absolute';
        highlight.style.border = '2px solid red';
        highlight.style.zIndex = '10000';
        const rect = element.getBoundingClientRect();
        highlight.style.top = `${rect.top}px`;
        highlight.style.left = `${rect.left}px`;
        highlight.style.width = `${rect.width}px`;
        highlight.style.height = `${rect.height}px`;
        document.body.appendChild(highlight);
      }
    }, selector);
  }
}

module.exports = { DomService };