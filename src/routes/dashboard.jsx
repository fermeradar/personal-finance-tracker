const express = require('express');
const router = express.Router();

router.get('/dashboard', (req, res) => {
  const dashboardTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Dashboard</title>
    </head>
    <body>
      <div id="dashboard-container"></div>
      <script>
        function addFilterSection(tabId) {
          const filterSection = document.createElement('div');
          filterSection.className = 'filter-section';
          filterSection.innerHTML = \`
            <div class="filter-groups">
              \${options.metrics ? \`
                <div class="filter-group">
                  <div class="filter-label">Metrics:</div>
                  <div class="filter-options" id="\${tabId}-metric-filters">
                    \${options.metrics.map(metric => \`
                      <div class="filter-option">
                        <input type="checkbox" id="\${tabId}-metric-\${metric}" checked>
                        <label for="\${tabId}-metric-\${metric}">\${metric}</label>
                      </div>
                    \`).join('')}
                  </div>
                </div>
              \` : ''}
            </div>
          \`;
          
          tab.insertBefore(filterSection, tab.firstChild);
        }

        // Initialize dashboard
        document.addEventListener('DOMContentLoaded', () => {
          // Add initialization code here
        });
      </script>
    </body>
    </html>
  `;

  res.send(dashboardTemplate);
});

module.exports = router; 