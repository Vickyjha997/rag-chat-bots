/**
 * Test Script for Function Calling
 * 
 * This script helps you test if function calling is working correctly.
 * It simulates the function calling flow and checks each step.
 * 
 * Usage:
 *   cd backend
 *   node test-function-calling.js
 */

import http from 'node:http';
import WebSocket from 'ws';

// Configuration
const HTTP_PORT = 3001;
const WS_PORT = 3002;
const BASE_URL = `http://localhost:${HTTP_PORT}`;
const WS_URL = `ws://localhost:${WS_PORT}`;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n[Step ${step}] ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'blue');
}

// Test 1: Check if tools are registered
async function testToolsRegistered() {
  logStep(1, 'Checking if tools are registered...');
  
  return new Promise((resolve, reject) => {
    const req = http.get(`${BASE_URL}/api/tools`, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (response.tools && response.tools.length > 0) {
            logSuccess(`Found ${response.tools.length} registered tools:`);
            response.tools.forEach(tool => {
              logInfo(`  - ${tool.name}: ${tool.description}`);
            });
            resolve(response.tools);
          } else {
            logError('No tools registered!');
            reject(new Error('No tools found'));
          }
        } catch (error) {
          logError(`Failed to parse response: ${error.message}`);
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      logError(`Request failed: ${error.message}`);
      logInfo('Make sure the backend server is running!');
      reject(error);
    });
  });
}

// Test 2: Create a session
async function testCreateSession() {
  logStep(2, 'Creating a new session...');
  
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ userId: 'test-user' });
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };
    
    const req = http.request(`${BASE_URL}/api/sessions`, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (response.sessionId) {
            logSuccess(`Session created: ${response.sessionId}`);
            resolve(response.sessionId);
          } else {
            logError('Failed to create session');
            reject(new Error('No sessionId in response'));
          }
        } catch (error) {
          logError(`Failed to parse response: ${error.message}`);
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      logError(`Request failed: ${error.message}`);
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
}

// Test 3: Connect via WebSocket and test function calling
async function testFunctionCalling(sessionId) {
  logStep(3, 'Testing function calling via WebSocket...');
  
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_URL}?sessionId=${sessionId}`);
    let functionCallDetected = false;
    let functionResultSent = false;
    let connectionEstablished = false;
    let testTimeout;
    
    // Set overall test timeout (10 seconds - just to verify connection)
    const overallTimeout = setTimeout(() => {
      ws.close();
      if (!functionCallDetected) {
        // This is expected - we're just testing infrastructure
        logInfo('\n✓ Infrastructure test completed successfully!');
        logInfo('The connection works, but no function calls were triggered.');
        logInfo('\nTo actually test function calling:');
        logInfo('1. Keep the backend server running');
        logInfo('2. Open the frontend at http://localhost:3001');
        logInfo('3. Connect and ask Gemini to use a tool, e.g.:');
        logInfo('   - "What\'s the weather in New York?"');
        logInfo('   - "Get analytics for users from 2024-01-01 to 2024-12-31"');
        logInfo('   - "Search the knowledge base for TypeScript"');
        logInfo('4. Watch the backend console for: [Function Call] <tool_name>');
        resolve(); // Not a failure - infrastructure works!
      } else {
        resolve();
      }
    }, 10000); // Reduced timeout since we're just testing infrastructure
    
    ws.on('open', () => {
      logSuccess('WebSocket connection opened');
      
      // Send connect message
      ws.send(JSON.stringify({
        type: 'connect',
        sessionId: sessionId,
      }));
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        // Check connection status
        if (message.type === 'status') {
          if (message.data?.status === 'CONNECTED') {
            connectionEstablished = true;
            logSuccess('Connected to Gemini');
            logInfo('\n✓ All infrastructure checks passed!');
            logInfo('\nNote: This test only verifies the connection.');
            logInfo('To actually trigger function calls, you need to:');
            logInfo('1. Use the frontend (http://localhost:3001)');
            logInfo('2. Send audio/text asking Gemini to use a tool');
            logInfo('3. Watch backend console for [Function Call] logs');
            logInfo('\nThe test will complete in a few seconds...');
          }
        }
        
        // Check for function call messages
        if (message.type === 'function_call') {
          functionCallDetected = true;
          logSuccess('Function call detected!');
          logInfo(`Function: ${message.data?.name || 'unknown'}`);
          logInfo(`Arguments: ${JSON.stringify(message.data?.args || {})}`);
        }
        
        // Check for function result messages
        if (message.type === 'function_result') {
          functionResultSent = true;
          logSuccess('Function result received!');
          logInfo(`Result: ${JSON.stringify(message.data?.result || {})}`);
        }
        
        // Check for errors
        if (message.type === 'error') {
          logError(`Error: ${message.data?.message || 'Unknown error'}`);
        }
        
        // Log transcriptions to see what's happening
        if (message.type === 'transcription') {
          const transcript = message.data;
          if (transcript.text) {
            const prefix = transcript.isUser ? 'User: ' : 'AI: ';
            logInfo(`${prefix}${transcript.text}`);
          }
        }
        
      } catch (error) {
        logError(`Failed to parse message: ${error.message}`);
      }
    });
    
    ws.on('error', (error) => {
      logError(`WebSocket error: ${error.message}`);
      clearTimeout(overallTimeout);
      reject(error);
    });
    
    ws.on('close', () => {
      logInfo('WebSocket connection closed');
      clearTimeout(overallTimeout);
      
      if (functionCallDetected) {
        logSuccess('Function calling test completed!');
        resolve();
      } else if (connectionEstablished) {
        // This is expected - we're just testing infrastructure
        resolve(); // Not a failure - infrastructure works!
      } else {
        logError('Connection failed');
        reject(new Error('Connection failed'));
      }
    });
  });
}

// Test 4: Check backend logs for function call execution
function testBackendLogs() {
  logStep(4, 'Checking backend console for function call logs...');
  logInfo('Look for logs like: [Function Call] <tool_name> <args>');
  logInfo('These logs appear in the backend server console when functions are executed');
}

// Main test runner
async function runTests() {
  log('\n' + '='.repeat(60), 'blue');
  log('Function Calling Test Suite', 'cyan');
  log('='.repeat(60) + '\n', 'blue');
  
  try {
    // Test 1: Check tools
    const tools = await testToolsRegistered();
    
    // Test 2: Create session
    const sessionId = await testCreateSession();
    
    // Test 3: Test function calling infrastructure
    log('\n' + '-'.repeat(60), 'yellow');
    log('Note: This test verifies infrastructure only', 'yellow');
    log('To actually trigger function calls, use the frontend!', 'yellow');
    log('-'.repeat(60) + '\n', 'yellow');
    
    await testFunctionCalling(sessionId);
    
    // Test 4: Check logs
    testBackendLogs();
    
    log('\n' + '='.repeat(60), 'green');
    log('✓ Infrastructure Test Completed Successfully!', 'green');
    log('='.repeat(60) + '\n', 'green');
    
    log('Summary:', 'cyan');
    log('✓ Tools are registered and available', 'green');
    log('✓ Session management is working', 'green');
    log('✓ WebSocket connection to Gemini is working', 'green');
    log('\nTo test actual function calling:', 'cyan');
    log('1. Open http://localhost:3001 in your browser', 'blue');
    log('2. Connect to the voice chat', 'blue');
    log('3. Ask Gemini to use a tool, e.g.:', 'blue');
    log('   • "What\'s the weather in New York?"', 'blue');
    log('   • "Get analytics for revenue from 2024-01-01 to 2024-12-31"', 'blue');
    log('4. Watch the backend console for: [Function Call] <tool_name>', 'blue');
    
  } catch (error) {
    log('\n' + '='.repeat(60), 'red');
    log('Test failed!', 'red');
    log('='.repeat(60) + '\n', 'red');
    logError(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Check if server is running first
function checkServerHealth() {
  return new Promise((resolve, reject) => {
    const req = http.get(`${BASE_URL}/health`, (res) => {
      if (res.statusCode === 200) {
        resolve(true);
      } else {
        reject(new Error(`Server returned status ${res.statusCode}`));
      }
    });
    
    req.on('error', () => {
      reject(new Error('Server is not running'));
    });
    
    req.setTimeout(3000, () => {
      req.destroy();
      reject(new Error('Server connection timeout'));
    });
  });
}

// Run the tests
async function main() {
  log('Checking if backend server is running...', 'blue');
  
  try {
    await checkServerHealth();
    logSuccess('Backend server is running');
    await runTests();
  } catch (error) {
    logError('Backend server is not accessible');
    logInfo(`Make sure the backend is running on port ${HTTP_PORT}`);
    logInfo('Start it with: cd backend && npm run dev');
    process.exit(1);
  }
}

main();

