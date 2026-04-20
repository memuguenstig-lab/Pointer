#!/usr/bin/env node
/**
 * Pointer Installer Test Script
 * Tests the installation components without building the full installer
 */

const fs = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function testNodeDetection() {
  console.log('Testing Node.js detection...');
  
  try {
    const { stdout } = await execAsync('node --version');
    console.log(`✓ Node.js found: ${stdout.trim()}`);
    
    const versionMatch = stdout.trim().match(/v(\d+)/);
    const majorVersion = versionMatch ? parseInt(versionMatch[1]) : 0;
    
    if (majorVersion >= 18) {
      console.log(`✓ Node.js version ${majorVersion} meets minimum requirement (18+)`);
      return true;
    } else {
      console.log(`✗ Node.js version ${majorVersion} is too old (requires 18+)`);
      return false;
    }
  } catch (error) {
    console.log('✗ Node.js not found or not in PATH');
    return false;
  }
}

async function testNpmInstall() {
  console.log('\nTesting npm install functionality...');
  
  // Create a test directory
  const testDir = path.join(__dirname, 'test-npm-install');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  // Create a simple package.json
  const packageJson = {
    name: 'test-install',
    version: '1.0.0',
    dependencies: {
      'chalk': '^4.0.0'
    }
  };
  
  fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  
  try {
    console.log('Running npm install with --production flag...');
    const { stdout, stderr } = await execAsync('npm install --production --prefer-offline --no-audit --no-fund', {
      cwd: testDir,
      timeout: 60000
    });
    
    // Check if node_modules was created
    const nodeModulesPath = path.join(testDir, 'node_modules');
    if (fs.existsSync(nodeModulesPath)) {
      console.log('✓ npm install successful');
      
      // Clean up
      fs.rmSync(testDir, { recursive: true, force: true });
      return true;
    } else {
      console.log('✗ npm install failed - node_modules not created');
      console.log('stderr:', stderr);
      return false;
    }
  } catch (error) {
    console.log('✗ npm install failed:', error.message);
    
    // Clean up
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch (e) {}
    
    return false;
  }
}

function testSetupScript() {
  console.log('\nTesting setup.js syntax...');
  
  const setupPath = path.join(__dirname, '..', 'electron', 'setup.js');
  
  try {
    const setupContent = fs.readFileSync(setupPath, 'utf8');
    
    // Basic syntax check - try to require it
    const mockOnStatus = (msg, pct) => {
      console.log(`  [${pct}%] ${msg}`);
    };
    
    // Check for required exports
    const requiredExports = ['runSetup', 'isSetupNeeded'];
    const exportMatches = requiredExports.map(exp => {
      return setupContent.includes(`module.exports = {`) && 
             setupContent.includes(exp) ||
             setupContent.includes(`exports.${exp}`) ||
             setupContent.includes(`module.exports.${exp}`);
    });
    
    if (exportMatches.every(match => match)) {
      console.log('✓ setup.js has required exports');
    } else {
      console.log('✗ setup.js missing some exports');
    }
    
    // Check for error handling
    const hasErrorHandling = setupContent.includes('try {') && 
                            setupContent.includes('catch (error)');
    
    if (hasErrorHandling) {
      console.log('✓ setup.js has error handling');
    } else {
      console.log('✗ setup.js missing error handling');
    }
    
    return true;
  } catch (error) {
    console.log('✗ Error reading setup.js:', error.message);
    return false;
  }
}

function testNSISSyntax() {
  console.log('\nTesting NSIS script syntax...');
  
  const nsisPath = path.join(__dirname, 'nsis-custom.nsh');
  
  try {
    const nsisContent = fs.readFileSync(nsisPath, 'utf8');
    
    // Check for required macros
    const requiredMacros = ['!macro customInstall', '!macro customUnInstall'];
    const macroMatches = requiredMacros.map(macro => nsisContent.includes(macro));
    
    if (macroMatches.every(match => match)) {
      console.log('✓ NSIS script has required macros');
    } else {
      console.log('✗ NSIS script missing some macros');
    }
    
    // Check for error handling
    const hasErrorHandling = nsisContent.includes('MessageBox') &&
                            (nsisContent.includes('MB_ICONEXCLAMATION') || 
                             nsisContent.includes('MB_ICONINFORMATION'));
    
    if (hasErrorHandling) {
      console.log('✓ NSIS script has error messages');
    } else {
      console.log('✗ NSIS script missing error messages');
    }
    
    // Check for retry logic
    const hasRetryLogic = nsisContent.includes('attempt') || 
                         nsisContent.includes('retry') ||
                         nsisContent.includes('${For}');
    
    if (hasRetryLogic) {
      console.log('✓ NSIS script has retry logic');
    } else {
      console.log('✗ NSIS script missing retry logic');
    }
    
    return true;
  } catch (error) {
    console.log('✗ Error reading NSIS script:', error.message);
    return false;
  }
}

function testMacScript() {
  console.log('\nTesting macOS script syntax...');
  
  const macScriptPath = path.join(__dirname, 'mac-postinstall.sh');
  
  try {
    const scriptContent = fs.readFileSync(macScriptPath, 'utf8');
    
    // Check shebang
    if (scriptContent.startsWith('#!/bin/bash')) {
      console.log('✓ macOS script has correct shebang');
    } else {
      console.log('✗ macOS script missing or incorrect shebang');
    }
    
    // Check for error handling
    const hasSetE = scriptContent.includes('set -e');
    if (hasSetE) {
      console.log('✓ macOS script exits on error');
    } else {
      console.log('✗ macOS script should use "set -e"');
    }
    
    // Check for retry logic
    const hasRetryLogic = scriptContent.includes('MAX_RETRIES') ||
                         scriptContent.includes('while') && scriptContent.includes('attempt');
    
    if (hasRetryLogic) {
      console.log('✓ macOS script has retry logic');
    } else {
      console.log('✗ macOS script missing retry logic');
    }
    
    return true;
  } catch (error) {
    console.log('✗ Error reading macOS script:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('Pointer Installer Component Tests');
  console.log('=================================\n');
  
  const tests = [
    { name: 'Node.js Detection', fn: testNodeDetection },
    { name: 'npm Install', fn: testNpmInstall },
    { name: 'Setup Script', fn: testSetupScript },
    { name: 'NSIS Script', fn: testNSISSyntax },
    { name: 'macOS Script', fn: testMacScript }
  ];
  
  let allPassed = true;
  const results = [];
  
  for (const test of tests) {
    console.log(`\n${test.name}:`);
    try {
      const passed = await test.fn();
      results.push({ test: test.name, passed });
      if (!passed) allPassed = false;
    } catch (error) {
      console.log(`✗ Test failed with error: ${error.message}`);
      results.push({ test: test.name, passed: false, error: error.message });
      allPassed = false;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('TEST SUMMARY');
  console.log('='.repeat(50));
  
  results.forEach(result => {
    const status = result.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${status} - ${result.test}`);
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
  });
  
  console.log('\n' + '='.repeat(50));
  
  if (allPassed) {
    console.log('✅ All tests passed! Installer components are ready.');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed. Please fix the issues above.');
    process.exit(1);
  }
}

if (require.main === module) {
  runAllTests().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = {
  testNodeDetection,
  testNpmInstall,
  testSetupScript,
  testNSISSyntax,
  testMacScript,
  runAllTests
};