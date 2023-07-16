# Clark
Chat with personnel documents(CSV, pdf, docx, doc, txt) using LangChain, OpenAI/HuggingFace, and FastAPI.

![Clark](clark.jpg)

## Installation

Install required packages.
```
python -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt
```

Rename `.env.example` to `.env` and update the OPENAI_API_KEY [OpenAI API key](https://platform.openai.com/account/api-keys), HUGGINGFACEHUB_API_TOKEN [HuggingFace Access Tokens] (https://huggingface.co/settings/tokens).


Place your own data (csv, pdf, docx, doc, txt) into `data/` folder.

## Run 

```
python console.py  # to use openai embeddings

python console.py hf  # to use huggingface embeddings

python console.py huggingface   # to use huggingface embeddings

```

```
Welcome to the Clark!
(type 'exit' to quit)
You: what is the capital of Uzbekistan?
Clark: The capital of Uzbekistan is Tashkent.
You: exit
```

```
python app.py  # to use openai embeddings

python app.py hf  # to use huggingface embeddings

python app.py huggingface   # to use huggingface embeddings

URL: 
http://127.0.0.1:8000/  
http://127.0.0.1:8000/docs
http://127.0.0.1:8000/redoc
```

## Project structure
```
.
├── LICENSE
├── README.md
├── app.py
├── console.py
├── data
│   └── sample_capitals.csv
├── document_conversation.py
├── document_utils.py
├── requirements.txt
└── templates
    ├── index.html
    ├── main.css
    ├── main.js
    └── spinner.gif

3 directories, 12 files
```

