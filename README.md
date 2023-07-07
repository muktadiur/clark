# Clark
AI Personel Data Assistant with OpenAI, and LangChain

## Installation

Install required packages.
```
python -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt
```

Rename `.env.example` to `.env` and update the OPENAI_API_KEY [OpenAI API key](https://platform.openai.com/account/api-keys).

Create data/pdf data/csv folder.
```
mkdir -p data/pdf data/csv
```

Place your own data (csv, pdf) into `data/pdf` and `data/csv` folder.

## Run

```
python app.py

```
