# SeqSeg demo backend

FastAPI service behind the `/tools/seqseg/` page. GitHub Pages cannot run it, so
it is hosted separately. It traces from one seed on a CPU, one job at a time.

## Run locally

```bash
pip install -r requirements.txt
curl -L -o weights.zip "https://zenodo.org/records/23813298/files/nnUNet_results.zip?download=1"
unzip weights.zip
SEQSEG_WEIGHTS=nnUNet_results uvicorn app:app --port 7860
```

## API

- `POST /api/jobs`: multipart with `image` (`.nii.gz`), `seed`, `steps`, `unit`.
  `seed` is JSON: `{"start": [x, y, z], "direction": [x, y, z], "radius": r}` in
  RAS world coordinates and the image's unit. The API converts to LPS for SeqSeg.
- `GET /api/jobs/{id}`: job status.
- `GET /api/jobs/{id}/{mask.nii.gz|mesh.stl|mesh.vtp}`: results. The STL is in RAS.
- `DELETE /api/jobs/{id}`: removes the job's files.

Files are deleted when a client deletes the job or 15 minutes after it was created.

## Settings

`ALLOWED_ORIGINS`, `MAX_UPLOAD_MB`, `MAX_QUEUE`, `MAX_JOBS_PER_HOUR`, `JOB_TIMEOUT_S`,
`RESULT_TTL_S`, `SEQSEG_WEIGHTS`, `SEQSEG_JOBS`. Set `TRUST_PROXY=1` only behind a
proxy that sets `X-Forwarded-For`, as the Dockerfile assumes.
