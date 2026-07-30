import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.lng_model import compute_cfads, run_model


def test_cfads_positive_in_ops():
    years, cfads = compute_cfads()
    ops = (years >= 2028) & (years < 2048)
    assert np.all(cfads[ops] > 0)
    assert np.all(cfads[~ops] == 0)


def test_debt_fully_repays_at_dscr():
    result = run_model()
    assert result.closing_balance[-1] < 1_000
    assert result.min_dscr >= 1.5 - 1e-6
    assert result.max_debt_drawn > 0
    assert 0.05 < result.levered_irr < 0.5


def test_summary_keys():
    summary = run_model().summary()
    assert "max_debt_drawn_usd_m" in summary
    assert "levered_irr_pct" in summary


if __name__ == "__main__":
    test_cfads_positive_in_ops()
    test_debt_fully_repays_at_dscr()
    test_summary_keys()
    result = run_model()
    print(result.summary())
    print("ok")
