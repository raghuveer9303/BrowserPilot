// Message management for LLM communication
// - MessageManager class
// - add_state_message() to update context
// - add_model_output() to store responses
// - get_messages() for LLM prompting
// - Token counting and context window management

class MessageManager {
  constructor() {
    this.messages = [];
    this.maxTokens = 4096; // Default token limit
  }

  add_state_message(state) {
    const stateMessage = {
      role: 'system',
      content: JSON.stringify(state),
      timestamp: Date.now()
    };
    this.messages.push(stateMessage);
    this._trim_context();
  }

  add_model_output(output) {
    const outputMessage = {
      role: 'assistant',
      content: output,
      timestamp: Date.now()
    };
    this.messages.push(outputMessage);
    this._trim_context();
  }

  get_messages() {
    return this.messages;
  }

  _trim_context() {
    // Simple token counting (can be replaced with more accurate tokenizer)
    let totalTokens = this.messages.reduce((sum, msg) => 
      sum + msg.content.length / 4, 0);
    
    while (totalTokens > this.maxTokens && this.messages.length > 2) {
      // Remove oldest message but keep latest system message
      const systemMsgIndex = this.messages.findIndex(m => m.role === 'system');
      if (systemMsgIndex > 0) {
        this.messages.splice(systemMsgIndex, 1);
      } else {
        this.messages.shift();
      }
      
      totalTokens = this.messages.reduce((sum, msg) => 
        sum + msg.content.length / 4, 0);
    }
  }
}

module.exports = { MessageManager };