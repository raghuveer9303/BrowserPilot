// DOM structure models
// - DOMElementNode class (tag, attributes, children)
// - DOMTextNode class (text content)
// - Element tree traversal and filtering
// - Serialization to structured format

class DOMElementNode {
  constructor(tag, attributes = {}) {
    this.tag = tag;
    this.attributes = attributes;
    this.children = [];
    this.parent = null;
  }

  addChild(child) {
    child.parent = this;
    this.children.push(child);
  }

  serialize() {
    return {
      type: 'element',
      tag: this.tag,
      attributes: this.attributes,
      children: this.children.map(child => child.serialize())
    };
  }
}

class DOMTextNode {
  constructor(text) {
    this.text = text;
    this.parent = null;
  }

  serialize() {
    return {
      type: 'text',
      content: this.text
    };
  }
}

function filterElements(root, predicate) {
  const results = [];
  
  function traverse(node) {
    if (predicate(node)) {
      results.push(node);
    }
    if (node instanceof DOMElementNode) {
      node.children.forEach(traverse);
    }
  }
  
  traverse(root);
  return results;
}

module.exports = {
  DOMElementNode,
  DOMTextNode,
  filterElements
};