# IFA LNG Modeling Test — Colab

Standalone Google Colab / Python project for the **Infrastructure Finance and Advisory** modeling test (Licata Energy Partners LNG, December 2023).

This folder is designed to live as its **own GitHub repository**. It currently sits under [Smordin-Capital](https://github.com/daxsmordin-ai/Smordin-Capital) only because the cloud agent token cannot create a new repo under `daxsmordin-ai`.

## Answers (base case)

| Question | Result |
| --- | --- |
| Maximum debt drawn during construction | **$741.8 mm** |
| Debt at COD (end-2027, IDC capitalized) | **$849.4 mm** |
| Sponsor levered IRR | **20.90%** |
| Minimum DSCR | **1.50x** |

Assumptions follow the test memo: SPA 1.25 mtpa, transport on full 1.5 mtpa capacity, fixed payment `$2.00 + $0.50 × CPI`, 5.50% debt, 1.50x DSCR, amort from 2030, pro-rata construction draws, IDC capitalized.

## Open in Google Colab

After this lands on `main` (or you publish a standalone repo):

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/daxsmordin-ai/Smordin-Capital/blob/cursor/ifa-modeling-colab-06a5/ifa-modeling-colab/IFA_LNG_Modeling_Test.ipynb)

Or locally:

```bash
cd ifa-modeling-colab
python3 -m pip install -r requirements.txt
python3 tests/test_lng_model.py
jupyter notebook IFA_LNG_Modeling_Test.ipynb
```

## Publish as a new GitHub repository

From your machine (with a PAT that can create repos):

```bash
# copy just this folder into a new git root
mkdir ifa-modeling-colab-repo && cp -R ifa-modeling-colab/* ifa-modeling-colab-repo/
cd ifa-modeling-colab-repo
git init
git add .
git commit -m "IFA LNG modeling test Colab"
gh repo create daxsmordin-ai/ifa-modeling-colab --public --source=. --remote=origin --push
```

Then update the clone URL inside `IFA_LNG_Modeling_Test.ipynb` cell 0.

## Layout

```
ifa-modeling-colab/
  IFA_LNG_Modeling_Test.ipynb   # Colab entrypoint
  src/lng_model.py              # cash flows, debt sculpting, IRR
  tests/test_lng_model.py
  requirements.txt
  README.md
```

## Fixes vs broken Excel → Colab ports

1. Production = SPA mtpa × 52e6 MMBtu (not the conversion factor alone).
2. Fixed payment uses the memo formula `$2 + $0.50 × CPI factor`.
3. Transport billed on full capacity.
4. Equity IRR includes construction equity contributions.
5. Debt sculpted to 1.50x DSCR with capitalized IDC.
