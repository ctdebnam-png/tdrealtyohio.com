// Outcome Capture v1 - Admin UI JavaScript

// Helper: API request with auth
async function apiRequest(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getAuthToken()}`,
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

// Get auth token from localStorage or cookie
function getAuthToken() {
  return localStorage.getItem('auth_token') || 'admin_key_placeholder';
}

// Get tenant slug from URL
function getTenantSlug() {
  const match = window.location.pathname.match(/\/t\/([^/]+)\//);
  return match ? match[1] : 'td-realty';
}

// Format date/time
function formatDateTime(isoString) {
  if (!isoString) return 'N/A';
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Format date only
function formatDate(isoString) {
  if (!isoString) return 'N/A';
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Format percentage
function formatPercent(value) {
  if (value === null || value === undefined) return 'N/A';
  return `${(value * 100).toFixed(1)}%`;
}

// Show success message
function showSuccess(message) {
  const alert = document.createElement('div');
  alert.className = 'alert alert-success';
  alert.textContent = message;
  document.querySelector('.container').prepend(alert);
  setTimeout(() => alert.remove(), 5000);
}

// Show error message
function showError(message) {
  const alert = document.createElement('div');
  alert.className = 'alert alert-error';
  alert.textContent = message;
  document.querySelector('.container').prepend(alert);
  setTimeout(() => alert.remove(), 5000);
}

// Show warning message
function showWarning(message) {
  const alert = document.createElement('div');
  alert.className = 'alert alert-warning';
  alert.textContent = message;
  document.querySelector('.container').prepend(alert);
  setTimeout(() => alert.remove(), 5000);
}

// Export to CSV
function exportTableToCSV(tableId, filename) {
  const table = document.getElementById(tableId);
  const rows = table.querySelectorAll('tr');
  const csv = [];

  rows.forEach(row => {
    const cols = row.querySelectorAll('td, th');
    const rowData = Array.from(cols).map(col => {
      let text = col.textContent.trim();
      // Escape commas and quotes
      if (text.includes(',') || text.includes('"')) {
        text = `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    });
    csv.push(rowData.join(','));
  });

  const csvContent = csv.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
