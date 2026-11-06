"""Small job API that runs a short SeqSeg trace on a cropped CT volume.

Jobs run one at a time. Uploads and results live in a temporary folder and are
removed after the client deletes them or RESULT_TTL_S passes, whichever is first.
"""

import json
import os
import queue
import shutil
import signal
import subprocess
import tempfile
import threading
import time
import uuid
from collections import defaultdict, deque
from pathlib import Path

import SimpleITK as sitk
import vtk
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

WEIGHTS = os.environ.get("SEQSEG_WEIGHTS", "nnUNet_results")
JOBS_DIR = Path(os.environ.get("SEQSEG_JOBS") or tempfile.mkdtemp(prefix="seqseg-jobs-"))
ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS",
    "https://numisveinsson.com,http://localhost:4000,http://127.0.0.1:4000",
).split(",")
TRUST_PROXY = os.environ.get("TRUST_PROXY") == "1"

TRAIN_DATASET = "Dataset002_CASXCT"
FOLD = "0"
CONFIG_NAME = "global_coro"

MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_MB", "60")) * 1024 * 1024
MAX_VOXELS = 64_000_000
MAX_STEPS = 20
MAX_QUEUE = int(os.environ.get("MAX_QUEUE", "5"))
MAX_JOBS_PER_HOUR = int(os.environ.get("MAX_JOBS_PER_HOUR", "10"))
JOB_TIMEOUT_S = int(os.environ.get("JOB_TIMEOUT_S", "300"))
RESULT_TTL_S = int(os.environ.get("RESULT_TTL_S", "900"))

app = FastAPI(title="SeqSeg demo", docs_url=None, redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)

jobs = {}
jobs_lock = threading.Lock()
job_queue = queue.Queue()
recent_by_client = defaultdict(deque)


@app.middleware("http")
async def limit_upload_size(request: Request, call_next):
    if request.method == "POST":
        length = request.headers.get("content-length")
        if length is None:
            return JSONResponse({"detail": "Content-Length is required."}, 411)
        if int(length) > MAX_UPLOAD_BYTES:
            return JSONResponse({"detail": "Upload is too large."}, 413)
    return await call_next(request)


def client_id(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if TRUST_PROXY and forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def check_rate_limit(client: str) -> None:
    now = time.time()
    with jobs_lock:
        recent = recent_by_client[client]
        while recent and now - recent[0] > 3600:
            recent.popleft()
        if len(recent) >= MAX_JOBS_PER_HOUR:
            raise HTTPException(429, "Hourly job limit reached. Please try again later.")
        recent.append(now)


def parse_seed(raw: str) -> dict:
    """Validate a seed given in RAS world coordinates, in the image's own unit."""
    try:
        seed = json.loads(raw)
        start = [float(v) for v in seed["start"]]
        direction = [float(v) for v in seed["direction"]]
        radius = float(seed["radius"])
    except (ValueError, KeyError, TypeError):
        raise HTTPException(400, "Seed is not valid.")
    if len(start) != 3 or len(direction) != 3 or radius <= 0 or start == direction:
        raise HTTPException(400, "Seed needs a start, a separate direction point and a radius.")
    return {"start": start, "direction": direction, "radius": radius}


def ras_to_lps(point: list) -> list:
    return [-point[0], -point[1], point[2]]


def validate_image(path: Path, start_lps: list, direction_lps: list) -> None:
    reader = sitk.ImageFileReader()
    reader.SetFileName(str(path))
    try:
        reader.ReadImageInformation()
    except RuntimeError:
        raise HTTPException(400, "Could not read the image.")
    size = reader.GetSize()
    voxels = 1
    for extent in size:
        voxels *= extent
    if len(size) != 3 or voxels > MAX_VOXELS:
        raise HTTPException(400, "Expected a 3D image within the size limit.")
    image = sitk.Image([1, 1, 1], sitk.sitkUInt8)
    image.SetOrigin(reader.GetOrigin())
    image.SetSpacing(reader.GetSpacing())
    image.SetDirection(reader.GetDirection())
    for point in (start_lps, direction_lps):
        index = image.TransformPhysicalPointToContinuousIndex(point)
        if not all(-0.5 <= value < extent - 0.5 for value, extent in zip(index, size)):
            raise HTTPException(400, "Seed points must lie inside the uploaded image.")


def set_state(job_id: str, **fields) -> None:
    with jobs_lock:
        if job_id in jobs:
            jobs[job_id].update(fields)


def write_results(job_dir: Path, out_dir: Path) -> dict:
    masks = sorted(out_dir.glob("case_segmentation_*_steps.mha"))
    meshes = sorted(out_dir.glob("case_surface_mesh_*_steps.vtp"))
    if not masks or not meshes:
        raise RuntimeError("SeqSeg did not produce a segmentation from this seed.")

    mask = sitk.ReadImage(str(masks[-1])) > 0
    stats = sitk.LabelShapeStatisticsImageFilter()
    stats.Execute(mask)
    if 1 not in stats.GetLabels():
        raise RuntimeError("SeqSeg finished, but the segmentation is empty.")
    box = stats.GetBoundingBox(1)
    start, extent = box[:3], box[3:]
    margin = 4
    low = [max(s - margin, 0) for s in start]
    high = [min(s + e + margin, m) for s, e, m in zip(start, extent, mask.GetSize())]
    cropped = sitk.RegionOfInterest(mask, [h - l for h, l in zip(high, low)], low)
    sitk.WriteImage(cropped, str(job_dir / "mask.nii.gz"), useCompression=True)

    shutil.copy(meshes[-1], job_dir / "mesh.vtp")
    reader = vtk.vtkXMLPolyDataReader()
    reader.SetFileName(str(meshes[-1]))
    transform = vtk.vtkTransform()
    transform.Scale(-1, -1, 1)  # SeqSeg writes LPS; the viewer expects RAS.
    to_ras = vtk.vtkTransformPolyDataFilter()
    to_ras.SetInputConnection(reader.GetOutputPort())
    to_ras.SetTransform(transform)
    writer = vtk.vtkSTLWriter()
    writer.SetInputConnection(to_ras.GetOutputPort())
    writer.SetFileName(str(job_dir / "mesh.stl"))
    writer.SetFileTypeToBinary()
    writer.Write()

    voxel_volume = 1.0
    for spacing in mask.GetSpacing():
        voxel_volume *= spacing
    steps = masks[-1].stem.rsplit("_", 2)[-2]
    return {"steps": int(steps), "volume": stats.GetNumberOfPixels(1) * voxel_volume}


def run_job(job_id: str) -> None:
    with jobs_lock:
        job = dict(jobs[job_id])
    job_dir = Path(job["dir"])
    out_dir = job_dir / "out"
    command = [
        "seqseg", "run", "batch",
        "-data_dir", str(job_dir / "data"),
        "-nnunet_results_path", WEIGHTS,
        "-train_dataset", TRAIN_DATASET,
        "-fold", FOLD,
        "-nnunet_type", "3d_fullres",
        "-config_name", CONFIG_NAME,
        "-img_ext", ".nii.gz",
        "-outdir", f"{out_dir}/",  # SeqSeg joins this path without a separator.
        "-max_n_steps", str(job["steps"]),
        "-cpu",
    ]
    if job["unit"] == "cm":
        command += ["-unit", "cm", "-scale", "10"]

    log_path = job_dir / "seqseg.log"
    with open(log_path, "wb") as log:
        process = subprocess.Popen(
            command, stdout=log, stderr=subprocess.STDOUT, start_new_session=True
        )
        try:
            code = process.wait(timeout=JOB_TIMEOUT_S)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait()
            raise RuntimeError("The run took too long and was stopped.")
    if code != 0:
        raise RuntimeError("SeqSeg stopped with an error.")
    set_state(job_id, status="done", finished=time.time(), **write_results(job_dir, out_dir))
    shutil.rmtree(job_dir / "data", ignore_errors=True)
    shutil.rmtree(out_dir, ignore_errors=True)
    log_path.unlink(missing_ok=True)


def worker() -> None:
    while True:
        job_id = job_queue.get()
        with jobs_lock:
            job = jobs.get(job_id)
        if job is None:
            continue
        set_state(job_id, status="running", started=time.time())
        try:
            run_job(job_id)
        except Exception as error:  # Reported to the client, which shows it to the user.
            message = str(error) if isinstance(error, RuntimeError) else "The run failed."
            set_state(job_id, status="failed", error=message, finished=time.time())
            shutil.rmtree(Path(job["dir"]) / "data", ignore_errors=True)


def delete_job(job_id: str) -> None:
    with jobs_lock:
        job = jobs.pop(job_id, None)
    if job:
        shutil.rmtree(job["dir"], ignore_errors=True)


def cleaner() -> None:
    while True:
        time.sleep(30)
        now = time.time()
        with jobs_lock:
            expired = [
                job_id
                for job_id, job in jobs.items()
                if job["status"] != "running" and now - job["created"] > RESULT_TTL_S
            ]
        for job_id in expired:
            delete_job(job_id)


threading.Thread(target=worker, daemon=True).start()
threading.Thread(target=cleaner, daemon=True).start()


@app.get("/api/health")
def health():
    return {"status": "ok", "max_steps": MAX_STEPS, "max_upload_mb": MAX_UPLOAD_BYTES // 2**20}


@app.post("/api/jobs", status_code=202)
def create_job(
    request: Request,
    image: UploadFile = File(...),
    seed: str = Form(...),
    steps: int = Form(5),
    unit: str = Form("mm"),
):
    if unit not in ("mm", "cm"):
        raise HTTPException(400, "Unit must be mm or cm.")
    if not 1 <= steps <= MAX_STEPS:
        raise HTTPException(400, f"Steps must be between 1 and {MAX_STEPS}.")
    parsed = parse_seed(seed)
    start, direction = ras_to_lps(parsed["start"]), ras_to_lps(parsed["direction"])
    if job_queue.qsize() >= MAX_QUEUE:
        raise HTTPException(503, "The queue is full. Please try again in a few minutes.")
    check_rate_limit(client_id(request))

    job_id = uuid.uuid4().hex
    job_dir = JOBS_DIR / job_id
    (job_dir / "data" / "images").mkdir(parents=True)
    image_path = job_dir / "data" / "images" / "case.nii.gz"
    try:
        with open(image_path, "wb") as target:
            shutil.copyfileobj(image.file, target)
        validate_image(image_path, start, direction)
    except HTTPException:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise
    seeds = [{"name": "case", "seeds": [[start, direction, parsed["radius"]]]}]
    (job_dir / "data" / "seeds.json").write_text(json.dumps(seeds))

    with jobs_lock:
        jobs[job_id] = {
            "dir": str(job_dir),
            "status": "queued",
            "created": time.time(),
            "steps": steps,
            "unit": unit,
        }
    job_queue.put(job_id)
    return {"id": job_id}


def get_job(job_id: str) -> dict:
    with jobs_lock:
        job = jobs.get(job_id)
        if job is None:
            raise HTTPException(404, "This job has expired.")
        return dict(job)


@app.get("/api/jobs/{job_id}")
def job_status(job_id: str):
    job = get_job(job_id)
    keys = ("status", "error", "steps", "volume", "unit", "created", "started", "finished")
    return {key: job[key] for key in keys if key in job}


@app.get("/api/jobs/{job_id}/{name}")
def job_file(job_id: str, name: str):
    job = get_job(job_id)
    if name not in ("mask.nii.gz", "mesh.stl", "mesh.vtp") or job["status"] != "done":
        raise HTTPException(404, "No such result.")
    return FileResponse(Path(job["dir"]) / name, filename=f"seqseg_{name}")


@app.delete("/api/jobs/{job_id}", status_code=204)
def remove_job(job_id: str):
    job = get_job(job_id)
    if job["status"] == "running":
        raise HTTPException(409, "This job is still running.")
    delete_job(job_id)
