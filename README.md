# Retail Sales & Customer Segmentation Dashboard

An interactive dashboard analyzing 4 years of US Superstore retail data (2013–2016) — built to go beyond basic "sales by region" reporting into actionable business levers: discount-driven profit erosion and RFM customer segmentation.

**[➡️ Open the live interactive dashboard](dashboard.html)** *(download the repo and open `dashboard.html` in any browser — no install needed)*

> 📸 **Before publishing:** open `dashboard.html` locally, take a screenshot (or record a short GIF clicking through the filters), and drop it in `images/preview.png`. Then add `![Dashboard preview](images/preview.png)` right here at the top of the README — this single image is what makes people actually click into the repo.

## The business question

A retail chain wants to know: which customers and which discounting behaviors are actually driving profit, not just sales volume?

## Key insights

1. **Discounting past 10% destroys profit.** Orders with 0–10% discount average **+$135 profit**; orders discounted above 10% flip to a **net loss** per order. This is a clear, actionable threshold for a pricing/promotions team.
2. **A small "Champions" segment punches way above its weight.** Just 166 customers (6% of the customer base) generate **$2.6M** in lifetime sales — almost as much as the 779-strong "Loyal Customers" segment.
3. **734 customers are "Hibernating"** (low recency, low frequency, low spend) — over a quarter of the customer base that's gone cold and is a clear re-engagement target.
4. **Office Machines, Chairs & Chairmats, and Telephones** are the top 3 revenue categories, but profit margins vary significantly between them — see the category chart for where margin is actually concentrated.

## What's in this dashboard

- **6 KPI cards**: Sales, Profit, Margin, Orders, AOV, Customers
- **Monthly sales/profit trend** with year filtering
- **Discount-band vs. profit chart** — the core insight, visualized as a "cliff"
- **Category, Region, and Business Segment breakdowns**
- **RFM customer segmentation** (Recency/Frequency/Monetary) — 6 behavioral segments, click any segment to filter the customer table below it
- **Top 10 most profitable & least profitable products**
- **Sortable, filterable customer detail table** (top 200 by lifetime value)

## Methodology

- **Data cleaning**: removed corrupted date rows, coerced numeric fields, handled encoding issues (`pandas`, Python)
- **RFM segmentation**: customers scored 1–4 on Recency, Frequency, and Monetary value using quartile binning, then mapped into 6 named segments (Champions, Loyal Customers, At Risk, Need Attention, New/Promising, Hibernating) — a standard CRM segmentation technique
- **Discount-band analysis**: orders bucketed into discount ranges (0%, 1–10%, 11–20%, 21–30%, 30%+) and average profit computed per bucket to isolate the margin cliff

## Tools used

- **Python** (pandas) for data cleaning, RFM scoring, and aggregation
- **HTML/CSS/JavaScript + Chart.js** for the interactive dashboard layer
- Designed to be reproduced natively in **Power BI** or **Tableau** — see `BUILD_IN_POWERBI_TABLEAU.md` for exact steps using the same cleaned data and chart specs

## Repo structure

```
retail-dashboard/
├── README.md
├── dashboard.html              ← open this to view the live dashboard
├── dashboard.js                ← dashboard logic (filters, charts, RFM interaction)
├── embedded_data.js            ← pre-aggregated data embedded for the dashboard
├── data/
│   └── superstore_raw.csv      ← raw source data
├── process.py                  ← cleaning + RFM segmentation script
├── dashboard_data.json         ← cleaned/aggregated output of process.py
└── BUILD_IN_POWERBI_TABLEAU.md ← steps to recreate this in Power BI / Tableau
```

*(Add an `images/` folder with a screenshot or GIF once you've taken one — see the note above.)*

## Data source

US Superstore sample dataset (publicly available retail transactions dataset commonly used for BI training), ~9,400 order line items across 2013–2016.
