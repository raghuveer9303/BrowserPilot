// Data models for browser state
// - BrowserState class (URL, title, element tree)
// - TabInfo class (page ID, URL, title)
// - BrowserError class
// - BrowserStateHistory for tracking changes

class BrowserState {
  constructor(url, title, elementTree) {
    this.url = url;
    this.title = title;
    this.elementTree = elementTree;
    this.timestamp = Date.now();
  }
}

class TabInfo {
  constructor(pageId, url, title) {
    this.pageId = pageId;
    this.url = url;
    this.title = title;
    this.active = false;
  }
}

class BrowserError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
    this.name = 'BrowserError';
  }
}

class BrowserStateHistory {
  constructor(maxSize = 50) {
    this.states = [];
    this.maxSize = maxSize;
  }

  addState(state) {
    this.states.push(state);
    if (this.states.length > this.maxSize) {
      this.states.shift();
    }
  }

  getLatestState() {
    return this.states[this.states.length - 1];
  }

  getStateHistory() {
    return this.states;
  }
}

module.exports = {
  BrowserState,
  TabInfo,
  BrowserError,
  BrowserStateHistory
};