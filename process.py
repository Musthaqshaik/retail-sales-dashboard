import pandas as pd
import numpy as np
import json

df = pd.read_csv('data/superstore_raw.csv', encoding='latin1')

# Clean column names
df.columns = [c.strip() for c in df.columns]

# Parse dates
df['Order Date'] = pd.to_datetime(df['Order Date'], errors='coerce')
df['Ship Date'] = pd.to_datetime(df['Ship Date'], errors='coerce')

# Drop bad rows
df = df.dropna(subset=['Order Date', 'Sales', 'Customer ID'])

# Fix obviously corrupt rows where Order Date is absurd (>2017 or <2009)
df = df[(df['Order Date'].dt.year >= 2009) & (df['Order Date'].dt.year <= 2017)]

# Numeric cleanup
for col in ['Sales', 'Profit', 'Order Quantity', 'Discount', 'Shipping Cost', 'Unit Price']:
    df[col] = pd.to_numeric(df[col], errors='coerce')
df = df.dropna(subset=['Sales', 'Profit'])

df['Year'] = df['Order Date'].dt.year
df['Month'] = df['Order Date'].dt.to_period('M').astype(str)
df['Order Quantity'] = df['Order Quantity'].fillna(1)

print(f"Rows after cleaning: {len(df)}")
print(f"Date range: {df['Order Date'].min()} to {df['Order Date'].max()}")
print(f"Unique customers: {df['Customer ID'].nunique()}")
print(f"Total sales: {df['Sales'].sum():,.0f}")
print(f"Total profit: {df['Profit'].sum():,.0f}")

# ---------- RFM Segmentation ----------
snapshot_date = df['Order Date'].max() + pd.Timedelta(days=1)

rfm = df.groupby('Customer ID').agg(
    Recency=('Order Date', lambda x: (snapshot_date - x.max()).days),
    Frequency=('Order ID', 'nunique'),
    Monetary=('Sales', 'sum'),
    CustomerName=('Customer Name', 'first'),
    Segment=('Customer Segment', 'first')
).reset_index()

# Score 1-4 (quartiles), Recency reversed (lower=better=higher score)
rfm['R_Score'] = pd.qcut(rfm['Recency'], 4, labels=[4,3,2,1]).astype(int)
rfm['F_Score'] = pd.qcut(rfm['Frequency'].rank(method='first'), 4, labels=[1,2,3,4]).astype(int)
rfm['M_Score'] = pd.qcut(rfm['Monetary'], 4, labels=[1,2,3,4]).astype(int)
rfm['RFM_Score'] = rfm['R_Score'] + rfm['F_Score'] + rfm['M_Score']

def segment_customer(row):
    r, f, m = row['R_Score'], row['F_Score'], row['M_Score']
    if r >= 4 and f >= 4 and m >= 4:
        return 'Champions'
    elif r >= 3 and f >= 3:
        return 'Loyal Customers'
    elif r >= 4 and f <= 2:
        return 'New / Promising'
    elif r <= 2 and f >= 3:
        return 'At Risk'
    elif r <= 2 and f <= 2 and m <= 2:
        return 'Hibernating'
    else:
        return 'Need Attention'

rfm['Customer_Segment'] = rfm.apply(segment_customer, axis=1)

segment_summary = rfm.groupby('Customer_Segment').agg(
    Customers=('Customer ID', 'count'),
    AvgMonetary=('Monetary', 'mean'),
    TotalMonetary=('Monetary', 'sum')
).reset_index().sort_values('TotalMonetary', ascending=False)

print("\n--- RFM Segments ---")
print(segment_summary)

# ---------- Aggregates for dashboard ----------
monthly = df.groupby('Month').agg(Sales=('Sales','sum'), Profit=('Profit','sum'), Orders=('Order ID','nunique')).reset_index().sort_values('Month')

by_category = df.groupby('Category').agg(Sales=('Sales','sum'), Profit=('Profit','sum')).reset_index().sort_values('Sales', ascending=False)

by_region = df.groupby('Region').agg(Sales=('Sales','sum'), Profit=('Profit','sum'), Orders=('Order ID','nunique')).reset_index().sort_values('Sales', ascending=False)

by_segment_biz = df.groupby('Customer Segment').agg(Sales=('Sales','sum'), Profit=('Profit','sum')).reset_index().sort_values('Sales', ascending=False)

# Discount vs profit relationship (key insight)
df['DiscountBand'] = pd.cut(df['Discount'], bins=[-0.01,0,0.1,0.2,0.3,1], labels=['0%','1-10%','11-20%','21-30%','30%+'])
discount_profit = df.groupby('DiscountBand', observed=True).agg(AvgProfitMargin=('Profit','mean'), Sales=('Sales','sum'), Count=('Order ID','count')).reset_index()
discount_profit['DiscountBand'] = discount_profit['DiscountBand'].astype(str)

top_subcats = df.groupby(['Category']).apply(lambda x: x.groupby('Department' if 'Department' in df.columns else 'Category')['Profit'].sum()).reset_index() if False else None

# Top products by profit and biggest losers
prod_col = 'Item' if 'Item' in df.columns else 'Product Name'
top_products = df.groupby(prod_col).agg(Sales=('Sales','sum'), Profit=('Profit','sum'), Orders=('Order ID','nunique')).reset_index()
top_profit = top_products.sort_values('Profit', ascending=False).head(10)
worst_profit = top_products.sort_values('Profit', ascending=True).head(10)

output = {
    'kpis': {
        'total_sales': float(df['Sales'].sum()),
        'total_profit': float(df['Profit'].sum()),
        'total_orders': int(df['Order ID'].nunique()),
        'total_customers': int(df['Customer ID'].nunique()),
        'avg_order_value': float(df['Sales'].sum() / df['Order ID'].nunique()),
        'profit_margin': float(df['Profit'].sum() / df['Sales'].sum() * 100)
    },
    'monthly': monthly.to_dict('records'),
    'by_category': by_category.to_dict('records'),
    'by_region': by_region.to_dict('records'),
    'by_segment_biz': by_segment_biz.to_dict('records'),
    'discount_profit': discount_profit.to_dict('records'),
    'rfm_segments': segment_summary.to_dict('records'),
    'top_profit_products': top_profit[[prod_col,'Sales','Profit','Orders']].rename(columns={prod_col:'Product'}).to_dict('records'),
    'worst_profit_products': worst_profit[[prod_col,'Sales','Profit','Orders']].rename(columns={prod_col:'Product'}).to_dict('records'),
    'customer_table': rfm.sort_values('Monetary', ascending=False).head(200)[['CustomerName','Segment','Customer_Segment','Recency','Frequency','Monetary']].to_dict('records')
}

with open('dashboard_data.json', 'w') as f:
    json.dump(output, f, default=str)

print("\nSaved dashboard_data.json")
print(f"Discount/Profit relationship:\n{discount_profit}")
