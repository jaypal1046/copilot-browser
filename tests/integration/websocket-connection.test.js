/**
 * Integration test for WebSocket connections
 * Run with: node tests/integration/websocket-connection.test.js
 * Requires: relay-server running on localhost:8080
 */

const WebSocket = require('ws');

async function testWebSocketConnection() {
  console.log('🧪 Testing WebSocket Connection...\n');
  
  let testsPass = 0;
  let testsFail = 0;
  
  try {
    // Test 1: Connection establishment
    console.log('📡 Test 1: Establishing connection...');
    const ws = new WebSocket('ws://localhost:8080');
    
    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        console.log('✅ Connection established');
        testsPass++;
        resolve();
      });
      
      ws.on('error', (error) => {
        console.log('❌ Connection failed:', error.message);
        testsFail++;
        reject(error);
      });
      
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
    
    // Test 2: Register client
    console.log('\n📝 Test 2: Registering client...');
    ws.send(JSON.stringify({
      type: 'register',
      clientType: 'test-client',
      timestamp: Date.now()
    }));
    
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log('❌ Registration timeout');
        testsFail++;
        reject(new Error('Registration timeout'));
      }, 3000);
      
      ws.on('message', (data) => {
        const message = JSON.parse(data);
        if (message.type === 'registered') {
          clearTimeout(timeout);
          console.log('✅ Client registered successfully');
          testsPass++;
          resolve();
        }
      });
    });
    
    // Test 3: Ping/Pong
    console.log('\n🏓 Test 3: Testing ping/pong...');
    ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
    
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log('❌ Ping timeout');
        testsFail++;
        reject(new Error('Ping timeout'));
      }, 3000);
      
      ws.on('message', (data) => {
        const message = JSON.parse(data);
        if (message.type === 'pong') {
          clearTimeout(timeout);
          console.log('✅ Pong received');
          testsPass++;
          resolve();
        }
      });
    });
    
    // Test 4: Send invalid message
    console.log('\n🚫 Test 4: Testing error handling...');
    ws.send(JSON.stringify({ type: 'invalid_type' }));
    
    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log('⚠️  No error response (acceptable)');
        resolve();
      }, 1000);
      
      ws.on('message', (data) => {
        const message = JSON.parse(data);
        if (message.type === 'error') {
          clearTimeout(timeout);
          console.log('✅ Error handling works');
          testsPass++;
          resolve();
        }
      });
    });
    
    // Cleanup
    ws.close();
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log(`✅ Tests passed: ${testsPass}`);
    console.log(`❌ Tests failed: ${testsFail}`);
    console.log('='.repeat(50));
    
    process.exit(testsFail > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    console.log('\n💡 Make sure relay-server is running: npm start');
    process.exit(1);
  }
}

if (require.main === module) {
  testWebSocketConnection();
}

module.exports = { testWebSocketConnection };
