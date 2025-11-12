/**
 * Circuit Breaker Pattern Implementation
 * 
 * Prevents cascading failures by monitoring service health and
 * providing fallback mechanisms when services are unavailable.
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is failing, requests fail fast
 * - HALF_OPEN: Testing if service has recovered
 */

import { logger } from './logger';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  /** Name of the circuit breaker for logging */
  name: string;
  /** Failure threshold percentage (0-1) over the window */
  failureThreshold: number;
  /** Minimum number of requests before evaluating threshold */
  minimumRequests: number;
  /** Timeout for individual requests in milliseconds */
  timeout: number;
  /** Time to wait before attempting to close circuit (milliseconds) */
  resetTimeout: number;
  /** Optional fallback function when circuit is open */
  fallback?: <T>() => Promise<T>;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  totalRequests: number;
  failureRate: number;
  lastFailureTime?: number;
  lastStateChange: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private totalRequests = 0;
  private lastFailureTime?: number;
  private lastStateChange: number = Date.now();
  private readonly config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      ...config,
      failureThreshold: config.failureThreshold ?? 0.5,
      minimumRequests: config.minimumRequests ?? 10,
      timeout: config.timeout ?? 30000,
      resetTimeout: config.resetTimeout ?? 60000,
    };

    logger.info('Circuit breaker initialized', {
      name: this.config.name,
      config: this.config,
    });
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit should transition from OPEN to HALF_OPEN
    if (this.state === CircuitState.OPEN) {
      const timeSinceLastFailure = Date.now() - (this.lastFailureTime || 0);
      
      if (timeSinceLastFailure >= this.config.resetTimeout) {
        this.transitionTo(CircuitState.HALF_OPEN);
      } else {
        logger.warn('Circuit breaker is OPEN, failing fast', {
          name: this.config.name,
          timeSinceLastFailure,
          resetTimeout: this.config.resetTimeout,
        });

        // Use fallback if available
        if (this.config.fallback) {
          logger.info('Using fallback mechanism', { name: this.config.name });
          return this.config.fallback<T>();
        }

        throw new CircuitBreakerOpenError(
          `Circuit breaker ${this.config.name} is OPEN`
        );
      }
    }

    this.totalRequests++;

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(fn);
      
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new CircuitBreakerTimeoutError(
            `Request timed out after ${this.config.timeout}ms`
          )),
          this.config.timeout
        )
      ),
    ]);
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.successCount++;

    if (this.state === CircuitState.HALF_OPEN) {
      logger.info('Circuit breaker test request succeeded, closing circuit', {
        name: this.config.name,
      });
      this.reset();
      this.transitionTo(CircuitState.CLOSED);
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: unknown): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    logger.error('Circuit breaker request failed', error instanceof Error ? error : new Error(String(error)), {
      name: this.config.name,
      failureCount: this.failureCount,
      totalRequests: this.totalRequests,
    });

    // If in HALF_OPEN state, immediately open circuit on failure
    if (this.state === CircuitState.HALF_OPEN) {
      logger.warn('Circuit breaker test request failed, reopening circuit', {
        name: this.config.name,
      });
      this.transitionTo(CircuitState.OPEN);
      return;
    }

    // Check if we should open the circuit
    if (this.shouldOpenCircuit()) {
      this.transitionTo(CircuitState.OPEN);
    }
  }

  /**
   * Determine if circuit should be opened based on failure threshold
   */
  private shouldOpenCircuit(): boolean {
    if (this.totalRequests < this.config.minimumRequests) {
      return false;
    }

    const failureRate = this.failureCount / this.totalRequests;
    return failureRate >= this.config.failureThreshold;
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = Date.now();

    logger.info('Circuit breaker state transition', {
      name: this.config.name,
      from: oldState,
      to: newState,
      stats: this.getStats(),
    });

    // Reset counters when opening circuit
    if (newState === CircuitState.OPEN) {
      this.resetCounters();
    }
  }

  /**
   * Reset circuit breaker to initial state
   */
  private reset(): void {
    this.resetCounters();
    this.lastFailureTime = undefined;
  }

  /**
   * Reset failure and success counters
   */
  private resetCounters(): void {
    this.failureCount = 0;
    this.successCount = 0;
    this.totalRequests = 0;
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      failureRate: this.totalRequests > 0 
        ? this.failureCount / this.totalRequests 
        : 0,
      lastFailureTime: this.lastFailureTime,
      lastStateChange: this.lastStateChange,
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Manually open the circuit (for testing or manual intervention)
   */
  open(): void {
    this.transitionTo(CircuitState.OPEN);
  }

  /**
   * Manually close the circuit (for testing or manual intervention)
   */
  close(): void {
    this.reset();
    this.transitionTo(CircuitState.CLOSED);
  }
}

/**
 * Error thrown when circuit breaker is open
 */
export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

/**
 * Error thrown when request times out
 */
export class CircuitBreakerTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerTimeoutError';
  }
}

/**
 * Create a circuit breaker with default configuration for external services
 */
export function createExternalServiceCircuitBreaker(
  serviceName: string,
  fallback?: <T>() => Promise<T>
): CircuitBreaker {
  return new CircuitBreaker({
    name: serviceName,
    failureThreshold: 0.5, // 50% failure rate
    minimumRequests: 10,
    timeout: 30000, // 30 seconds
    resetTimeout: 60000, // 60 seconds
    fallback,
  });
}
