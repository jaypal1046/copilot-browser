/**
 * Unit tests for message validation
 * Run with: node tests/unit/message-validator.test.js
 */

const assert = require('assert');

// Message validator (this would be extracted from relay server)
function validateMessage(message) {
  if (!message || typeof message !== 'object') {
    return { valid: false, error: 'Message must be an object' };
  }
  
  if (!message.type || typeof message.type !== 'string') {
    return { valid: false, error: 'Message must have a type' };
  }
  
  const validTypes = ['execute', 'result', 'error', 'ping', 'pong', 'register'];
  if (!validTypes.includes(message.type)) {
    return { valid: false, error: `Invalid message type: ${message.type}` };
  }
  
  const messageSize = JSON.stringify(message).length;
  if (messageSize > 1048576) { // 1MB
    return { valid: false, error: 'Message too large' };
  }
  
  return { valid: true };
}

// Test suite
function runTests() {
  let passed = 0;
  let failed = 0;
  
  console.log('🧪 Running Message Validator Tests...\n');
  
  // Test 1: Valid message
  try {
    const result = validateMessage({ type: 'execute', code: 'console.log("test")' });
    assert.strictEqual(result.valid, true);
    console.log('✅ Test 1: Valid message');
    passed++;
  } catch (e) {
    console.log('❌ Test 1: Valid message -', e.message);
    failed++;
  }
  
  // Test 2: Null message
  try {
    const result = validateMessage(null);
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('must be an object'));
    console.log('✅ Test 2: Null message rejected');
    passed++;
  } catch (e) {
    console.log('❌ Test 2: Null message rejected -', e.message);
    failed++;
  }
  
  // Test 3: Missing type
  try {
    const result = validateMessage({ code: 'test' });
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('type'));
    console.log('✅ Test 3: Missing type rejected');
    passed++;
  } catch (e) {
    console.log('❌ Test 3: Missing type rejected -', e.message);
    failed++;
  }
  
  // Test 4: Invalid type
  try {
    const result = validateMessage({ type: 'invalid' });
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('Invalid message type'));
    console.log('✅ Test 4: Invalid type rejected');
    passed++;
  } catch (e) {
    console.log('❌ Test 4: Invalid type rejected -', e.message);
    failed++;
  }
  
  // Test 5: Message too large
  try {
    const largeMessage = { type: 'execute', data: 'x'.repeat(2000000) };
    const result = validateMessage(largeMessage);
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('too large'));
    console.log('✅ Test 5: Large message rejected');
    passed++;
  } catch (e) {
    console.log('❌ Test 5: Large message rejected -', e.message);
    failed++;
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`Tests passed: ${passed}`);
  console.log(`Tests failed: ${failed}`);
  console.log('='.repeat(50));
  
  process.exit(failed > 0 ? 1 : 0);
}

if (require.main === module) {
  runTests();
}

module.exports = { validateMessage, runTests };
