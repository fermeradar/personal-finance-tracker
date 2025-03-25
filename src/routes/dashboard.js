const express = require('express');
const router = express.Router();
const monitoringService = require('../services/monitoring/monitoring-service');
const analyticsService = require('../services/monitoring/analytics-service');
const healthCheckService = require('../services/monitoring/health-check-service');
const { Parser } = require('json2csv');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const moment = require('moment');

// Dashboard API endpoints
router.get('/api/metrics', async (req, res) => {
  try {
    const metrics = await monitoringService.getUsageStats();
    const health = await healthCheckService.runHealthChecks();
    const analytics = await analyticsService.getAnalytics('daily');
    
    res.json({
      status: 'success',
      data: {
        metrics,
        health,
        analytics: analytics[0]
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

router.get('/api/analytics/features', async (req, res) => {
  try {
    const features = await analyticsService.getFeatureUsage();
    res.json({
      status: 'success',
      data: features
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// New API endpoints for historical data
router.get('/api/analytics/historical', async (req, res) => {
  try {
    const { timeframe = 'daily', days = 30 } = req.query;
    const analytics = await analyticsService.getAnalytics(timeframe);
    res.json({
      status: 'success',
      data: analytics.slice(0, parseInt(days))
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

router.get('/api/analytics/errors', async (req, res) => {
  try {
    const { timeframe = 'daily', days = 7 } = req.query;
    const errors = await monitoringService.getErrorStats(timeframe, parseInt(days));
    res.json({
      status: 'success',
      data: errors
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// New API endpoints for specialized views
router.get('/api/analytics/user-behavior', async (req, res) => {
  try {
    const { timeframe = 'daily', days = 30 } = req.query;
    const behavior = await analyticsService.getUserBehavior(timeframe, parseInt(days));
    res.json({
      status: 'success',
      data: behavior
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

router.get('/api/analytics/system-resources', async (req, res) => {
  try {
    const { timeframe = 'daily', days = 7 } = req.query;
    const resources = await monitoringService.getSystemResources(timeframe, parseInt(days));
    res.json({
      status: 'success',
      data: resources
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Enhanced export endpoints
router.get('/api/export/metrics', async (req, res) => {
  try {
    const { timeframe = 'daily', days = 30, format = 'csv' } = req.query;
    const metrics = await monitoringService.getUsageStats();
    const analytics = await analyticsService.getAnalytics(timeframe);
    const data = analytics.slice(0, parseInt(days));

    switch (format) {
      case 'excel':
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Metrics');

        // Add headers
        worksheet.columns = [
          { header: 'Date', key: 'date', width: 15 },
          { header: 'Total Requests', key: 'totalRequests', width: 15 },
          { header: 'Average Response Time (ms)', key: 'averageResponseTime', width: 20 },
          { header: 'Error Rate (%)', key: 'errorRate', width: 15 },
          { header: 'Active Users', key: 'activeUsers', width: 15 },
          { header: 'Engagement Score (%)', key: 'engagementScore', width: 20 }
        ];

        // Add data
        data.forEach(row => {
          worksheet.addRow({
            date: new Date(row.date).toLocaleDateString(),
            totalRequests: row.totalRequests,
            averageResponseTime: row.performanceMetrics.averageResponseTime.toFixed(2),
            errorRate: row.errorRates.errorRate.toFixed(2),
            activeUsers: row.userEngagement.totalUsers,
            engagementScore: row.userEngagement.engagementScore.toFixed(1)
          });
        });

        // Add summary statistics
        worksheet.addRow({});
        worksheet.addRow({ date: 'Summary Statistics' });
        worksheet.addRow({
          date: 'Average',
          totalRequests: data.reduce((acc, row) => acc + row.totalRequests, 0) / data.length,
          averageResponseTime: data.reduce((acc, row) => acc + row.performanceMetrics.averageResponseTime, 0) / data.length,
          errorRate: data.reduce((acc, row) => acc + row.errorRates.errorRate, 0) / data.length,
          activeUsers: data.reduce((acc, row) => acc + row.userEngagement.totalUsers, 0) / data.length,
          engagementScore: data.reduce((acc, row) => acc + row.userEngagement.engagementScore, 0) / data.length
        });

        // Style the worksheet
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=metrics-${timeframe}-${days}days.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
        break;
      case 'pdf':
        const doc = new PDFDocument();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=metrics-${timeframe}-${days}days.pdf`);
        doc.pipe(res);

        // Add title
        doc.fontSize(20).text('Metrics Report', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Generated on: ${new Date().toLocaleString()}`);
        doc.moveDown();

        // Add summary statistics
        doc.fontSize(16).text('Summary Statistics');
        doc.moveDown();
        const summary = {
          'Total Requests': data.reduce((acc, row) => acc + row.totalRequests, 0),
          'Average Response Time': `${(data.reduce((acc, row) => acc + row.performanceMetrics.averageResponseTime, 0) / data.length).toFixed(2)}ms`,
          'Average Error Rate': `${(data.reduce((acc, row) => acc + row.errorRates.errorRate, 0) / data.length).toFixed(2)}%`,
          'Average Active Users': Math.round(data.reduce((acc, row) => acc + row.userEngagement.totalUsers, 0) / data.length),
          'Average Engagement Score': `${(data.reduce((acc, row) => acc + row.userEngagement.engagementScore, 0) / data.length).toFixed(1)}%`
        };

        Object.entries(summary).forEach(([key, value]) => {
          doc.fontSize(12).text(`${key}: ${value}`);
          doc.moveDown(0.5);
        });
        doc.moveDown();

        // Add detailed data table
        doc.fontSize(16).text('Detailed Data');
        doc.moveDown();
        
        const headers = ['Date', 'Requests', 'Response Time', 'Error Rate', 'Users', 'Engagement'];
        const columnWidths = [100, 80, 100, 80, 80, 100];
        
        // Draw headers
        let x = 50;
        headers.forEach((header, i) => {
          doc.text(header, x, doc.y);
          x += columnWidths[i];
        });
        doc.moveDown();

        // Draw data rows
        data.forEach(row => {
          x = 50;
          const values = [
            new Date(row.date).toLocaleDateString(),
            row.totalRequests,
            `${row.performanceMetrics.averageResponseTime.toFixed(2)}ms`,
            `${row.errorRates.errorRate.toFixed(2)}%`,
            row.userEngagement.totalUsers,
            `${row.userEngagement.engagementScore.toFixed(1)}%`
          ];
          
          values.forEach((value, i) => {
            doc.text(value.toString(), x, doc.y);
            x += columnWidths[i];
          });
          doc.moveDown();
        });

        doc.end();
        break;
      case 'json':
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=metrics-${timeframe}-${days}days.json`);
        res.send(JSON.stringify(data, null, 2));
        break;
      default:
        const fields = ['date', 'totalRequests', 'averageResponseTime', 'errorRate', 'activeUsers', 'engagementScore'];
        const parser = new Parser({ fields });
        const csv = parser.parse(data);

        res.header('Content-Type', 'text/csv');
        res.attachment(`metrics-${timeframe}-${days}days.csv`);
        res.send(csv);
    }
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

router.get('/api/export/errors', async (req, res) => {
  try {
    const { timeframe = 'daily', days = 7 } = req.query;
    const errors = await monitoringService.getErrorStats(timeframe, parseInt(days));

    const fields = ['date', 'type', 'count', 'lastOccurrence', 'stack'];
    const parser = new Parser({ fields });
    const csv = parser.parse(errors);

    res.header('Content-Type', 'text/csv');
    res.attachment(`errors-${timeframe}-${days}days.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Dashboard HTML
router.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Application Dashboard</title>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"></script>
      <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom"></script>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          margin: 0;
          padding: 20px;
          background: #f5f5f5;
        }
        .dashboard {
          max-width: 1200px;
          margin: 0 auto;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .card {
          background: white;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
          margin-bottom: 20px;
        }
        .metric {
          text-align: center;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 6px;
        }
        .metric-value {
          font-size: 24px;
          font-weight: bold;
          color: #2c3e50;
        }
        .metric-label {
          color: #6c757d;
          font-size: 14px;
        }
        .chart-container {
          position: relative;
          height: 300px;
          margin-bottom: 20px;
        }
        .status-healthy {
          color: #28a745;
        }
        .status-unhealthy {
          color: #dc3545;
        }
        .refresh-button {
          background: #007bff;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }
        .refresh-button:hover {
          background: #0056b3;
        }
        .nav-tabs {
          display: flex;
          margin-bottom: 20px;
          border-bottom: 1px solid #dee2e6;
        }
        .nav-tab {
          padding: 10px 20px;
          cursor: pointer;
          border: none;
          background: none;
          color: #6c757d;
        }
        .nav-tab.active {
          color: #007bff;
          border-bottom: 2px solid #007bff;
        }
        .tab-content {
          display: none;
        }
        .tab-content.active {
          display: block;
        }
        .error-details {
          margin-top: 20px;
          padding: 15px;
          background: #fff3f3;
          border-radius: 6px;
        }
        .error-stack {
          font-family: monospace;
          white-space: pre-wrap;
          margin-top: 10px;
        }
        .timeframe-selector {
          margin-bottom: 20px;
        }
        .timeframe-selector select {
          padding: 5px 10px;
          border-radius: 4px;
          border: 1px solid #dee2e6;
        }
        .export-buttons {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
        }
        
        .export-button {
          background: #28a745;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 5px;
        }
        
        .export-button:hover {
          background: #218838;
        }
        
        .user-behavior-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
          margin-bottom: 20px;
        }
        
        .behavior-card {
          background: white;
          border-radius: 8px;
          padding: 15px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .resource-usage {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
        }
        
        .resource-card {
          background: white;
          border-radius: 8px;
          padding: 15px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .resource-value {
          font-size: 20px;
          font-weight: bold;
          color: #2c3e50;
        }
        
        .resource-label {
          color: #6c757d;
          font-size: 14px;
        }
        
        .progress-bar {
          width: 100%;
          height: 8px;
          background: #e9ecef;
          border-radius: 4px;
          margin-top: 5px;
        }
        
        .progress-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.3s ease;
        }
        
        .chart-controls {
          display: flex;
          gap: 10px;
          margin-bottom: 10px;
          align-items: center;
        }
        
        .chart-button {
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          padding: 5px 10px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }
        
        .chart-button:hover {
          background: #e9ecef;
        }
        
        .chart-button.active {
          background: #007bff;
          color: white;
          border-color: #0056b3;
        }
        
        .export-format {
          display: flex;
          gap: 5px;
          margin-left: 10px;
        }
        
        .export-format button {
          padding: 5px 10px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }
        
        .export-format button.active {
          background: #28a745;
          color: white;
          border-color: #218838;
        }
        
        .chart-tooltip {
          position: absolute;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 5px 10px;
          border-radius: 4px;
          font-size: 12px;
          pointer-events: none;
          z-index: 1000;
        }
        
        .date-range-picker {
          display: flex;
          gap: 10px;
          align-items: center;
          margin-bottom: 20px;
        }
        
        .date-input {
          padding: 5px 10px;
          border: 1px solid #dee2e6;
          border-radius: 4px;
        }
        
        .filter-section {
          background: white;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .filter-group {
          display: flex;
          gap: 15px;
          margin-bottom: 10px;
        }
        
        .filter-label {
          font-weight: bold;
          min-width: 100px;
        }
        
        .filter-options {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        
        .filter-option {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        
        .chart-legend {
          display: flex;
          gap: 15px;
          margin-top: 10px;
          flex-wrap: wrap;
        }
        
        .legend-item {
          display: flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
        }
        
        .legend-color {
          width: 12px;
          height: 12px;
          border-radius: 2px;
        }
        
        .legend-item.disabled {
          opacity: 0.3;
        }
        
        .filter-groups {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }
        
        .filter-actions {
          display: flex;
          gap: 10px;
          margin-top: 15px;
        }
        
        .filter-option {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 4px 8px;
          border-radius: 4px;
          transition: background-color 0.2s;
        }
        
        .filter-option:hover {
          background-color: #f8f9fa;
        }
        
        .filter-option input[type="checkbox"] {
          width: 16px;
          height: 16px;
          cursor: pointer;
        }
        
        .filter-option label {
          cursor: pointer;
          user-select: none;
        }
        
        .filter-label {
          font-weight: 600;
          color: #495057;
          min-width: 120px;
        }
        
        .filter-options {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          flex: 1;
        }
        
        .filter-presets {
          margin-bottom: 20px;
          padding: 10px;
          background: #f8f9fa;
          border-radius: 4px;
        }
        
        .preset-button {
          background: #e9ecef;
          border: 1px solid #dee2e6;
          padding: 5px 10px;
          border-radius: 4px;
          cursor: pointer;
          margin-right: 5px;
          transition: all 0.2s;
        }
        
        .preset-button:hover {
          background: #dee2e6;
        }
        
        .preset-button.active {
          background: #007bff;
          color: white;
          border-color: #0056b3;
        }
        
        .time-period-option {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 4px 8px;
          border-radius: 4px;
          transition: background-color 0.2s;
        }
        
        .time-period-option:hover {
          background-color: #f8f9fa;
        }
        
        .time-period-option input[type="radio"] {
          width: 16px;
          height: 16px;
          cursor: pointer;
        }
        
        .region-option {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 4px 8px;
          border-radius: 4px;
          transition: background-color 0.2s;
        }
        
        .region-option:hover {
          background-color: #f8f9fa;
        }
        
        .region-option input[type="checkbox"] {
          width: 16px;
          height: 16px;
          cursor: pointer;
        }
      </style>
    </head>
    <body>
      <div class="dashboard">
        <div class="header">
          <h1>Application Dashboard</h1>
          <div>
            <div class="export-buttons">
              <button class="export-button" onclick="exportData('metrics')">
                <span>📊</span> Export Metrics
              </button>
              <button class="export-button" onclick="exportData('errors')">
                <span>⚠️</span> Export Errors
              </button>
            </div>
            <button class="refresh-button" onclick="refreshData()">Refresh Data</button>
          </div>
        </div>

        <div class="nav-tabs">
          <button class="nav-tab active" onclick="switchTab('overview')">Overview</button>
          <button class="nav-tab" onclick="switchTab('historical')">Historical Trends</button>
          <button class="nav-tab" onclick="switchTab('errors')">Error Analysis</button>
          <button class="nav-tab" onclick="switchTab('user-behavior')">User Behavior</button>
          <button class="nav-tab" onclick="switchTab('system')">System Resources</button>
        </div>
        
        <div id="overview" class="tab-content active">
          <div class="grid">
            <div class="card">
              <h2>System Health</h2>
              <div id="health-status"></div>
            </div>
            <div class="card">
              <h2>Performance Metrics</h2>
              <div id="performance-metrics"></div>
            </div>
            <div class="card">
              <h2>User Analytics</h2>
              <div id="user-analytics"></div>
            </div>
          </div>
          
          <div class="card">
            <h2>Error Rates</h2>
            <div class="chart-container">
              <canvas id="error-chart"></canvas>
            </div>
          </div>
          
          <div class="card">
            <h2>Feature Usage</h2>
            <div class="chart-container">
              <canvas id="feature-chart"></canvas>
            </div>
          </div>
        </div>

        <div id="historical" class="tab-content">
          <div class="timeframe-selector">
            <label for="timeframe">Timeframe:</label>
            <select id="timeframe" onchange="updateHistoricalData()">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <label for="days">Days:</label>
            <select id="days" onchange="updateHistoricalData()">
              <option value="7">Last 7 days</option>
              <option value="30" selected>Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </div>
          <div class="card">
            <h2>User Engagement Trends</h2>
            <div class="chart-container">
              <canvas id="engagement-trend-chart"></canvas>
            </div>
          </div>
          <div class="card">
            <h2>Performance Trends</h2>
            <div class="chart-container">
              <canvas id="performance-trend-chart"></canvas>
            </div>
          </div>
        </div>

        <div id="errors" class="tab-content">
          <div class="timeframe-selector">
            <label for="error-timeframe">Timeframe:</label>
            <select id="error-timeframe" onchange="updateErrorAnalysis()">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <label for="error-days">Days:</label>
            <select id="error-days" onchange="updateErrorAnalysis()">
              <option value="7" selected>Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </div>
          <div class="card">
            <h2>Error Trends</h2>
            <div class="chart-container">
              <canvas id="error-trend-chart"></canvas>
            </div>
          </div>
          <div class="card">
            <h2>Error Details</h2>
            <div id="error-details"></div>
          </div>
        </div>

        <div id="user-behavior" class="tab-content">
          <div class="timeframe-selector">
            <label for="behavior-timeframe">Timeframe:</label>
            <select id="behavior-timeframe" onchange="updateUserBehavior()">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <label for="behavior-days">Days:</label>
            <select id="behavior-days" onchange="updateUserBehavior()">
              <option value="7">Last 7 days</option>
              <option value="30" selected>Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </div>
          <div class="card">
            <h2>User Session Analysis</h2>
            <div class="chart-container">
              <canvas id="session-chart"></canvas>
            </div>
          </div>
          <div class="user-behavior-grid">
            <div class="behavior-card">
              <h3>Peak Usage Times</h3>
              <div id="peak-times"></div>
            </div>
            <div class="behavior-card">
              <h3>Common User Flows</h3>
              <div id="user-flows"></div>
            </div>
            <div class="behavior-card">
              <h3>Feature Adoption</h3>
              <div id="feature-adoption"></div>
            </div>
          </div>
        </div>

        <div id="system" class="tab-content">
          <div class="timeframe-selector">
            <label for="system-timeframe">Timeframe:</label>
            <select id="system-timeframe" onchange="updateSystemResources()">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <label for="system-days">Days:</label>
            <select id="system-days" onchange="updateSystemResources()">
              <option value="7" selected>Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </div>
          <div class="resource-usage">
            <div class="resource-card">
              <h3>CPU Usage</h3>
              <div class="resource-value" id="cpu-usage">0%</div>
              <div class="progress-bar">
                <div class="progress-fill" id="cpu-progress" style="width: 0%; background: #28a745;"></div>
              </div>
            </div>
            <div class="resource-card">
              <h3>Memory Usage</h3>
              <div class="resource-value" id="memory-usage">0%</div>
              <div class="progress-bar">
                <div class="progress-fill" id="memory-progress" style="width: 0%; background: #007bff;"></div>
              </div>
            </div>
            <div class="resource-card">
              <h3>Disk Usage</h3>
              <div class="resource-value" id="disk-usage">0%</div>
              <div class="progress-bar">
                <div class="progress-fill" id="disk-progress" style="width: 0%; background: #ffc107;"></div>
              </div>
            </div>
          </div>
          <div class="card">
            <h2>Resource Usage Trends</h2>
            <div class="chart-container">
              <canvas id="resource-trend-chart"></canvas>
            </div>
          </div>
        </div>
      </div>

      <script>
        let errorChart, featureChart, engagementTrendChart, performanceTrendChart, errorTrendChart, sessionChart, resourceTrendChart;

        function switchTab(tabId) {
          // Hide all tab contents
          document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
          });
          // Show selected tab content
          document.getElementById(tabId).classList.add('active');
          
          // Update active tab button
          document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
          });
          event.target.classList.add('active');
          
          // Refresh data for the selected tab
          if (tabId === 'historical') {
            updateHistoricalData();
          } else if (tabId === 'errors') {
            updateErrorAnalysis();
          } else if (tabId === 'user-behavior') {
            updateUserBehavior();
          } else if (tabId === 'system') {
            updateSystemResources();
          }
        }

        async function fetchData() {
          try {
            const response = await fetch('/api/dashboard/metrics');
            const data = await response.json();
            updateDashboard(data.data);
          } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
          }
        }

        async function updateHistoricalData() {
          try {
            const timeframe = document.getElementById('timeframe').value;
            const days = document.getElementById('days').value;
            const response = await fetch(\`/api/dashboard/analytics/historical?timeframe=\${timeframe}&days=\${days}\`);
            const data = await response.json();
            updateHistoricalCharts(data.data);
          } catch (error) {
            console.error('Failed to fetch historical data:', error);
          }
        }

        async function updateErrorAnalysis() {
          try {
            const timeframe = document.getElementById('error-timeframe').value;
            const days = document.getElementById('error-days').value;
            const response = await fetch(\`/api/dashboard/analytics/errors?timeframe=\${timeframe}&days=\${days}\`);
            const data = await response.json();
            updateErrorCharts(data.data);
          } catch (error) {
            console.error('Failed to fetch error data:', error);
          }
        }

        async function updateUserBehavior() {
          try {
            const timeframe = document.getElementById('behavior-timeframe').value;
            const days = document.getElementById('behavior-days').value;
            const response = await fetch(\`/api/dashboard/analytics/user-behavior?timeframe=\${timeframe}&days=\${days}\`);
            const data = await response.json();
            updateUserBehaviorCharts(data.data);
          } catch (error) {
            console.error('Failed to fetch user behavior data:', error);
          }
        }

        async function updateSystemResources() {
          try {
            const timeframe = document.getElementById('system-timeframe').value;
            const days = document.getElementById('system-days').value;
            const response = await fetch(\`/api/dashboard/analytics/system-resources?timeframe=\${timeframe}&days=\${days}\`);
            const data = await response.json();
            updateSystemResourceCharts(data.data);
          } catch (error) {
            console.error('Failed to fetch system resource data:', error);
          }
        }

        function updateHistoricalCharts(data) {
          // Update engagement trend chart
          const engagementCtx = document.getElementById('engagement-trend-chart').getContext('2d');
          if (engagementTrendChart) {
            engagementTrendChart.destroy();
          }
          engagementTrendChart = new Chart(engagementCtx, {
            type: 'line',
            data: {
              labels: data.map(d => d.date),
              datasets: [{
                label: 'Active Users',
                data: data.map(d => d.userEngagement.totalUsers),
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
              }, {
                label: 'Engagement Score',
                data: data.map(d => d.userEngagement.engagementScore),
                borderColor: 'rgb(255, 99, 132)',
                tension: 0.1
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: {
                  beginAtZero: true
                }
              }
            }
          });

          // Update performance trend chart
          const performanceCtx = document.getElementById('performance-trend-chart').getContext('2d');
          if (performanceTrendChart) {
            performanceTrendChart.destroy();
          }
          performanceTrendChart = new Chart(performanceCtx, {
            type: 'line',
            data: {
              labels: data.map(d => d.date),
              datasets: [{
                label: 'Average Response Time (ms)',
                data: data.map(d => d.performanceMetrics.averageResponseTime),
                borderColor: 'rgb(54, 162, 235)',
                tension: 0.1
              }, {
                label: 'Error Rate (%)',
                data: data.map(d => d.errorRates.errorRate),
                borderColor: 'rgb(255, 99, 132)',
                tension: 0.1
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: {
                  beginAtZero: true
                }
              }
            }
          });
        }

        function updateErrorCharts(data) {
          // Update error trend chart
          const errorTrendCtx = document.getElementById('error-trend-chart').getContext('2d');
          if (errorTrendChart) {
            errorTrendChart.destroy();
          }
          errorTrendChart = new Chart(errorTrendCtx, {
            type: 'line',
            data: {
              labels: data.map(d => d.date),
              datasets: [{
                label: 'Total Errors',
                data: data.map(d => d.totalErrors),
                borderColor: 'rgb(255, 99, 132)',
                tension: 0.1
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: {
                  beginAtZero: true
                }
              }
            }
          });

          // Update error details
          const errorDetails = document.getElementById('error-details');
          errorDetails.innerHTML = data.map(error => \`
            <div class="error-details">
              <h3>\${error.type}</h3>
              <p>Count: \${error.count}</p>
              <p>Last Occurrence: \${new Date(error.lastOccurrence).toLocaleString()}</p>
              <div class="error-stack">\${error.stack}</div>
            </div>
          \`).join('');
        }

        function updateUserBehaviorCharts(data) {
          // Update session chart
          const sessionCtx = document.getElementById('session-chart').getContext('2d');
          if (sessionChart) {
            sessionChart.destroy();
          }
          sessionChart = new Chart(sessionCtx, {
            type: 'line',
            data: {
              labels: data.map(d => d.date),
              datasets: [{
                label: 'Average Session Duration (minutes)',
                data: data.map(d => d.sessionDuration),
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
              }, {
                label: 'Sessions per User',
                data: data.map(d => d.sessionsPerUser),
                borderColor: 'rgb(255, 99, 132)',
                tension: 0.1
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: {
                  beginAtZero: true
                }
              }
            }
          });

          // Update peak times
          const peakTimes = document.getElementById('peak-times');
          peakTimes.innerHTML = data[0].peakTimes.map(time => \`
            <div class="metric">
              <div class="metric-value">\${time.hour}:00</div>
              <div class="metric-label">\${time.percentage}% of users</div>
            </div>
          \`).join('');

          // Update user flows
          const userFlows = document.getElementById('user-flows');
          userFlows.innerHTML = data[0].commonFlows.map(flow => \`
            <div class="metric">
              <div class="metric-value">\${flow.percentage}%</div>
              <div class="metric-label">\${flow.path}</div>
            </div>
          \`).join('');

          // Update feature adoption
          const featureAdoption = document.getElementById('feature-adoption');
          featureAdoption.innerHTML = data[0].featureAdoption.map(feature => \`
            <div class="metric">
              <div class="metric-value">\${feature.adoptionRate}%</div>
              <div class="metric-label">\${feature.name}</div>
            </div>
          \`).join('');
        }

        function updateSystemResourceCharts(data) {
          // Update resource usage values
          const latest = data[data.length - 1];
          document.getElementById('cpu-usage').textContent = \`\${latest.cpu}%\`;
          document.getElementById('memory-usage').textContent = \`\${latest.memory}%\`;
          document.getElementById('disk-usage').textContent = \`\${latest.disk}%\`;
          
          document.getElementById('cpu-progress').style.width = \`\${latest.cpu}%\`;
          document.getElementById('memory-progress').style.width = \`\${latest.memory}%\`;
          document.getElementById('disk-progress').style.width = \`\${latest.disk}%\`;

          // Update resource trend chart
          const resourceCtx = document.getElementById('resource-trend-chart').getContext('2d');
          if (resourceTrendChart) {
            resourceTrendChart.destroy();
          }
          resourceTrendChart = new Chart(resourceCtx, {
            type: 'line',
            data: {
              labels: data.map(d => d.date),
              datasets: [{
                label: 'CPU Usage (%)',
                data: data.map(d => d.cpu),
                borderColor: 'rgb(40, 167, 69)',
                tension: 0.1
              }, {
                label: 'Memory Usage (%)',
                data: data.map(d => d.memory),
                borderColor: 'rgb(0, 123, 255)',
                tension: 0.1
              }, {
                label: 'Disk Usage (%)',
                data: data.map(d => d.disk),
                borderColor: 'rgb(255, 193, 7)',
                tension: 0.1
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: {
                  beginAtZero: true,
                  max: 100
                }
              }
            }
          });
        }

        function updateDashboard(data) {
          // Update health status
          const healthStatus = document.getElementById('health-status');
          healthStatus.innerHTML = data.health.map(check => \`
            <div class="metric">
              <div class="metric-value status-\${check.status}">\${check.status}</div>
              <div class="metric-label">\${check.name}</div>
            </div>
          \`).join('');

          // Update performance metrics
          const performanceMetrics = document.getElementById('performance-metrics');
          performanceMetrics.innerHTML = \`
            <div class="metric">
              <div class="metric-value">\${data.metrics.averageResponseTime.toFixed(2)}ms</div>
              <div class="metric-label">Average Response Time</div>
            </div>
            <div class="metric">
              <div class="metric-value">\${data.metrics.totalRequests}</div>
              <div class="metric-label">Total Requests</div>
            </div>
            <div class="metric">
              <div class="metric-value">\${data.metrics.errorRate.toFixed(2)}%</div>
              <div class="metric-label">Error Rate</div>
            </div>
          \`;

          // Update user analytics
          const userAnalytics = document.getElementById('user-analytics');
          userAnalytics.innerHTML = \`
            <div class="metric">
              <div class="metric-value">\${data.analytics.userEngagement.totalUsers}</div>
              <div class="metric-label">Active Users</div>
            </div>
            <div class="metric">
              <div class="metric-value">\${data.analytics.userEngagement.engagementScore.toFixed(1)}%</div>
              <div class="metric-label">Engagement Score</div>
            </div>
            <div class="metric">
              <div class="metric-value">\${data.analytics.userRetention.toFixed(1)}%</div>
              <div class="metric-label">User Retention</div>
            </div>
          \`;

          // Update error chart
          updateErrorChart(data.analytics.errorRates);
          
          // Update feature chart
          updateFeatureChart(data.analytics.featureUsage);
        }

        function updateErrorChart(errorRates) {
          const ctx = document.getElementById('error-chart').getContext('2d');
          
          if (errorChart) {
            errorChart.destroy();
          }
          
          errorChart = new Chart(ctx, {
            type: 'bar',
            data: {
              labels: Object.keys(errorRates.errorTypes),
              datasets: [{
                label: 'Error Count',
                data: Object.values(errorRates.errorTypes),
                backgroundColor: 'rgba(220, 53, 69, 0.5)',
                borderColor: 'rgb(220, 53, 69)',
                borderWidth: 1,
                unit: ' errors'
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: {
                  beginAtZero: true
                }
              }
            }
          });
        }

        function updateFeatureChart(featureUsage) {
          const ctx = document.getElementById('feature-chart').getContext('2d');
          
          if (featureChart) {
            featureChart.destroy();
          }
          
          featureChart = new Chart(ctx, {
            type: 'bar',
            data: {
              labels: Object.keys(featureUsage),
              datasets: [{
                label: 'Usage Count',
                data: Object.values(featureUsage).map(f => f.totalUsage),
                backgroundColor: 'rgba(0, 123, 255, 0.5)',
                borderColor: 'rgb(0, 123, 255)',
                borderWidth: 1
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: {
                  beginAtZero: true
                }
              }
            }
          });
        }

        function refreshData() {
          fetchData();
          const activeTab = document.querySelector('.nav-tab.active').textContent.toLowerCase();
          if (activeTab === 'historical trends') {
            updateHistoricalData();
          } else if (activeTab === 'error analysis') {
            updateErrorAnalysis();
          } else if (activeTab === 'user behavior') {
            updateUserBehavior();
          } else if (activeTab === 'system') {
            updateSystemResources();
          }
        }

        function exportData(type) {
          const timeframe = type === 'metrics' ? 
            document.getElementById('timeframe').value : 
            document.getElementById('error-timeframe').value;
          const days = type === 'metrics' ? 
            document.getElementById('days').value : 
            document.getElementById('error-days').value;
          const format = document.querySelector(\`.export-format[data-type="\${type}"] button.active\`).dataset.format;
          const startDate = document.getElementById(\`\${type}-start-date\`).value;
          const endDate = document.getElementById(\`\${type}-end-date\`).value;
            
          window.location.href = \`/api/dashboard/export/\${type}?timeframe=\${timeframe}&days=\${days}&format=\${format}&startDate=\${startDate}&endDate=\${endDate}\`;
        }

        // Register Chart.js plugins
        Chart.register(ChartDataLabels);
        Chart.register(ChartZoom);

        // Common chart options
        const commonChartOptions = {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false,
          },
          plugins: {
            datalabels: {
              color: '#666',
              font: {
                size: 11
              },
              formatter: (value) => {
                if (typeof value === 'number') {
                  return value.toFixed(1);
                }
                return value;
              }
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              titleColor: 'white',
              bodyColor: 'white',
              padding: 10,
              displayColors: true,
              callbacks: {
                label: function(context) {
                  let label = context.dataset.label || '';
                  if (label) {
                    label += ': ';
                  }
                  if (context.parsed.y !== null) {
                    label += context.parsed.y.toFixed(1);
                    if (context.dataset.unit) {
                      label += context.dataset.unit;
                    }
                  }
                  return label;
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: function(value) {
                  return value.toFixed(1);
                }
              }
            }
          }
        };

        // Add chart controls to each chart container
        function addChartControls(chartId) {
          const container = document.getElementById(chartId).parentElement;
          const controls = document.createElement('div');
          controls.className = 'chart-controls';
          controls.innerHTML = \`
            <button class="chart-button" onclick="toggleChartType('\${chartId}')">Toggle Type</button>
            <button class="chart-button" onclick="resetChartZoom('\${chartId}')">Reset Zoom</button>
            <button class="chart-button" onclick="toggleDataLabels('\${chartId}')">Toggle Labels</button>
          \`;
          container.insertBefore(controls, document.getElementById(chartId));
        }

        // Chart control functions
        function toggleChartType(chartId) {
          const chart = window[chartId.replace('-chart', 'Chart')];
          if (chart) {
            const currentType = chart.config.type;
            const newType = currentType === 'bar' ? 'line' : 'bar';
            chart.config.type = newType;
            chart.update();
          }
        }

        function resetChartZoom(chartId) {
          const chart = window[chartId.replace('-chart', 'Chart')];
          if (chart) {
            chart.resetZoom();
          }
        }

        function toggleDataLabels(chartId) {
          const chart = window[chartId.replace('-chart', 'Chart')];
          if (chart) {
            const currentState = chart.options.plugins.datalabels.display;
            chart.options.plugins.datalabels.display = !currentState;
            chart.update();
          }
        }

        // Add date range picker to each tab
        function addDateRangePicker(tabId) {
          const tab = document.getElementById(tabId);
          const dateRangePicker = document.createElement('div');
          dateRangePicker.className = 'date-range-picker';
          dateRangePicker.innerHTML = \`
            <label>Date Range:</label>
            <input type="date" class="date-input" id="\${tabId}-start-date">
            <span>to</span>
            <input type="date" class="date-input" id="\${tabId}-end-date">
            <button class="chart-button" onclick="applyDateRange('\${tabId}')">Apply</button>
          \`;
          tab.insertBefore(dateRangePicker, tab.firstChild);
        }

        // Define filter options based on tab
        const filterOptions = {
          overview: {
            metrics: ['requests', 'response-time', 'error-rate'],
            userTypes: ['free', 'premium', 'enterprise'],
            features: ['transactions', 'budgeting', 'reports', 'alerts'],
            timePeriods: ['last-hour', 'last-24h', 'last-7d', 'last-30d', 'last-90d', 'custom'],
            regions: ['north-america', 'europe', 'asia', 'south-america', 'africa', 'oceania']
          },
          historical: {
            metrics: ['active-users', 'engagement-score', 'retention-rate'],
            userTypes: ['free', 'premium', 'enterprise'],
            features: ['transactions', 'budgeting', 'reports', 'alerts'],
            timePeriods: ['last-7d', 'last-30d', 'last-90d', 'last-year', 'custom'],
            regions: ['north-america', 'europe', 'asia', 'south-america', 'africa', 'oceania']
          },
          errors: {
            errorTypes: ['validation', 'authentication', 'database', 'network'],
            severity: ['low', 'medium', 'high', 'critical'],
            features: ['transactions', 'budgeting', 'reports', 'alerts'],
            timePeriods: ['last-24h', 'last-7d', 'last-30d', 'custom'],
            regions: ['north-america', 'europe', 'asia', 'south-america', 'africa', 'oceania']
          },
          'user-behavior': {
            metrics: ['session-duration', 'sessions-per-user', 'feature-usage'],
            userTypes: ['free', 'premium', 'enterprise'],
            features: ['transactions', 'budgeting', 'reports', 'alerts'],
            timePeriods: ['last-7d', 'last-30d', 'last-90d', 'custom'],
            regions: ['north-america', 'europe', 'asia', 'south-america', 'africa', 'oceania']
          },
          system: {
            metrics: ['cpu', 'memory', 'disk', 'network'],
            components: ['api', 'database', 'cache', 'storage'],
            features: ['transactions', 'budgeting', 'reports', 'alerts'],
            timePeriods: ['last-hour', 'last-24h', 'last-7d', 'custom'],
            regions: ['north-america', 'europe', 'asia', 'south-america', 'africa', 'oceania']
          }
        };

        // Define filter presets
        const filterPresets = {
          'performance-analysis': {
            metrics: ['requests', 'response-time', 'error-rate'],
            timePeriods: ['last-24h'],
            regions: ['north-america', 'europe', 'asia']
          },
          'error-investigation': {
            errorTypes: ['validation', 'authentication', 'database', 'network'],
            severity: ['high', 'critical'],
            timePeriods: ['last-7d']
          },
          'user-engagement': {
            metrics: ['active-users', 'engagement-score'],
            userTypes: ['premium', 'enterprise'],
            features: ['transactions', 'budgeting']
          },
          'system-health': {
            metrics: ['cpu', 'memory', 'disk'],
            components: ['api', 'database'],
            timePeriods: ['last-24h']
          }
        };

        // Add filter section to each tab
        function addFilterSection(tabId) {
          const tab = document.getElementById(tabId);
          const filterSection = document.createElement('div');
          filterSection.className = 'filter-section';
          
          const options = filterOptions[tabId] || {};
          
          filterSection.innerHTML = \`
            <h3>Filters</h3>
            <div class="filter-presets">
              <div class="filter-label">Presets:</div>
              <div class="filter-options">
                ${Object.entries(filterPresets).map(([presetId, preset]) => \`
                  <button class="preset-button" onclick="applyPreset('\${tabId}', '\${presetId}')">
                    ${presetId.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                  </button>
                \`).join('')}
              </div>
            </div>
            <div class="filter-groups">
              ${options.timePeriods ? \`
                <div class="filter-group">
                  <div class="filter-label">Time Period:</div>
                  <div class="filter-options" id="\${tabId}-time-period-filters">
                    ${options.timePeriods.map(period => \`
                      <div class="filter-option">
                        <input type="radio" name="\${tabId}-time-period" id="\${tabId}-time-\${period}" 
                          value="\${period}" ${period === 'last-24h' ? 'checked' : ''}>
                        <label for="\${tabId}-time-\${period}">${period.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</label>
                      </div>
                    \`).join('')}
                  </div>
                </div>
              \` : ''}
              
              ${options.regions ? \`
                <div class="filter-group">
                  <div class="filter-label">Regions:</div>
                  <div class="filter-options" id="\${tabId}-region-filters">
                    ${options.regions.map(region => \`
                      <div class="filter-option">
                        <input type="checkbox" id="\${tabId}-region-\${region}" checked>
                        <label for="\${tabId}-region-\${region}">${region.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</label>
                      </div>
                    \`).join('')}
                  </div>
                </div>
              \` : ''}
              
              ${options.metrics ? \`
                <div class="filter-group">
                  <div class="filter-label">Metrics:</div>
                  <div class="filter-options" id="\${tabId}-metric-filters">
                    ${options.metrics.map(metric => \`
                      <div class="filter-option">
                        <input type="checkbox" id="\${tabId}-\${metric}" checked>
                        <label for="\${tabId}-\${metric}">${metric.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</label>
                      </div>
                    \`).join('')}
                  </div>
                </div>
              \` : ''}
              
              ${options.userTypes ? \`
                <div class="filter-group">
                  <div class="filter-label">User Types:</div>
                  <div class="filter-options" id="\${tabId}-user-type-filters">
                    ${options.userTypes.map(type => \`
                      <div class="filter-option">
                        <input type="checkbox" id="\${tabId}-user-\${type}" checked>
                        <label for="\${tabId}-user-\${type}">${type.charAt(0).toUpperCase() + type.slice(1)}</label>
                      </div>
                    \`).join('')}
                  </div>
                </div>
              \` : ''}
              
              ${options.errorTypes ? \`
                <div class="filter-group">
                  <div class="filter-label">Error Types:</div>
                  <div class="filter-options" id="\${tabId}-error-type-filters">
                    ${options.errorTypes.map(type => \`
                      <div class="filter-option">
                        <input type="checkbox" id="\${tabId}-error-\${type}" checked>
                        <label for="\${tabId}-error-\${type}">${type.charAt(0).toUpperCase() + type.slice(1)}</label>
                      </div>
                    \`).join('')}
                  </div>
                </div>
              \` : ''}
              
              ${options.severity ? \`
                <div class="filter-group">
                  <div class="filter-label">Severity:</div>
                  <div class="filter-options" id="\${tabId}-severity-filters">
                    ${options.severity.map(level => \`
                      <div class="filter-option">
                        <input type="checkbox" id="\${tabId}-severity-\${level}" checked>
                        <label for="\${tabId}-severity-\${level}">${level.charAt(0).toUpperCase() + level.slice(1)}</label>
                      </div>
                    \`).join('')}
                  </div>
                </div>
              \` : ''}
              
              ${options.components ? \`
                <div class="filter-group">
                  <div class="filter-label">Components:</div>
                  <div class="filter-options" id="\${tabId}-component-filters">
                    ${options.components.map(component => \`
                      <div class="filter-option">
                        <input type="checkbox" id="\${tabId}-component-\${component}" checked>
                        <label for="\${tabId}-component-\${component}">${component.charAt(0).toUpperCase() + component.slice(1)}</label>
                      </div>
                    \`).join('')}
                  </div>
                </div>
              \` : ''}
              
              ${options.features ? \`
                <div class="filter-group">
                  <div class="filter-label">Features:</div>
                  <div class="filter-options" id="\${tabId}-feature-filters">
                    ${options.features.map(feature => \`
                      <div class="filter-option">
                        <input type="checkbox" id="\${tabId}-feature-\${feature}" checked>
                        <label for="\${tabId}-feature-\${feature}">${feature.charAt(0).toUpperCase() + feature.slice(1)}</label>
                      </div>
                    \`).join('')}
                  </div>
                </div>
              \` : ''}
            </div>
            <div class="filter-actions">
              <button class="chart-button" onclick="applyFilters('\${tabId}')">Apply Filters</button>
              <button class="chart-button" onclick="resetFilters('\${tabId}')">Reset All</button>
              <button class="chart-button" onclick="savePreset('\${tabId}')">Save as Preset</button>
            </div>
          \`;
          
          tab.insertBefore(filterSection, tab.firstChild);
        }

        // Add chart legend with toggle functionality
        function addChartLegend(chartId, datasets) {
          const container = document.getElementById(chartId).parentElement;
          const legend = document.createElement('div');
          legend.className = 'chart-legend';
          legend.id = \`\${chartId}-legend\`;
          
          datasets.forEach((dataset, index) => {
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            legendItem.innerHTML = \`
              <div class="legend-color" style="background: \${dataset.borderColor}"></div>
              <span>\${dataset.label}</span>
            \`;
            legendItem.onclick = () => toggleDataset(chartId, index);
            legend.appendChild(legendItem);
          });
          
          container.appendChild(legend);
        }

        // Toggle dataset visibility
        function toggleDataset(chartId, index) {
          const chart = window[chartId.replace('-chart', 'Chart')];
          if (chart) {
            const meta = chart.getDatasetMeta(index);
            meta.hidden = !meta.hidden;
            chart.update();
            
            const legendItem = document.querySelector(\`#\${chartId}-legend .legend-item:nth-child(\${index + 1})\`);
            legendItem.classList.toggle('disabled');
          }
        }

        // Apply date range filter
        function applyDateRange(tabId) {
          const startDate = document.getElementById(\`\${tabId}-start-date\`).value;
          const endDate = document.getElementById(\`\${tabId}-end-date\`).value;
          
          if (!startDate || !endDate) {
            alert('Please select both start and end dates');
            return;
          }
          
          const start = moment(startDate);
          const end = moment(endDate);
          
          if (end.isBefore(start)) {
            alert('End date must be after start date');
            return;
          }
          
          // Update the appropriate chart based on the tab
          switch (tabId) {
            case 'historical':
              updateHistoricalData(start, end);
              break;
            case 'errors':
              updateErrorAnalysis(start, end);
              break;
            case 'user-behavior':
              updateUserBehavior(start, end);
              break;
            case 'system':
              updateSystemResources(start, end);
              break;
          }
        }

        // Update chart functions to use filters
        function updateHistoricalCharts(data) {
          // ... existing chart update code ...
          
          // Add legends with toggle functionality
          addChartLegend('engagement-trend-chart', engagementTrendChart.data.datasets);
          addChartLegend('performance-trend-chart', performanceTrendChart.data.datasets);
        }

        // Initialize interactive features
        document.addEventListener('DOMContentLoaded', function() {
          // Add date range pickers and filters to each tab
          ['historical', 'errors', 'user-behavior', 'system'].forEach(tabId => {
            addDateRangePicker(tabId);
            addFilterSection(tabId);
          });
          
          // Set default date range to last 30 days
          const today = new Date();
          const thirtyDaysAgo = new Date(today);
          thirtyDaysAgo.setDate(today.getDate() - 30);
          
          document.querySelectorAll('.date-input[type="date"]').forEach(input => {
            if (input.id.includes('end-date')) {
              input.value = today.toISOString().split('T')[0];
            } else {
              input.value = thirtyDaysAgo.toISOString().split('T')[0];
            }
          });
        });

        // Auto-refresh every 5 minutes
        setInterval(fetchData, 5 * 60 * 1000);

        // Add filter application functions
        function applyFilters(tabId) {
          const filters = {
            metrics: getCheckedValues(\`\${tabId}-metric-filters\`),
            userTypes: getCheckedValues(\`\${tabId}-user-type-filters\`),
            errorTypes: getCheckedValues(\`\${tabId}-error-type-filters\`),
            severity: getCheckedValues(\`\${tabId}-severity-filters\`),
            components: getCheckedValues(\`\${tabId}-component-filters\`),
            features: getCheckedValues(\`\${tabId}-feature-filters\`),
            timePeriods: getCheckedValues(\`\${tabId}-time-period-filters\`),
            regions: getCheckedValues(\`\${tabId}-region-filters\`)
          };

          // Get selected time period
          const timePeriodInput = document.querySelector(\`#\${tabId}-time-period-filters input:checked\`);
          if (timePeriodInput) {
            filters.selectedTimePeriod = timePeriodInput.value;
          }

          // Update the appropriate chart based on the tab
          switch (tabId) {
            case 'overview':
              updateOverviewCharts(filters);
              break;
            case 'historical':
              updateHistoricalCharts(filters);
              break;
            case 'errors':
              updateErrorCharts(filters);
              break;
            case 'user-behavior':
              updateUserBehaviorCharts(filters);
              break;
            case 'system':
              updateSystemResourceCharts(filters);
              break;
          }
        }

        function resetFilters(tabId) {
          const filterSection = document.querySelector(\`#\${tabId} .filter-section\`);
          filterSection.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = true;
          });
          applyFilters(tabId);
        }

        function getCheckedValues(containerId) {
          const container = document.getElementById(containerId);
          if (!container) return [];
          
          return Array.from(container.querySelectorAll('input[type="checkbox"]:checked'))
            .map(checkbox => checkbox.id.split('-').pop());
        }

        // Update chart functions to use filters
        function updateOverviewCharts(filters) {
          // Update error chart with filtered data
          if (errorChart) {
            const filteredData = filterErrorData(errorChart.data, filters);
            errorChart.data = filteredData;
            errorChart.update();
          }
          
          // Update feature chart with filtered data
          if (featureChart) {
            const filteredData = filterFeatureData(featureChart.data, filters);
            featureChart.data = filteredData;
            featureChart.update();
          }
        }

        function filterErrorData(chartData, filters) {
          const { errorTypes, severity } = filters;
          
          return {
            ...chartData,
            labels: chartData.labels.filter((_, index) => {
              const errorType = Object.keys(errorRates.errorTypes)[index];
              return errorTypes.includes(errorType);
            }),
            datasets: chartData.datasets.map(dataset => ({
              ...dataset,
              data: dataset.data.filter((_, index) => {
                const errorType = Object.keys(errorRates.errorTypes)[index];
                return errorTypes.includes(errorType);
              })
            }))
          };
        }

        function filterFeatureData(chartData, filters) {
          const { features } = filters;
          
          return {
            ...chartData,
            labels: chartData.labels.filter((_, index) => {
              const feature = Object.keys(featureUsage)[index];
              return features.includes(feature);
            }),
            datasets: chartData.datasets.map(dataset => ({
              ...dataset,
              data: dataset.data.filter((_, index) => {
                const feature = Object.keys(featureUsage)[index];
                return features.includes(feature);
              })
            }))
          };
        }

        // Add filter preset functions
        function applyPreset(tabId, presetId) {
          const preset = filterPresets[presetId];
          if (!preset) return;
          
          // Update checkboxes based on preset
          Object.entries(preset).forEach(([filterType, values]) => {
            const container = document.getElementById(\`\${tabId}-\${filterType}-filters\`);
            if (container) {
              container.querySelectorAll('input').forEach(input => {
                if (input.type === 'checkbox') {
                  input.checked = values.includes(input.id.split('-').pop());
                } else if (input.type === 'radio') {
                  input.checked = values.includes(input.value);
                }
              });
            }
          });
          
          // Apply the filters
          applyFilters(tabId);
          
          // Update preset button styles
          document.querySelectorAll(\`.preset-button[onclick*="\${presetId}"]\`).forEach(button => {
            button.classList.add('active');
          });
        }

        function savePreset(tabId) {
          const name = prompt('Enter a name for this preset:');
          if (!name) return;
          
          const presetId = name.toLowerCase().replace(/\s+/g, '-');
          const filters = {
            metrics: getCheckedValues(\`\${tabId}-metric-filters\`),
            userTypes: getCheckedValues(\`\${tabId}-user-type-filters\`),
            errorTypes: getCheckedValues(\`\${tabId}-error-type-filters\`),
            severity: getCheckedValues(\`\${tabId}-severity-filters\`),
            components: getCheckedValues(\`\${tabId}-component-filters\`),
            features: getCheckedValues(\`\${tabId}-feature-filters\`),
            timePeriods: getCheckedValues(\`\${tabId}-time-period-filters\`),
            regions: getCheckedValues(\`\${tabId}-region-filters\`)
          };
          
          // Remove empty arrays
          Object.keys(filters).forEach(key => {
            if (filters[key].length === 0) {
              delete filters[key];
            }
          });
          
          filterPresets[presetId] = filters;
          
          // Update the presets section
          const presetsContainer = document.querySelector(\`#\${tabId} .filter-presets .filter-options\`);
          const newPresetButton = document.createElement('button');
          newPresetButton.className = 'preset-button';
          newPresetButton.onclick = () => applyPreset(tabId, presetId);
          newPresetButton.textContent = name.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
          presetsContainer.appendChild(newPresetButton);
        }
      </script>
    </body>
    </html>
  `);
});

module.exports = router; 