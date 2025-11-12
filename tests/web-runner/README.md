# 🚗 AI Roadcall Assistant - Web Test Runner

## 🌐 Access the Dashboard

**Open your browser and navigate to:**

```
http://localhost:8080
```

## 🎯 What You'll See

### Dashboard Features

1. **Header Section**
   - Project title and description
   - Clean, modern design with gradient background

2. **Control Panel**
   - **Run All Tests** - Execute all test suites sequentially
   - **Individual Test Buttons**:
     - ✓ Basic Setup - Environment configuration tests
     - 🔄 Incident Flow - End-to-end incident lifecycle
     - 📡 EventBridge - Event publishing and routing
     - 🔥 Disaster Recovery - Failover scenarios
     - 🔒 Security - Authentication & authorization
     - ⚡ Performance - Load and SLA validation
     - 📋 Compliance - Audit logging
   - **Clear** - Reset all results

3. **Statistics Dashboard**
   - Total Tests count
   - Passed tests (green)
   - Failed tests (red)
   - Skipped tests (yellow)

4. **Test Results Section**
   - Expandable test suites
   - Individual test case results
   - Pass/fail indicators
   - Execution duration for each test
   - Real-time status updates

5. **Console Output**
   - Color-coded log messages
   - Timestamps for each event
   - Scrollable output window

## 🎮 How to Use

### Run a Single Test Suite

1. Click any of the colored test buttons
2. Watch the test suite expand in the results section
3. See individual test cases execute in real-time
4. Check the console for detailed logs

### Run All Tests

1. Click the "▶️ Run All Tests" button
2. All test suites will execute sequentially
3. Watch the statistics update in real-time
4. Review results for each suite

### View Test Details

1. Click on any test suite header to expand/collapse
2. See individual test cases with pass/fail status
3. View execution duration for each test

### Clear Results

1. Click the "🗑️ Clear" button
2. All results and console output will be reset

## 🎨 Visual Guide

### Color Coding

- **Blue** - Primary actions and info messages
- **Green** - Passed tests and success messages
- **Red** - Failed tests and error messages
- **Yellow** - Warnings and skipped tests
- **Gray** - Secondary actions

### Status Badges

- **All Passed** - Green badge, all tests successful
- **X Failed** - Red badge, shows number of failures
- **Running...** - Blue badge with loading spinner

## 📊 Test Suites Overview

### 1. Basic Setup (7 tests)
- Environment configuration
- AWS region setup
- Test utilities validation
- Async/await functionality

### 2. Complete Incident Flow (11 tests)
- Incident creation
- Vendor matching
- Offer acceptance
- Location tracking
- Payment processing
- Incident closure

### 3. EventBridge Flows (8 tests)
- Event publishing
- Event routing
- SQS delivery
- DLQ configuration
- Schema validation

### 4. Disaster Recovery (7 tests)
- Multi-AZ deployment
- Global Tables replication
- Cross-region failover
- Data consistency

### 5. Security Validation (7 tests)
- OTP authentication
- JWT validation
- RBAC enforcement
- KMS encryption
- Input validation
- Rate limiting

### 6. Performance & SLA (6 tests)
- API latency (P95, P99)
- Concurrent load handling
- Location update throughput
- Database performance

### 7. Audit & Compliance (7 tests)
- CloudWatch logging
- CloudTrail audit
- PII access logging
- GDPR compliance
- Payment audit trail

## 🔧 Technical Details

### Server
- **Port**: 8080
- **Technology**: Node.js HTTP server
- **Files Served**: HTML, JavaScript, CSS

### Frontend
- **Pure HTML/CSS/JavaScript** - No frameworks required
- **Responsive Design** - Works on desktop and mobile
- **Real-time Updates** - Live test execution feedback

## 🚀 Quick Start

1. **Server is already running!** Just open your browser
2. Navigate to: `http://localhost:8080`
3. Click "Run All Tests" or any individual test button
4. Watch the magic happen! ✨

## 📝 Notes

- The current implementation shows **simulated test execution**
- Tests have a 90% pass rate for demonstration
- Each test takes 500ms to execute (simulated)
- Real test integration would require backend API

## 🛑 Stop the Server

To stop the test runner server:

```bash
# Press Ctrl+C in the terminal where the server is running
```

Or use the Kiro process manager to stop process ID 2.

## 🎉 Enjoy Testing!

Your comprehensive test dashboard is ready to use. Open your browser and start exploring!
