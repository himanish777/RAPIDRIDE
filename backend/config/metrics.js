import promClient from 'prom-client';

// Create a Registry to register the metrics
const register = new promClient.Registry();

// Add default metrics (CPU, Memory, etc.)
promClient.collectDefaultMetrics({ register });

// Custom Business Metrics

// Counter: Total rides requested
const ridesRequestedCounter = new promClient.Counter({
  name: 'rapidride_rides_requested_total',
  help: 'Total number of ride requests',
  labelNames: ['status'],
  registers: [register],
});

// Counter: Total rides completed
const ridesCompletedCounter = new promClient.Counter({
  name: 'rapidride_rides_completed_total',
  help: 'Total number of completed rides',
  registers: [register],
});

// Counter: Total rides cancelled
const ridesCancelledCounter = new promClient.Counter({
  name: 'rapidride_rides_cancelled_total',
  help: 'Total number of cancelled rides',
  labelNames: ['cancelled_by'],
  registers: [register],
});

// Gauge: Active rides
const activeRidesGauge = new promClient.Gauge({
  name: 'rapidride_active_rides',
  help: 'Number of currently active rides',
  registers: [register],
});

// Gauge: Active users
const activeUsersGauge = new promClient.Gauge({
  name: 'rapidride_active_users',
  help: 'Number of currently active users',
  registers: [register],
});

// Histogram: Ride duration
const rideDurationHistogram = new promClient.Histogram({
  name: 'rapidride_ride_duration_seconds',
  help: 'Ride duration in seconds',
  buckets: [60, 300, 600, 900, 1800, 3600], // 1min, 5min, 10min, 15min, 30min, 1hr
  registers: [register],
});

// Histogram: Fare amount
const fareAmountHistogram = new promClient.Histogram({
  name: 'rapidride_fare_amount_inr',
  help: 'Fare amount in INR',
  buckets: [50, 100, 200, 500, 1000, 2000], // Different fare ranges
  registers: [register],
});

// Counter: User registrations
const userRegistrationsCounter = new promClient.Counter({
  name: 'rapidride_user_registrations_total',
  help: 'Total number of user registrations',
  labelNames: ['role'],
  registers: [register],
});

// Counter: Login attempts
const loginAttemptsCounter = new promClient.Counter({
  name: 'rapidride_login_attempts_total',
  help: 'Total number of login attempts',
  labelNames: ['status'],
  registers: [register],
});

// Counter: API errors
const apiErrorsCounter = new promClient.Counter({
  name: 'rapidride_api_errors_total',
  help: 'Total number of API errors',
  labelNames: ['endpoint', 'status_code'],
  registers: [register],
});

// Summary: Database query performance
const dbQueryDuration = new promClient.Summary({
  name: 'rapidride_db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation'],
  registers: [register],
});

export { register };

export const metrics = {
  ridesRequestedCounter,
  ridesCompletedCounter,
  ridesCancelledCounter,
  activeRidesGauge,
  activeUsersGauge,
  rideDurationHistogram,
  fareAmountHistogram,
  userRegistrationsCounter,
  loginAttemptsCounter,
  apiErrorsCounter,
  dbQueryDuration,
};
