# Recreating this dashboard in Power BI / Tableau

The cleaned data (`dashboard_data.json`, or re-run `process.py` on `data/superstore_raw.csv`) gives you everything needed to rebuild this natively. Below are the exact steps and chart specs.

## 1. Load the data

**Power BI:**
- Home → Get Data → Text/CSV → select `data/superstore_raw.csv`
- In Power Query Editor: set `Order Date`/`Ship Date` to Date type, remove rows where Order Date is null or outside 2009–2017 (a few corrupted rows exist in the raw file)

**Tableau:**
- Connect → Text File → select `data/superstore_raw.csv`
- Right-click `Order Date` → Change Data Type → Date
- Add a filter: Order Date year between 2009–2017

## 2. Build the RFM segmentation

This is the one piece that needs calculated fields since RFM scoring isn't built-in.

**Power BI (DAX measures):**
```
Snapshot Date = MAX('Superstore'[Order Date]) + 1

Recency = DATEDIFF(MAX('Superstore'[Order Date]), [Snapshot Date], DAY)
Frequency = DISTINCTCOUNT('Superstore'[Order ID])
Monetary = SUM('Superstore'[Sales])
```
Then create a new table grouped by Customer ID with these three measures, and use `RANKX` with quartile bucketing (or Power BI's built-in "Bin" grouping on each measure) to assign R/F/M scores 1–4. Sum the three scores and bucket into the six named segments using a calculated column with nested `SWITCH`/`IF`.

**Tableau:**
- Create a calculated field per customer: `{FIXED [Customer ID] : DATEDIFF('day', MAX([Order Date]), TODAY())}` for Recency, similarly for Frequency (`COUNTD([Order ID])`) and Monetary (`SUM([Sales])`)
- Use **Tableau's quick table calc → Rank** on each, or manually bucket with `IF`/`ELSEIF` into quartiles
- Combine into a segment field with nested `IF` logic matching the 6 segments

*(Tip: since this logic is identical across tools, the fastest path is to run `process.py` once, which outputs a `customer_table` with RFM scores already computed — import that as a second data source and join on Customer ID instead of recalculating.)*

## 3. Chart specs

| Chart | Type | Fields |
|---|---|---|
| Monthly Sales & Profit Trend | Dual-axis line | X: Order Date (month), Y: SUM(Sales), SUM(Profit) |
| Discount Band vs. Profit | Bar | X: Discount Band (binned: 0%, 1-10%, 11-20%, 21-30%, 30%+), Y: AVG(Profit) |
| Sales by Category | Horizontal bar | X: SUM(Sales), Y: Category, sorted descending |
| Sales by Region | Donut/Pie | Sales by Region |
| Sales by Business Segment | Donut/Pie | Sales by Customer Segment |
| RFM Segment Distribution | Bar | Customer count by RFM Segment |
| Top/Bottom 10 Products by Profit | Horizontal bar, sorted | SUM(Profit) by Product, top 10 and bottom 10 |
| Customer Detail Table | Table | Customer Name, Segment, RFM Segment, Recency, Frequency, Monetary — sorted by Monetary descending |

## 4. Filters / interactivity

- Add Region, Category, and Year as **slicers** (Power BI) or **filters on all sheets** (Tableau)
- Set the RFM Segment bar chart as a filter source — clicking a bar should cross-filter the customer table (Power BI: this works automatically via the data model relationship; Tableau: use "Use as Filter" on the sheet)

## 5. Publish

- **Tableau**: Server menu → Publish to Tableau Public → this gives you a shareable, embeddable live link
- **Power BI**: Publish to Power BI Service, then File → Publish to Web (note: only use Publish to Web for non-sensitive/public data, which this dataset is)

Once published, replace the dashboard.html link in the README with your live Tableau Public / Power BI embed link — that's what makes the GitHub repo feel like a real, finished case study rather than a code dump.
