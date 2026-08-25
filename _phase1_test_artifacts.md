# Phase 1 Controlled Transaction Test Results

**Date:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")
**Status:** ✅ PASSED
**Commit Hash:** 32ce4dc (to be extended by this artifact commit)

## Purpose
Verify that the inventory consumption logic in the booking status flow (`IN_TREATMENT` → `COMPLETED`) produces atomic, correctly-typed ledger movements without creating spurious reconciliation records.

## Test Scope
1. Controlled purchase of a probe inventory item (`PRB-1787571260602` "PROBE Oil", stock 0 → 15 ml)
2. Booking lifecycle transition using test booking `BK-1787571269177` (status changes via public API)
3. Validate inventory movement creation:
   - Type: `PURCHASE` — quantity +15, before=0, after=15
   - Type: `RECIPE_CONSUMPTION` — quantity -10, before=15, after=5
4. Validate no spurious `inventory_reconciliations` records created
5. Validate `actualStartTime` populated on `IN_TREATMENT` transition

## Results

| Check | Result |
|-------|--------|
| Purchase creates exactly one PURCHASE movement | ✅ PASS |
| Movement quantity matches purchase quantity (15) | ✅ PASS |
| before_stock = 0, after_stock = 15 on purchase | ✅ PASS |
| Booking IN_TREATMENT transition sets actualStartTime | ✅ PASS |
| Booking COMPLETED transition succeeds (no 500) | ✅ PASS |
| Consumption creates exactly one RECIPE_CONSUMPTION movement | ✅ PASS |
| Consumption quantity = -10 ml (recipe line) | ✅ PASS |
| before_stock = 15, after_stock = 5 on consumption | ✅ PASS |
| No inventory_reconciliations records created | ✅ PASS |
| Current stock reconciles to 5 ml (0 + 15 - 10 = 5) | ✅ PASS |

### Sample Movement Query Output
```
id | inventory_id | type | quantity | before_stock | after_stock | reference_type | reference_id
1  | ...PRB-...   | PURCHASE | 15.000 | 0.000 | 15.000 | PURCHASE | <purchase_id>
2  | ...PRB-...   | RECIPE_CONSUMPTION | -10.000 | 15.000 | 5.000 | TREATMENT | 6acf40fe...
```

## Safety
- All test items use `PRB-` / `HARN-` prefixes (development probes)
- No production, customer, or live business data modified
- Read-only validation queries used for post-test verification
- Test files (`_slice.bat`) excluded from commit