---
layout: distill
title: From CSVs to VTKs — Data Formats You’ll Actually Need for Bioengineering
description: A practical guide to understanding biomedical data formats and how they fit into the modeling and simulation workflow.
---

Working in bioengineering often means juggling data in half a dozen formats—each one solving a slightly different problem. You might start with medical images, generate surface meshes, store simulation results, and end up exporting values in something a spreadsheet can read.  
If you’ve ever found yourself lost in a maze of `.nii`, `.stl`, `.vtk`, `.csv`, and `.json` files, this post is for you.

---

## 1. Image Formats: Where It All Begins

Most modeling pipelines start from imaging data—CT, MRI, or ultrasound. These formats preserve both **intensity information** and **spatial orientation**.

- **DICOM (.dcm)** – The clinical standard. Encodes pixel data plus metadata (patient ID, acquisition settings, timestamps). Excellent for clinical exchange, but bulky and fragmented across many files.
- **NIfTI (.nii)** – Compact, research-friendly version of medical images. Encodes 3D/4D volumes with coordinate systems. Common in neuroimaging and open datasets.
- **MetaImage (.mha / .mhd + .raw)** – Simple header + raw binary data, easily parsed by ITK, SimpleITK, or VTK. Great for reproducible research pipelines.

**Best for:** Input data to segmentation or image-based modeling workflows.

> **Figure 1 Placeholder:** comparison diagram showing how a DICOM stack becomes a 3D NIfTI or MHA volume (visualize volume reconstruction).

---

## 2. Geometry Formats: From Pixels to Surfaces

Once segmentation is done, we move from voxel-based images to **polygonal geometry**.

- **STL (.stl)** – The 3D printing standard. Represents surfaces as triangles only. No color, no topology, no metadata.
- **OBJ (.obj)** – Similar to STL, but can include vertex colors, UV maps, and materials.
- **VTK (.vtk)** – Legacy but still powerful. Used in ParaView and VTK-based software.
- **VTP (.vtp)** – XML version of VTK PolyData, easier to parse and compatible with ParaView, SimVascular, and 3D Slicer.
- **VTU (.vtu)** – XML format for unstructured grids (volumetric meshes), used in CFD and FEA simulations.

**Best for:** Visualization, meshing, or simulation-ready geometries.

> **Figure 2 Placeholder:** a pipeline diagram: segmentation mask → STL surface → smoothed PolyData (.vtp) → volumetric mesh (.vtu).

---

## 3. Structured Data: Metadata, Parameters, and Results

Beyond geometry and images, simulation projects rely on lightweight formats to handle configuration and results.

- **CSV (.csv)** – The universal choice for tabular results: pressure, flow, shear stress, or nodal displacements.
- **JSON (.json)** – Excellent for storing simulation parameters or structured metadata. Human-readable and language-agnostic.
- **YAML (.yml)** – More readable alternative to JSON. Often used in configuration files for pipelines or experiments.

**Best for:** Inputs/outputs that need to be portable or version-controlled.

> **Figure 3 Placeholder:** sample workflow showing a `.json` configuration → `.vtu` simulation → `.csv` results table.

---

## 4. Putting It Together

Each format plays a role in the lifecycle of a model:

| Stage | Typical Format | Purpose |
|-------|----------------|----------|
| Imaging | `.nii`, `.mha`, `.dcm` | Store 3D image volumes |
| Segmentation | `.nii`, `.mha` | Binary masks |
| Geometry | `.stl`, `.vtp`, `.obj` | Surface models |
| Mesh | `.vtu`, `.vtk` | Simulation domain |
| Results | `.csv`, `.vtu` | Simulation output |
| Metadata | `.json`, `.yml` | Pipeline configuration |

---

## 5. Choosing Wisely

There’s no “best” format—only the right one for your stage in the workflow. The key is **consistency** and **traceability**:  
keep metadata with the data, prefer open formats over proprietary ones, and always make sure what you generate today can still be read in five years.

---

**Pro tip:**  
Whenever you design a new pipeline, document your file conventions.  
Decide *once* how you’ll name, compress, and store your data—your future self (and collaborators) will thank you.

---

*Next post idea:* “What Actually Happens When You Click ‘Run’ — Understanding Boundary Conditions in Cardiovascular Simulation”