from fastapi import FastAPI, UploadFile, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import os
from paperqa import Docs
from dotenv import load_dotenv

load_dotenv()

UPLOAD_DIR = "uploaded_pdfs"
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/query")
async def query_paper(file: UploadFile, question: str = Form(...)):
    filename = file.filename or "uploaded.pdf"
    file_path = os.path.join(UPLOAD_DIR, filename)
    with open(file_path, "wb") as f:
        f.write(await file.read())

    docs = Docs()
    await docs.aadd(file_path)
    answer = await docs.aquery(question)

    return JSONResponse({"answer": answer.formatted_answer})
