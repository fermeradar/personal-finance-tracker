let rows;
const { pool } = require('../../config/database');
const { _AppError } = require('../../utils/errors');
const os = require('os');

class MetricsService {
  async getMetrics(timeframe, days) {
    const [system, performance, users] = await Promise.all([
      this.getSystemMetrics(),
      this.getPerformanceMetrics(timeframe, days),
      this.getUserMetrics(timeframe, days)
    ]);

    return {
      system,
      performance,
      users
    };
  }

  async getSystemMetrics() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    return {
      status: 'healthy',
      uptime: process.uptime(),
      version: process.env.npm_package_version,
      resources: {
        cpu: {
          load: os.loadavg(),
          cores: os.cpus().length
        },
        memory: {
          total: totalMemory,
          free: freeMemory,
          used: usedMemory,
          usagePercent: (usedMemory / totalMemory) * 100
        }
      }
    };
  }

  async getPerformanceMetrics(timeframe, days) {
    const query = `
      SELECT 
        AVG(response_time) as average_response_time,
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count
      FROM request_logs
      WHERE timestamp >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE_TRUNC('${timeframe}', timestamp)
      ORDER BY timestamp DESC
    `;

    const result = await pool.query(query);
    return this.processPerformanceMetrics(result.rows);
  }

  async getUserMetrics(timeframe, days) {
    const query = `
      SELECT 
        COUNT(DISTINCT user_id) as active_users,
        COUNT(*) as total_sessions,
        AVG(session_duration) as avg_session_duration
      FROM user_sessions
      WHERE timestamp >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE_TRUNC('${timeframe}', timestamp)
      ORDER BY timestamp DESC
    `;

    const result = await pool.query(query);
    return this.processUserMetrics(result.rows);
  }

  processPerformanceMetrics(_rows) {
    return {
      responseTime: {
        current: _rows[0]?.average_response_time || 0,
        average: rows.reduce((acc, row) => acc + row.average_response_time, 0) / rows.length,
        p95: this.calculatePercentile(rows.map(r => r.average_response_time), 95),
        p99: this.calculatePercentile(rows.map(r => r.average_response_time), 99)
      },
      requestCount: {
        total: _rows.reduce((acc, row) => acc + row.total_requests, 0),
        success: rows.reduce((acc, row) => acc + (row.total_requests - row.error_count), 0),
        error: rows.reduce((acc, row) => acc + row.error_count, 0)
      },
      errorRate: rows.reduce((acc, row) => acc + (row.error_count / row.total_requests), 0) / rows.length
    };
  }

  processUserMetrics(_rows) {
    return {
      active: _rows[0]?.active_users || 0,
      total: rows.reduce((acc, row) => acc + row.total_sessions, 0),
      new: this.calculateNewUsers(_rows),
      engagement: {
        score: this.calculateEngagementScore(_rows),
        trend: this.calculateTrend(rows.map(r => r.active_users))
      }
    };
  }

  calculatePercentile(values, percentile) {
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }

  calculateNewUsers(_rows) {
    // Implementation for calculating new users
    return 0; // Placeholder
  }

  calculateEngagementScore(_rows) {
    // Implementation for calculating engagement score
    return 0; // Placeholder
  }

  calculateTrend(values) {
    if (values.length < 2) return 'stable';
    const first = values[0];
    const last = values[values.length - 1];
    const change = ((last - first) / first) * 100;
    return change > 5 ? 'up' : change < -5 ? 'down' : 'stable';
  }
}

module.exports = new MetricsService(); 