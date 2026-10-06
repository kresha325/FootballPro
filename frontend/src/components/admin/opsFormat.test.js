import { describe, expect, it } from 'vitest';
import { canPermission, displayMetric, displayRevenue } from './opsFormat';

describe('admin display', () => {
  it('shows N/A when a metric was not measured', () => {
    expect(displayMetric(null)).toBe('N/A');
    expect(displayMetric(undefined)).toBe('N/A');
    expect(displayMetric(0)).toBe('0');
    expect(displayRevenue(null)).toBe('N/A');
    expect(displayRevenue([])).toBe('0');
    expect(displayRevenue([{ amount: 12, currency: 'EUR' }])).toBe('12 EUR');
  });

  it('mirrors backend permission inheritance for navigation only', () => {
    expect(canPermission(['*'], 'finance.adjust')).toBe(true);
    expect(canPermission(['marketplace.manage'], 'marketplace.read')).toBe(true);
    expect(canPermission(['users.read'], 'users.suspend')).toBe(false);
  });
});
