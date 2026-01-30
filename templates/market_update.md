# Market Update Template

This template is used by `scripts/content_generator.py` to generate market update blog posts.

## Variables

- `{community_name}` - Display name of the community (e.g., "Westerville")
- `{month}` / `{year}` - Publication month and year
- `{median_price}` - Current median sale price
- `{prev_median_price}` - Previous period median sale price
- `{price_change_pct}` - Percentage change in median price
- `{homes_sold}` / `{prev_homes_sold}` - Homes sold current vs previous
- `{dom}` / `{prev_dom}` - Days on market current vs previous
- `{inventory}` / `{prev_inventory}` - Active inventory current vs previous

## Structure

1. Introduction paragraph with market overview
2. Data table: current vs previous period metrics
3. Buyer analysis section
4. Seller analysis section
5. CTA paragraph for TD Realty Ohio
6. Sources attribution

## Data Sources

- Redfin Data Center: https://www.redfin.com/news/data-center/
- Columbus REALTORS Market Statistics: https://www.columbusrealtors.com/news/market-statistics/

## SEO Requirements

- Title: 50-60 chars, includes community name
- Meta description: 150-160 chars
- One H1 matching title
- H2s for major sections
- At least one internal link to tdrealtyohio.com
- At least one external source link
- Minimum 600 words
