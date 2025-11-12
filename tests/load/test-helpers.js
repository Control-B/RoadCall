/**
 * Artillery test helper functions
 */

const crypto = require('crypto');

/**
 * Generate random string
 */
function randomString(length = 8) {
  return crypto.randomBytes(length).toString('hex').substring(0, length);
}

/**
 * Generate random number between min and max
 */
function randomNumber(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * Random choice from array
 */
function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generate timestamp
 */
function timestamp() {
  return new Date().toISOString();
}

/**
 * Generate random latitude
 */
function randomLat() {
  return randomNumber(30, 45).toFixed(6);
}

/**
 * Generate random longitude
 */
function randomLon() {
  return randomNumber(-120, -70).toFixed(6);
}

/**
 * Before scenario hook
 */
function beforeScenario(context, events, done) {
  // Generate auth token (mock for testing)
  context.vars.authToken = `test-token-${randomString(16)}`;
  
  // Generate session ID for tracking
  context.vars.sessionId = `session-${randomString(12)}`;
  
  return done();
}

/**
 * After response hook
 */
function afterResponse(requestParams, response, context, events, done) {
  // Log slow responses
  if (response.timings && response.timings.phases.total > 1000) {
    console.log(`Slow response detected: ${requestParams.url} took ${response.timings.phases.total}ms`);
  }
  
  return done();
}

/**
 * Custom metrics
 */
function recordCustomMetrics(context, events, done) {
  // Record custom metrics here if needed
  return done();
}

module.exports = {
  randomString,
  randomNumber,
  randomChoice,
  timestamp,
  randomLat,
  randomLon,
  beforeScenario,
  afterResponse,
  recordCustomMetrics,
};
