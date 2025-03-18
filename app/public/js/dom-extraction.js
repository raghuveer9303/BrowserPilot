// Add to public/js/dom-extraction.js
// Client-side DOM extraction
// - buildDomTree() function to crawl page
// - Element classification (interactive, visible)
// - Element highlighting
// - Tree construction with metadata

function buildDomTree(options = {}) {
  const {
    highlightElements = true,
    viewportExpansion = 300
  } = options;

  const elementMap = new Map();
  let highlightIndex = 0;

  function isInteractiveElement(element) {
    const interactiveTags = ['a', 'button', 'input', 'select', 'textarea'];
    const interactiveRoles = ['button', 'link', 'menuitem', 'tab'];
    
    return (
      interactiveTags.includes(element.tagName.toLowerCase()) ||
      element.hasAttribute('onclick') ||
      element.hasAttribute('role') && interactiveRoles.includes(element.getAttribute('role'))
    );
  }

  function isVisibleElement(element) {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    
    return !(
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0' ||
      rect.width === 0 ||
      rect.height === 0
    );
  }

  function getElementMetadata(element) {
    return {
      tag: element.tagName.toLowerCase(),
      id: element.id,
      className: element.className,
      textContent: element.textContent.trim(),
      href: element.href,
      value: element.value,
      type: element.type,
      rect: element.getBoundingClientRect(),
      isInteractive: isInteractiveElement(element),
      isVisible: isVisibleElement(element)
    };
  }

  function processNode(node, depth = 0) {
    if (!node) return null;

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.trim();
      return text ? { type: 'text', content: text } : null;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const metadata = getElementMetadata(node);
      
      if (metadata.isVisible && metadata.isInteractive) {
        metadata.highlightIndex = highlightIndex++;
        elementMap.set(metadata.highlightIndex, node);
      }

      const children = Array.from(node.childNodes)
        .map(child => processNode(child, depth + 1))
        .filter(Boolean);

      return {
        type: 'element',
        ...metadata,
        children
      };
    }

    return null;
  }

  const tree = processNode(document.body);
  return { tree, elementMap };
}

function highlightElement(element, index) {
  const highlight = document.createElement('div');
  highlight.className = 'element-highlight';
  highlight.style.cssText = `
    position: fixed;
    border: 2px solid red;
    background: rgba(255, 0, 0, 0.1);
    z-index: 10000;
    pointer-events: none;
  `;
  
  const rect = element.getBoundingClientRect();
  highlight.style.top = `${rect.top}px`;
  highlight.style.left = `${rect.left}px`;
  highlight.style.width = `${rect.width}px`;
  highlight.style.height = `${rect.height}px`;
  
  highlight.setAttribute('data-highlight-index', index);
  document.body.appendChild(highlight);
}

module.exports = {
  buildDomTree,
  highlightElement
};