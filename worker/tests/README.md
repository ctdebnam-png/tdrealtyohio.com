## Outcome Capture v1 - Tests

### Overview

This directory contains verification tests for the Outcome Capture v1 system. Tests are written using Vitest and should be run with Miniflare to simulate the Cloudflare Workers + D1 environment.

### Test Categories

1. **outcomes.test.ts** - Outcome recording and attribution
2. **validation.test.ts** - Sequence and data validation
3. **aggregation.test.ts** - Win rate calculations
4. **tenant-isolation.test.ts** - Security and tenant isolation

### Running Tests

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npx vitest run tests/outcomes.test.ts
```

### Setting Up Test Environment

Tests require a D1 test database. Use Miniflare for local testing:

```typescript
import { Miniflare } from 'miniflare';
import { readFileSync } from 'fs';

let mf: Miniflare;
let env: Env;

beforeAll(async () => {
  mf = new Miniflare({
    modules: true,
    script: readFileSync('./src/index.ts', 'utf-8'),
    d1Databases: ['DB'],
    kvNamespaces: ['AUTH'],
  });

  env = await mf.getBindings();

  // Run migrations
  await env.DB.exec(readFileSync('./schema/001_initial.sql', 'utf-8'));
  await env.DB.exec(readFileSync('./schema/002_indices.sql', 'utf-8'));

  // Seed test data
  await env.DB.exec(readFileSync('./schema/seed_test_data.sql', 'utf-8'));
});

afterAll(async () => {
  await mf.dispose();
});
```

### Test Data

Tests use seeded data from `schema/seed_test_data.sql`:
- Default tenant: `tenant_default` (slug: `td-realty`)
- 10 test leads with varied attributes
- 12 test outcomes covering different stages

### Critical Tests (Must Pass)

#### Outcome Attribution
- ✅ Outcome insertion writes attribution snapshot
- ✅ Attribution preserved even if lead changes
- ✅ Metadata contains source_key, geo_key, intent_type, etc.

#### Sequence Validation
- ✅ Block closed_won after closed_lost
- ✅ Block closed_lost after closed_won
- ✅ Allow override with override_validation flag
- ✅ Warn on appointment before contacted

#### Aggregation
- ✅ Weekly aggregation idempotent
- ✅ Win rate calculated correctly
- ✅ Zero denominator handled (null win_rate)
- ✅ Distinct leads counted only once

#### Tenant Isolation
- ✅ Cannot query cross-tenant leads
- ✅ Cannot record outcomes on cross-tenant leads
- ✅ Aggregates tenant-scoped
- ✅ API endpoints enforce tenant context

### Adding New Tests

When adding new features:

1. Create test file in `tests/` directory
2. Follow existing naming convention: `feature.test.ts`
3. Use descriptive test names
4. Include both positive and negative cases
5. Test edge cases (empty data, nulls, large datasets)

### Mock vs Real Database

Current tests use placeholders (`expect(true).toBe(true)`). To implement real tests:

1. Install Miniflare: `npm install -D miniflare`
2. Set up D1 mock in test setup
3. Replace placeholders with actual API calls
4. Query database to verify state changes

### CI/CD Integration

Tests should run on every commit:

```yaml
# .github/workflows/test.yml
name: Test
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
```

### Test Coverage

Target: 80%+ coverage on business logic

```bash
# Run with coverage
npx vitest run --coverage
```

### Debugging Tests

```bash
# Run with debug output
DEBUG=* npm test

# Run single test with console.log
npx vitest run tests/outcomes.test.ts --reporter=verbose
```

### Performance Tests

For large dataset testing:

```bash
# Create 10,000 test leads
node scripts/generate-test-data.js --leads 10000

# Run aggregation performance test
npx vitest run tests/aggregation.test.ts --testNamePattern="performance"
```

### Security Tests

**CRITICAL:** Tenant isolation tests MUST pass before production deployment. These verify:
- No cross-tenant data access
- SQL injection prevention
- Proper WHERE clause usage
- API authentication enforcement

Run security tests separately:

```bash
npx vitest run tests/tenant-isolation.test.ts
```

All tests must pass before merging to main branch.
