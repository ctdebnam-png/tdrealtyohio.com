# Mortgage Rate Update Template

This template is used by `scripts/content_generator.py` to generate mortgage rate posts.

## Variables

- `{rate_30yr}` - Current 30-year fixed rate
- `{rate_direction}` - "Rising", "Falling", or "Steady"
- `{wow_change}` - Week-over-week change

## Structure

1. Headline reflecting rate direction
2. Current rates summary
3. Buying power analysis with concrete examples
4. "Should You Wait or Buy Now?" section
5. TD Realty Ohio perspective (not a lender disclaimer)

## Data Sources

- Freddie Mac Primary Mortgage Market Survey: https://www.freddiemac.com/pmms
- FRED (Federal Reserve Economic Data): https://fred.stlouisfed.org/series/MORTGAGE30US

## SEO Requirements

- Title includes rate direction
- Meta description: 150-160 chars
- Internal link to /buyers/ or /contact/
- Minimum 600 words
- Clear "not a lender" disclaimer
