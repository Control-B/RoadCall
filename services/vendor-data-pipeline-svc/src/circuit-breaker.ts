/**
 * Circuit Breaker for Data Collection
 * 
 * Implements circuit breaker pattern to halt data collection
 * when error rates exceed threshold (10%)
 */

import { CircuitBreakerState } from './types';

export class DataCollectionCircuitBreaker {
  private state: CircuitBreakerState;
  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly timeout: number;
  private readonly windowSize: number;

  constructor(
    failureThreshold: number = 0.1, // 10% error rate
    successThreshold: number = 5, // 5 successful requests to close
    timeout: number = 60000, // 60 seconds before trying half-open
    windowSize: number = 100 // Track last 100 requests
  ) {
    this.failureThreshold = failureThreshold;
    this.successThreshold = successThreshold;
    this.timeout = timeout;
    this.windowSize = windowSize;

    this.state = {
      state: 'CLOSED',
      failureCount: 0,
      successCount: 0,
      lastStateChange: Date.now()
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state.state === 'OPEN') {
      // Check if timeout has elapsed
      if (Date.now() - this.state.lastStateChange >= this.timeout) {
        this.transitionTo('HALF_OPEN');
      } else {
        throw new Error('Circuit breaker is OPEN - data collection halted due to high error rate');
      }
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Record a successful operation
   */
  private recordSuccess(): void {
    this.state.successCount++;

    if (this.state.state === 'HALF_OPEN') {
      // If we've had enough successes, close the circuit
      if (this.state.successCount >= this.successThreshold) {
        this.transitionTo('CLOSED');
      }
    }
  }

  /**
   * Record a failed operation
   */
  private recordFailure(): void {
    this.state.failureCount++;
    this.state.lastFailureTime = Date.now();

    const totalRequests = this.state.failureCount + this.state.successCount;
    const errorRate = this.state.failureCount / totalRequests;

    // Check if we should open the circuit
    if (this.state.state === 'CLOSED' || this.state.state === 'HALF_OPEN') {
      if (totalRequests >= 10 && errorRate >= this.failureThreshold) {
        this.transitionTo('OPEN');
      }
    }

    // Reset counters if we've exceeded window size
    if (totalRequests >= this.windowSize) {
      this.resetCounters();
    }
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: 'CLOSED' | 'OPEN' | 'HALF_OPEN'): void {
    const oldState = this.state.state;
    this.state.state = newState;
    this.state.lastStateChange = Date.now();

    if (newState === 'CLOSED') {
      this.resetCounters();
    } else if (newState === 'HALF_OPEN') {
      this.state.successCount = 0;
      this.state.failureCount = 0;
    }

    console.log(`Circuit breaker transitioned from ${oldState} to ${newState}`);
  }

  /**
   * Reset success and failure counters
   */
  private resetCounters(): void {
    this.state.successCount = 0;
    this.state.failureCount = 0;
  }

  /**
   * Get current circuit breaker state
   */
  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  /**
   * Get current error rate
   */
  getErrorRate(): number {
    const total = this.state.failureCount + this.state.successCount;
    if (total === 0) return 0;
    return this.state.failureCount / total;
  }

  /**
   * Check if circuit is open
   */
  isOpen(): boolean {
    return this.state.state === 'OPEN';
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.transitionTo('CLOSED');
  }

  /**
   * Check for legal compliance flags and open circuit if needed
   */
  checkComplianceFlags(flags: string[]): void {
    if (flags.length > 0) {
      console.warn('Legal compliance flags detected:', flags);
      this.transitionTo('OPEN');
    }
  }
}
