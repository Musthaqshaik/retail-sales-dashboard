const COLORS = ['#2563eb','#f59e0b','#10b981','#ef4444','#8b5cf6','#06b6d4'];
const SEGMENT_ORDER = ['Champions','Loyal Customers','At Risk','Need Attention','New / Promising','Hibernating'];
const SEGMENT_CLASS = {
  'Champions':'Champions','Loyal Customers':'Loyal','At Risk':'AtRisk',
  'Need Attention':'NeedAttention','New / Promising':'New','Hibernating':'Hibernating'
};

function fmt(value, type='number') {
  if (value === undefined || value === null || isNaN(value)) return '-';
  switch (type) {
    case 'currency':
      if (Math.abs(value) >= 1e6) return '$' + (value/1e6).toFixed(2) + 'M';
      if (Math.abs(value) >= 1e3) return '$' + (value/1e3).toFixed(1) + 'K';
      return '$' + value.toFixed(0);
    case 'percent':
      return value.toFixed(1) + '%';
    case 'number':
      if (Math.abs(value) >= 1e6) return (value/1e6).toFixed(1) + 'M';
      if (Math.abs(value) >= 1e3) return (value/1e3).toFixed(1) + 'K';
      return Math.round(value).toLocaleString();
    default: return value;
  }
}

class Dashboard {
  constructor(data) {
    this.data = data;
    this.activeSegment = null;
    this.charts = {};
    this.init();
  }

  init() {
    this.setupFilters();
    this.renderAll();
  }

  setupFilters() {
    const regions = [...new Set(this.data.by_region.map(r => r.Region))].sort();
    const cats = [...new Set(this.data.by_category.map(r => r.Category))].sort();
    const years = [...new Set(this.data.monthly.map(r => r.Month.slice(0,4)))].sort();
    this.fillSelect('filter-region', regions);
    this.fillSelect('filter-category', cats);
    this.fillSelect('filter-year', years);
  }

  fillSelect(id, values) {
    const sel = document.getElementById(id);
    values.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = v;
      sel.appendChild(opt);
    });
  }

  getFilters() {
    return {
      region: document.getElementById('filter-region').value,
      category: document.getElementById('filter-category').value,
      year: document.getElementById('filter-year').value
    };
  }

  // Note: underlying aggregates are pre-computed server-side per dimension.
  // For a lightweight client demo we filter at the aggregate level where the
  // dimension matches; full cross-filtering would require row-level data.
  applyFilters() {
    this.renderAll();
  }

  resetFilters() {
    document.getElementById('filter-region').value = 'all';
    document.getElementById('filter-category').value = 'all';
    document.getElementById('filter-year').value = 'all';
    this.activeSegment = null;
    this.renderAll();
  }

  renderAll() {
    const f = this.getFilters();
    this.renderKPIs(f);
    this.renderTrend(f);
    this.renderDiscount();
    this.renderCategory(f);
    this.renderRegion(f);
    this.renderBizSegment();
    this.renderRFM();
    this.renderProducts();
    this.renderCustomerTable();
  }

  renderKPIs(f) {
    let sales = this.data.kpis.total_sales;
    let profit = this.data.kpis.total_profit;
    let orders = this.data.kpis.total_orders;
    let customers = this.data.kpis.total_customers;

    // Scale KPIs proportionally when a category/region filter narrows scope (approximation for demo)
    if (f.category !== 'all') {
      const row = this.data.by_category.find(r => r.Category === f.category);
      if (row) { sales = row.Sales; profit = row.Profit; }
    }
    if (f.region !== 'all') {
      const row = this.data.by_region.find(r => r.Region === f.region);
      if (row) { sales = row.Sales; profit = row.Profit; orders = row.Orders; }
    }

    document.getElementById('kpi-sales').textContent = fmt(sales, 'currency');
    document.getElementById('kpi-profit').textContent = fmt(profit, 'currency');
    document.getElementById('kpi-margin').textContent = fmt(profit/sales*100, 'percent');
    document.getElementById('kpi-orders').textContent = fmt(orders, 'number');
    document.getElementById('kpi-aov').textContent = fmt(sales/orders, 'currency');
    document.getElementById('kpi-customers').textContent = fmt(customers, 'number');
  }

  renderTrend(f) {
    let rows = this.data.monthly;
    if (f.year !== 'all') rows = rows.filter(r => r.Month.startsWith(f.year));
    this.upsertChart('chart-trend', 'line', {
      labels: rows.map(r => r.Month),
      datasets: [
        { label: 'Sales', data: rows.map(r => r.Sales), borderColor: COLORS[0], backgroundColor: COLORS[0]+'20', borderWidth:2, tension:0.3, fill:true, yAxisID:'y' },
        { label: 'Profit', data: rows.map(r => r.Profit), borderColor: COLORS[2], backgroundColor: COLORS[2]+'20', borderWidth:2, tension:0.3, fill:true, yAxisID:'y' }
      ]
    }, {
      scales: { y: { beginAtZero:true, ticks:{ callback:v=>fmt(v,'currency') } } },
      plugins: { tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fmt(c.parsed.y,'currency')}` } } }
    });
  }

  renderDiscount() {
    const rows = this.data.discount_profit;
    this.upsertChart('chart-discount', 'bar', {
      labels: rows.map(r => r.DiscountBand),
      datasets: [{ label:'Avg Profit / Order', data: rows.map(r => r.AvgProfitMargin),
        backgroundColor: rows.map(r => r.AvgProfitMargin >= 0 ? '#10b981CC' : '#ef4444CC') }]
    }, {
      plugins: { legend:{display:false}, tooltip:{ callbacks:{ label: c => fmt(c.parsed.y,'currency') } } },
      scales: { y: { ticks:{ callback:v=>fmt(v,'currency') } } }
    });
  }

  renderCategory(f) {
    let rows = this.data.by_category;
    this.upsertChart('chart-category', 'bar', {
      labels: rows.map(r=>r.Category),
      datasets: [{ label:'Sales', data: rows.map(r=>r.Sales), backgroundColor: COLORS.map(c=>c+'CC') }]
    }, {
      indexAxis:'y',
      plugins: { legend:{display:false}, tooltip:{ callbacks:{ label:c=>fmt(c.parsed.x,'currency') } } },
      scales: { x: { ticks:{ callback:v=>fmt(v,'currency') } } }
    });
  }

  renderRegion(f) {
    let rows = this.data.by_region;
    this.upsertChart('chart-region', 'doughnut', {
      labels: rows.map(r=>r.Region),
      datasets: [{ data: rows.map(r=>r.Sales), backgroundColor: COLORS.map(c=>c+'CC'), borderColor:'#fff', borderWidth:2 }]
    }, {
      plugins: { legend:{ position:'bottom', labels:{usePointStyle:true,padding:12,font:{size:11}} },
        tooltip:{ callbacks:{ label: c => { const t=c.dataset.data.reduce((a,b)=>a+b,0); return `${c.label}: ${fmt(c.parsed,'currency')} (${(c.parsed/t*100).toFixed(1)}%)`; } } } }
    });
  }

  renderBizSegment() {
    const rows = this.data.by_segment_biz;
    this.upsertChart('chart-bizsegment', 'doughnut', {
      labels: rows.map(r=>r['Customer Segment']),
      datasets: [{ data: rows.map(r=>r.Sales), backgroundColor: COLORS.map(c=>c+'CC'), borderColor:'#fff', borderWidth:2 }]
    }, {
      plugins: { legend:{ position:'bottom', labels:{usePointStyle:true,padding:12,font:{size:11}} },
        tooltip:{ callbacks:{ label: c => fmt(c.parsed,'currency') } } }
    });
  }

  renderRFM() {
    const rows = this.data.rfm_segments;
    const ordered = SEGMENT_ORDER.map(name => rows.find(r => r.Customer_Segment === name)).filter(Boolean);
    this.upsertChart('chart-rfm', 'bar', {
      labels: ordered.map(r=>r.Customer_Segment),
      datasets: [{ label:'Customers', data: ordered.map(r=>r.Customers), backgroundColor: COLORS.map(c=>c+'CC') }]
    }, {
      plugins: { legend:{display:false} },
      onClick: (evt, elements) => {
        if (elements.length) {
          const idx = elements[0].index;
          this.activeSegment = ordered[idx].Customer_Segment === this.activeSegment ? null : ordered[idx].Customer_Segment;
          this.renderRFM(); this.renderCustomerTable();
        }
      }
    });

    const grid = document.getElementById('segment-grid');
    grid.innerHTML = '';
    ordered.forEach(r => {
      const pill = document.createElement('div');
      pill.className = 'segment-pill' + (this.activeSegment === r.Customer_Segment ? ' active' : '');
      pill.innerHTML = `<div class="seg-name">${r.Customer_Segment}</div><div class="seg-count">${r.Customers}</div><div style="font-size:11px;color:var(--text-secondary)">${fmt(r.TotalMonetary,'currency')}</div>`;
      pill.onclick = () => { this.activeSegment = this.activeSegment === r.Customer_Segment ? null : r.Customer_Segment; this.renderRFM(); this.renderCustomerTable(); };
      grid.appendChild(pill);
    });
  }

  renderProducts() {
    const top = this.data.top_profit_products;
    const worst = this.data.worst_profit_products;
    this.upsertChart('chart-topprofit', 'bar', {
      labels: top.map(r => r.Product.length > 28 ? r.Product.slice(0,26)+'…' : r.Product),
      datasets: [{ label:'Profit', data: top.map(r=>r.Profit), backgroundColor: '#10b981CC' }]
    }, { indexAxis:'y', plugins:{legend:{display:false}, tooltip:{callbacks:{label:c=>fmt(c.parsed.x,'currency')}}}, scales:{x:{ticks:{callback:v=>fmt(v,'currency')}}} });

    this.upsertChart('chart-worstprofit', 'bar', {
      labels: worst.map(r => r.Product.length > 28 ? r.Product.slice(0,26)+'…' : r.Product),
      datasets: [{ label:'Profit', data: worst.map(r=>r.Profit), backgroundColor: '#ef4444CC' }]
    }, { indexAxis:'y', plugins:{legend:{display:false}, tooltip:{callbacks:{label:c=>fmt(c.parsed.x,'currency')}}}, scales:{x:{ticks:{callback:v=>fmt(v,'currency')}}} });
  }

  renderCustomerTable() {
    let rows = this.data.customer_table;
    const label = document.getElementById('segment-filter-label');
    if (this.activeSegment) {
      rows = rows.filter(r => r.Customer_Segment === this.activeSegment);
      label.textContent = `— filtered: ${this.activeSegment} (${rows.length})`;
    } else {
      label.textContent = '';
    }

    const columns = [
      { field:'CustomerName', label:'Customer' },
      { field:'Segment', label:'Business Segment' },
      { field:'Customer_Segment', label:'RFM Segment' },
      { field:'Recency', label:'Recency (days)' },
      { field:'Frequency', label:'Orders' },
      { field:'Monetary', label:'Lifetime Sales' }
    ];

    let sortCol = 'Monetary', sortDir = 'desc';

    const renderRows = (sorted) => {
      let html = '<table class="data-table"><thead><tr>';
      columns.forEach(col => {
        const arrow = sortCol === col.field ? (sortDir==='asc' ? ' ▲' : ' ▼') : '';
        html += `<th data-field="${col.field}">${col.label}${arrow}</th>`;
      });
      html += '</tr></thead><tbody>';
      sorted.slice(0,100).forEach(row => {
        const segClass = SEGMENT_CLASS[row.Customer_Segment] || '';
        html += '<tr>';
        html += `<td>${row.CustomerName}</td>`;
        html += `<td>${row.Segment}</td>`;
        html += `<td><span class="badge ${segClass}">${row.Customer_Segment}</span></td>`;
        html += `<td>${row.Recency}</td>`;
        html += `<td>${row.Frequency}</td>`;
        html += `<td>${fmt(row.Monetary,'currency')}</td>`;
        html += '</tr>';
      });
      html += '</tbody></table>';
      const container = document.getElementById('customer-table');
      container.innerHTML = html;
      container.querySelectorAll('th').forEach(th => {
        th.style.cursor = 'pointer';
        th.onclick = () => {
          const field = th.dataset.field;
          if (sortCol === field) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
          else { sortCol = field; sortDir = 'desc'; }
          const s = [...rows].sort((a,b) => {
            const av = a[field], bv = b[field];
            const cmp = av < bv ? -1 : av > bv ? 1 : 0;
            return sortDir === 'asc' ? cmp : -cmp;
          });
          renderRows(s);
        };
      });
    };

    renderRows(rows);
  }

  upsertChart(canvasId, type, data, extraOptions = {}) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (this.charts[canvasId]) this.charts[canvasId].destroy();
    const baseOptions = { responsive:true, maintainAspectRatio:false, animation:{duration:400},
      plugins:{ legend:{ labels:{usePointStyle:true} } } };
    this.charts[canvasId] = new Chart(ctx, { type, data, options: Object.assign({}, baseOptions, extraOptions) });
  }
}

const dash = new Dashboard(DATA);
