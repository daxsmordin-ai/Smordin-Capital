"""
IFA Modeling Test (December 2023) — Licata Energy Partners LNG project.

Implements the Infrastructure Finance and Advisory modeling test in Python so it
can run in Google Colab or locally without Excel.

Answers:
  1) Maximum senior debt the project can support at a 1.50x DSCR
  2) Resulting levered equity IRR for the Sponsor
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

import numpy as np

MMBTU_PER_MTPA = 52_000_000.0
START_YEAR = 2024
N_YEARS = 25  # 2024 .. 2048 (matches the Excel column span F:AD)
OPS_START = 2028
OPS_YEARS = 20  # 2028 .. 2047
AMORT_START = 2030
DSCR_TARGET = 1.50
INTEREST_RATE = 0.055

# Capex from the provided Inputs sheet ($000s → dollars)
CAPEX_BY_YEAR: dict[int, float] = {
    2024: 195_000_000.0,
    2025: 270_000_000.0,
    2026: 225_000_000.0,
    2027: 210_000_000.0,
}

# Henry Hub curve from Inputs!C18:AA18
HENRY_HUB: list[float] = [
    2.87,
    2.95,
    3.01,
    2.8,
    2.42,
    2.78,
    3.12,
    3.25,
    3.28,
    3.35,
    3.62,
    3.7286,
    3.840458,
    3.95567174,
    4.0743418922,
    4.196572148966,
    4.322469313435,
    4.452143392838,
    4.585707694623,
    4.723278925462,
    4.864977293226,
    5.010926612022,
    5.161254410383,
    5.316092042695,
    5.475574803976,
]


def build_cpi(n: int = N_YEARS, start: float = 100.0, growth: float = 0.025) -> np.ndarray:
    """CPI index with 2.5% annual growth (Inputs sheet)."""
    cpi = np.empty(n, dtype=float)
    cpi[0] = start
    for i in range(1, n):
        cpi[i] = cpi[i - 1] * (1.0 + growth)
    return cpi


def annual_irr(cashflows: np.ndarray) -> float:
    """Newton IRR on annual period cash flows. Raises if it cannot converge."""
    cf = np.asarray(cashflows, dtype=float)
    if not np.any(cf < 0) or not np.any(cf > 0):
        raise ValueError("IRR requires both positive and negative cash flows")

    r = 0.1
    for _ in range(200):
        denom = np.array([(1.0 + r) ** t for t in range(len(cf))], dtype=float)
        f = float(np.sum(cf / denom))
        df = float(np.sum(-np.arange(len(cf)) * cf / (denom * (1.0 + r))))
        if abs(df) < 1e-18:
            break
        r_next = r - f / df
        if abs(r_next - r) < 1e-14:
            r = r_next
            break
        r = r_next
    if not np.isfinite(r):
        raise ValueError("IRR failed to converge")
    return float(r)


DrawMode = Literal["prorata", "upfront"]


@dataclass
class ModelResult:
    years: np.ndarray
    cfads: np.ndarray
    debt_draws: np.ndarray
    interest: np.ndarray
    amortization: np.ndarray
    closing_balance: np.ndarray
    debt_service: np.ndarray
    dscr: np.ndarray
    equity_cashflow: np.ndarray
    max_debt_drawn: float
    debt_at_cod: float
    levered_irr: float
    min_dscr: float
    total_capex: float
    notes: list[str] = field(default_factory=list)

    def summary(self) -> dict[str, float | str]:
        return {
            "max_debt_drawn_usd_m": round(self.max_debt_drawn / 1e6, 3),
            "debt_at_cod_usd_m": round(self.debt_at_cod / 1e6, 3),
            "levered_irr_pct": round(self.levered_irr * 100, 2),
            "min_dscr": round(self.min_dscr, 4),
            "total_capex_usd_m": round(self.total_capex / 1e6, 3),
        }


def compute_cfads(
    spa_mtpa: float = 1.25,
    capacity_mtpa: float = 1.5,
    fixed_base: float = 2.0,
    fixed_cpi_addon: float = 0.5,
    commodity_factor: float = 1.10,
    gas_factor: float = 1.01,
    transport_fee: float = 0.20,
    om_annual: float = 50_000_000.0,
    hh: list[float] | None = None,
    cpi: np.ndarray | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Annual CFADS per the modeling-test PDF.

    Fixed Payment ($/MMBtu) = $2.00 + $0.50 × CPI_t/CPI_0  (floor CPI factor at 1.0)
    Commodity Payment       = 110% × HH
    Gas cost                = 101% × HH on SPA volume
    Transport               = $0.20/MMBtu on full facility capacity
    O&M                     = $50mm × CPI factor
    """
    years = np.arange(START_YEAR, START_YEAR + N_YEARS)
    hh_arr = np.asarray(hh if hh is not None else HENRY_HUB, dtype=float)
    cpi_arr = cpi if cpi is not None else build_cpi()
    assert len(hh_arr) == N_YEARS and len(cpi_arr) == N_YEARS

    spa_vol = spa_mtpa * MMBTU_PER_MTPA
    cap_vol = capacity_mtpa * MMBTU_PER_MTPA
    cpi0 = cpi_arr[0]

    cfads = np.zeros(N_YEARS, dtype=float)
    for i, year in enumerate(years):
        ops = 1.0 if OPS_START <= int(year) < OPS_START + OPS_YEARS else 0.0
        if ops == 0.0:
            continue
        cpi_factor = max(float(cpi_arr[i] / cpi0), 1.0)
        prod = spa_vol * ops
        fixed = (fixed_base + fixed_cpi_addon * cpi_factor) * prod
        commodity = commodity_factor * float(hh_arr[i]) * prod
        gas = gas_factor * float(hh_arr[i]) * prod
        transport = transport_fee * cap_vol * ops
        om = om_annual * cpi_factor * ops
        cfads[i] = (fixed + commodity) - (gas + transport + om)
    return years, cfads


def _simulate(
    debt_capacity: float,
    cfads: np.ndarray,
    draw_mode: DrawMode,
    dscr: float,
    rate: float,
    capitalize_idc: bool,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray, float]:
    years = np.arange(START_YEAR, START_YEAR + N_YEARS)
    total_capex = float(sum(CAPEX_BY_YEAR.values()))
    bal = 0.0
    draws = np.zeros(N_YEARS)
    interest_arr = np.zeros(N_YEARS)
    amort_arr = np.zeros(N_YEARS)
    close_arr = np.zeros(N_YEARS)
    ds_arr = np.zeros(N_YEARS)
    equity = np.zeros(N_YEARS)
    min_dscr = float("inf")

    for i, year in enumerate(years):
        year_i = int(year)
        capex = CAPEX_BY_YEAR.get(year_i, 0.0)
        if draw_mode == "upfront":
            draw = debt_capacity if year_i == START_YEAR else 0.0
        else:
            draw = debt_capacity * (capex / total_capex) if year_i in CAPEX_BY_YEAR else 0.0
        draws[i] = draw

        after_draw = bal + draw
        interest = after_draw * rate
        interest_arr[i] = interest
        amort = 0.0

        if year_i in CAPEX_BY_YEAR:
            if capitalize_idc:
                bal = after_draw + interest
                equity[i] = -(capex - draw)
                ds_arr[i] = 0.0
            else:
                bal = after_draw
                equity[i] = -(capex - draw) - interest
                ds_arr[i] = interest
        else:
            if year_i >= AMORT_START:
                target_ds = cfads[i] / dscr
                amort = min(after_draw, max(0.0, target_ds - interest))
            amort_arr[i] = amort
            ds = interest + amort
            ds_arr[i] = ds
            bal = after_draw - amort
            if ds > 1.0 and cfads[i] > 0.0:
                min_dscr = min(min_dscr, cfads[i] / ds)
            if OPS_START <= year_i < OPS_START + OPS_YEARS:
                equity[i] = cfads[i] - ds
            else:
                equity[i] = 0.0

        close_arr[i] = bal

    if not np.isfinite(min_dscr):
        min_dscr = float("nan")
    return draws, interest_arr, amort_arr, close_arr, ds_arr, equity, min_dscr


def size_debt(
    cfads: np.ndarray,
    draw_mode: DrawMode = "prorata",
    dscr: float = DSCR_TARGET,
    rate: float = INTEREST_RATE,
    capitalize_idc: bool = True,
    tol_balance: float = 1_000.0,
) -> float:
    """Largest total construction drawdowns that fully amortize at the DSCR target."""
    lo, hi = 0.0, float(sum(CAPEX_BY_YEAR.values()))
    best = 0.0
    for _ in range(60):
        mid = (lo + hi) / 2.0
        _draws, _int, _amort, close, _ds, _eq, min_dscr = _simulate(
            mid, cfads, draw_mode, dscr, rate, capitalize_idc
        )
        end_bal = float(close[-1])
        ok = end_bal <= tol_balance and (not np.isfinite(min_dscr) or min_dscr >= dscr - 1e-9)
        if ok:
            best = mid
            lo = mid
        else:
            hi = mid
    return best


def run_model(
    draw_mode: DrawMode = "prorata",
    capitalize_idc: bool = True,
    spa_mtpa: float = 1.25,
    capacity_mtpa: float = 1.5,
) -> ModelResult:
    years, cfads = compute_cfads(spa_mtpa=spa_mtpa, capacity_mtpa=capacity_mtpa)
    debt = size_debt(cfads, draw_mode=draw_mode, capitalize_idc=capitalize_idc)
    draws, interest, amort, close, ds, equity, min_dscr = _simulate(
        debt, cfads, draw_mode, DSCR_TARGET, INTEREST_RATE, capitalize_idc
    )
    # COD balance = closing balance at year-end 2027
    debt_at_cod = float(close[list(years).index(OPS_START - 1)])
    levered = annual_irr(equity)
    notes = [
        "Fixed payment follows the PDF: ($2.00 + $0.50 × CPI factor) × SPA MMBtu.",
        "Transport charged on full 1.5 mtpa capacity.",
        "SPA volume 1.25 mtpa; 1 mtpa = 52,000,000 MMBtu.",
        "Interest during construction capitalized into the debt balance."
        if capitalize_idc
        else "Interest during construction paid by equity.",
        f"Debt draws mode: {draw_mode}.",
        "Amortization sculpted to 1.50x DSCR from 2030 through 2047.",
    ]
    return ModelResult(
        years=years,
        cfads=cfads,
        debt_draws=draws,
        interest=interest,
        amortization=amort,
        closing_balance=close,
        debt_service=ds,
        dscr=np.divide(
            cfads,
            ds,
            out=np.full_like(cfads, np.nan),
            where=ds > 1.0,
        ),
        equity_cashflow=equity,
        max_debt_drawn=float(debt),
        debt_at_cod=debt_at_cod,
        levered_irr=levered,
        min_dscr=float(min_dscr),
        total_capex=float(sum(CAPEX_BY_YEAR.values())),
        notes=notes,
    )


def answers_markdown(result: ModelResult) -> str:
    s = result.summary()
    return (
        f"### Answers\n\n"
        f"| Question | Result |\n"
        f"| --- | --- |\n"
        f"| Maximum debt drawn during construction | **${s['max_debt_drawn_usd_m']:,.1f} mm** |\n"
        f"| Debt balance at COD (end-2027, with IDC) | **${s['debt_at_cod_usd_m']:,.1f} mm** |\n"
        f"| Sponsor levered IRR | **{s['levered_irr_pct']:.2f}%** |\n"
        f"| Minimum DSCR (ops) | **{s['min_dscr']:.2f}x** |\n"
    )
