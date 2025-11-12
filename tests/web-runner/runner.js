// Test Runner JavaScript

const testSuites = {
    'basic-setup': {
        name: 'Basic Setup Test',
        file: 'tests/integration/basic-setup.test.ts',
        description: 'Verifies test environment configuration'
    },
    'complete-incident-flow': {
        name: 'Complete Incident Flow',
        file: 'tests/integration/complete-incident-flow.test.ts',
        description: 'End-to-end incident lifecycle testing'
    },
    'eventbridge-flows': {
        name: 'EventBridge Event Flows',
        file: 'tests/integration/eventbridge-flows.test.ts',
        description: 'Event publishing and routing validation'
    },
    'disaster-recovery': {
        name: 'Disaster Recovery',
        file: 'tests/integration/disaster-recovery.test.ts',
        description: 'Failover and DR procedures'
    },
    'security-validation': {
        name: 'Security Validation',
        file: 'tests/integration/security-validation.test.ts',
        description: 'Authentication, authorization, encryption'
    },
    'performance-sla': {
        name: 'Performance & SLA',
        file: 'tests/load/performance-sla.test.ts',
        description: 'Performance and SLA validation'
    },
    'audit-compliance': {
        name: 'Audit & Compliance',
        file: 'tests/integration/audit-compliance.test.ts',
        description: 'Audit logging and compliance'
    }
};

let testResults = {};
let consoleOutput = [];

function log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    consoleOutput.push({ timestamp, message, type });
    updateConsole();
}

function updateConsole() {
    const consoleEl = document.getElementById('console-output');
    consoleEl.style.display = 'block';
    consoleEl.innerHTML = consoleOutput.map(line => 
        `<div class="console-line ${line.type}">[${line.timestamp}] ${line.message}</div>`
    ).join('');
    consoleEl.scrollTop = consoleEl.scrollHeight;
}

function updateStats() {
    let total = 0, passed = 0, failed = 0, skipped = 0;
    
    Object.values(testResults).forEach(suite => {
        if (suite.tests) {
            suite.tests.forEach(test => {
                total++;
                if (test.status === 'pass') passed++;
                else if (test.status === 'fail') failed++;
                else if (test.status === 'skip') skipped++;
            });
        }
    });
    
    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-passed').textContent = passed;
    document.getElementById('stat-failed').textContent = failed;
    document.getElementById('stat-skipped').textContent = skipped;
}

function renderResults() {
    const resultsEl = document.getElementById('test-results');
    
    if (Object.keys(testResults).length === 0) {
        resultsEl.innerHTML = '<p style="color: #666; text-align: center; padding: 40px;">No tests run yet. Click a button above to start testing.</p>';
        return;
    }
    
    resultsEl.innerHTML = Object.entries(testResults).map(([key, suite]) => {
        const passCount = suite.tests?.filter(t => t.status === 'pass').length || 0;
        const failCount = suite.tests?.filter(t => t.status === 'fail').length || 0;
        const totalCount = suite.tests?.length || 0;
        
        const statusBadge = suite.status === 'running' 
            ? '<span class="status-badge running">Running...</span>'
            : failCount > 0
            ? `<span class="status-badge fail">${failCount} Failed</span>`
            : `<span class="status-badge pass">All Passed</span>`;
        
        const testsHtml = suite.tests?.map(test => `
            <div class="test-item ${test.status}">
                <span class="test-icon">${test.status === 'pass' ? '✓' : test.status === 'fail' ? '✗' : '○'}</span>
                <span class="test-name">${test.name}</span>
                <span class="test-duration">${test.duration || '0'}ms</span>
            </div>
        `).join('') || '';
        
        return `
            <div class="test-suite">
                <div class="suite-header" onclick="toggleSuite('${key}')">
                    <div>
                        <div class="suite-title">${suite.name}</div>
                        <div style="font-size: 12px; color: #666; margin-top: 4px;">${suite.description}</div>
                    </div>
                    <div class="suite-status">
                        ${suite.status === 'running' ? '<div class="loading"></div>' : ''}
                        ${statusBadge}
                        <span style="color: #666; font-size: 14px;">${passCount}/${totalCount}</span>
                    </div>
                </div>
                <div class="suite-tests" id="suite-${key}">
                    ${testsHtml}
                </div>
            </div>
        `;
    }).join('');
    
    updateStats();
}

function toggleSuite(key) {
    const suiteEl = document.getElementById(`suite-${key}`);
    suiteEl.classList.toggle('expanded');
}

async function runTest(testKey) {
    const suite = testSuites[testKey];
    if (!suite) {
        log(`Test suite '${testKey}' not found`, 'error');
        return;
    }
    
    log(`Starting test suite: ${suite.name}`, 'info');
    
    testResults[testKey] = {
        name: suite.name,
        description: suite.description,
        status: 'running',
        tests: []
    };
    
    renderResults();
    
    // Simulate test execution (in real implementation, this would call the actual test runner)
    await simulateTestExecution(testKey, suite);
    
    renderResults();
}

async function simulateTestExecution(testKey, suite) {
    // This is a simulation. In a real implementation, you would:
    // 1. Call a backend API that runs the Jest tests
    // 2. Stream the results back
    // 3. Update the UI in real-time
    
    const testCases = getTestCasesForSuite(testKey);
    
    for (const testCase of testCases) {
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate test execution time
        
        const passed = Math.random() > 0.1; // 90% pass rate for demo
        const duration = Math.floor(Math.random() * 200) + 50;
        
        testResults[testKey].tests.push({
            name: testCase,
            status: passed ? 'pass' : 'fail',
            duration
        });
        
        log(`${passed ? '✓' : '✗'} ${testCase} (${duration}ms)`, passed ? 'success' : 'error');
        renderResults();
    }
    
    testResults[testKey].status = 'complete';
    const failCount = testResults[testKey].tests.filter(t => t.status === 'fail').length;
    
    if (failCount === 0) {
        log(`✓ Test suite '${suite.name}' completed successfully`, 'success');
    } else {
        log(`✗ Test suite '${suite.name}' completed with ${failCount} failures`, 'error');
    }
}

function getTestCasesForSuite(testKey) {
    const testCases = {
        'basic-setup': [
            'should have test environment configured',
            'should have AWS region configured',
            'should be able to perform basic assertions',
            'should be able to use async/await',
            'should have test utilities available',
            'should be able to generate test IDs',
            'should be able to sleep'
        ],
        'complete-incident-flow': [
            'should create incident via API',
            'should publish IncidentCreated event',
            'should match vendors and create offers',
            'should accept offer and assign vendor',
            'should start tracking session',
            'should update vendor location',
            'should detect vendor arrival',
            'should complete work',
            'should create payment record',
            'should approve payment',
            'should close incident'
        ],
        'eventbridge-flows': [
            'should publish IncidentCreated event',
            'should publish OfferCreated event',
            'should publish VendorAssigned event',
            'should publish WorkCompleted event',
            'should have routing rules configured',
            'should deliver events to SQS',
            'should have DLQ configured',
            'should validate event schemas'
        ],
        'disaster-recovery': [
            'should have multi-AZ deployment',
            'should have DynamoDB Global Tables',
            'should have Aurora read replicas',
            'should have S3 replication',
            'should have Route 53 health checks',
            'should failover within RTO',
            'should maintain data consistency'
        ],
        'security-validation': [
            'should enforce OTP validation',
            'should validate JWT tokens',
            'should enforce RBAC',
            'should use KMS encryption',
            'should validate input',
            'should enforce rate limiting',
            'should follow least-privilege'
        ],
        'performance-sla': [
            'should meet P95 latency < 300ms',
            'should meet P99 latency < 500ms',
            'should handle 100 concurrent requests',
            'should handle 1000 concurrent incidents',
            'should process 10k location updates/min',
            'should propagate updates < 2s'
        ],
        'audit-compliance': [
            'should log all API requests',
            'should enable CloudTrail',
            'should log PII access',
            'should retain logs for 7 years',
            'should support data export',
            'should support data deletion',
            'should log payment events'
        ]
    };
    
    return testCases[testKey] || ['Test case 1', 'Test case 2', 'Test case 3'];
}

async function runAllTests() {
    log('Starting full test suite execution...', 'info');
    
    for (const testKey of Object.keys(testSuites)) {
        await runTest(testKey);
    }
    
    log('All test suites completed!', 'success');
}

function clearResults() {
    testResults = {};
    consoleOutput = [];
    renderResults();
    document.getElementById('console-output').style.display = 'none';
    log('Results cleared', 'info');
}

// Initialize
renderResults();
log('Test runner initialized. Ready to run tests.', 'info');
