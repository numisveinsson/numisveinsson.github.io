FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      curl unzip libgl1 libglib2.0-0 libxrender1 libxext6 \
    && rm -rf /var/lib/apt/lists/*

# CPU-only torch keeps the image far smaller; a run does not need a GPU.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Coronary CT weights: https://doi.org/10.5281/zenodo.23813298
RUN mkdir -p /models && cd /models \
    && curl -fsSL -o weights.zip "https://zenodo.org/records/23813298/files/nnUNet_results.zip?download=1" \
    && echo "0a1221345809e5921acb9067faf51c37  weights.zip" | md5sum -c - \
    && unzip -q weights.zip && rm weights.zip

RUN useradd -m -u 1000 app && mkdir -p /jobs && chown app /jobs
COPY app.py .
USER app

ENV SEQSEG_WEIGHTS=/models/nnUNet_results SEQSEG_JOBS=/jobs TRUST_PROXY=1
EXPOSE 7860
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
