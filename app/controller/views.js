// Action models
// - BaseAction class with validation
// - Specific action classes:
//   * ClickElementAction (index)
//   * InputTextAction (index, text)
//   * GoToUrlAction (url)
//   * ScrollAction (amount)
//   * ExtractAction (selector/goal)
//   * DoneAction (text, success)

class BaseAction {
  constructor(type) {
    this.type = type;
    this.timestamp = Date.now();
  }

  validate() {
    if (!this.type) {
      throw new Error('Action must have a type');
    }
  }
}

class ClickElementAction extends BaseAction {
  constructor(index) {
    super('click');
    this.index = index;
  }

  validate() {
    super.validate();
    if (typeof this.index !== 'number') {
      throw new Error('Click action requires valid element index');
    }
  }
}

class InputTextAction extends BaseAction {
  constructor(index, text) {
    super('input');
    this.index = index;
    this.text = text;
  }

  validate() {
    super.validate();
    if (typeof this.index !== 'number') {
      throw new Error('Input action requires valid element index');
    }
    if (typeof this.text !== 'string') {
      throw new Error('Input action requires text string');
    }
  }
}

class GoToUrlAction extends BaseAction {
  constructor(url) {
    super('navigate');
    this.url = url;
  }

  validate() {
    super.validate();
    if (!this.url || typeof this.url !== 'string') {
      throw new Error('Navigation action requires valid URL');
    }
  }
}

class ScrollAction extends BaseAction {
  constructor(amount) {
    super('scroll');
    this.amount = amount;
  }

  validate() {
    super.validate();
    if (typeof this.amount !== 'number') {
      throw new Error('Scroll action requires valid amount');
    }
  }
}

class ExtractAction extends BaseAction {
  constructor(selector) {
    super('extract');
    this.selector = selector;
  }

  validate() {
    super.validate();
    if (!this.selector || typeof this.selector !== 'string') {
      throw new Error('Extract action requires valid selector');
    }
  }
}

class DoneAction extends BaseAction {
  constructor(text, success = true) {
    super('done');
    this.text = text;
    this.success = success;
  }
}

module.exports = {
  BaseAction,
  ClickElementAction,
  InputTextAction,
  GoToUrlAction,
  ScrollAction,
  ExtractAction,
  DoneAction
};