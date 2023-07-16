# Clark
Chat with personnel documents(csv, pdf, docx, doc, txt) using LangChain, OpenAI/HuggingFace.

## Installation

Install required packages.
```
python -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt
```

Rename `.env.example` to `.env` and update the OPENAI_API_KEY [OpenAI API key](https://platform.openai.com/account/api-keys).


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

