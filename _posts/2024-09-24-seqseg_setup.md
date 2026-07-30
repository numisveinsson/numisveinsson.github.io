---
layout: distill
title: SeqSeg, From New Dataset to Training to Inference
description: A tutorial on setting up SeqSeg for medical image segmentation
categories: data-science
giscus_comments: false
date: 2025-01-15
featured: false
related_posts: true

authors:
  - name: Numi Sveinsson Cepero
    url: numisveinsson.com
    affiliations:
      name: UC Berkeley

# Optionally, you can add a table of contents to your post.
# NOTES:
#   - make sure that TOC names match the actual section names
#     for hyperlinks within the post to work correctly.
#   - we may want to automate TOC generation in the future using
#     jekyll-toc plugin (https://github.com/toshimaru/jekyll-toc).
toc:
  - name: Data Preparation and Structure
  - name: Data Preprocessing (for Training)
  - name: Training
  - name: Inference
---

## 1. Data Preparation and Structure

The first step in using [`SeqSeg`](https://github.com/numisveinsson/SeqSeg/) is to preprocess your data.

We require the following data:

- A directory containing the images named `images`
- A directory containing the masks named `truths`
- A directory containing the centerlines named `centerlines`
  - as `.vtp` files

A few things to note:

- The images and masks and centerlines should have the same name
- If you need to extract centerlines from masks, you can use the `SeqSeg/centerlines.py` script, or use VMTK or other tools
  - Centerlines must contain radius information in the `.vtp` file
- Make sure that the masks, images and centerlines align correctly, for example open and view together in an image viewer e.g. `Paraview`
- Make sure the images contain origin, spacing and direction information in the metadata
  - This is important for correct alignment before centerline extraction

## 2. Data Preprocessing (for Training)

The next step is to preprocess the data for training. SeqSeg requires a model trained on local patches, so we need to extract patches from the images and masks based on centerlines.

The repository for this is [`vascular-segment-sampler`](https://github.com/numisveinsson/vascular-segment-sampler). Use `main_with_nnunet.py` to extract patches and convert them to nnU-Net format in one step. First, edit the configuration YAML in `config/` (e.g. `config/global.yaml`) so it matches your dataset, then run:

```bash
python3 main_with_nnunet.py \
    --config_name global \
    --data_dir /path/to/data \
    --outdir ./extracted_data/ \
    --num_cores 4 \
    --modality CT \
    --nnunet_name AORTAS \
    --nnunet_dataset_number 1
```

Key arguments:

- `--config_name` — name of the configuration file in `config/` (without `.yaml`)
- `--data_dir` — directory containing `images/`, `truths/`, and `centerlines/`
- `--outdir` — where extracted patches and the nnU-Net dataset are written (default: `./extracted_data/`)
- `--modality` — imaging modality (`CT`, `MR`, or comma-separated, e.g. `CT,MR`)
- `--nnunet_name` — dataset name for nnU-Net (default: `AORTAS`)
- `--nnunet_dataset_number` — nnU-Net dataset number (default: `1`)

For a quick test on a subset of cases:

```bash
python3 main_with_nnunet.py \
    --config_name global \
    --data_dir /path/to/data \
    --outdir ./extracted_data/ \
    --modality CT \
    --nnunet_name AORTAS \
    --nnunet_dataset_number 1 \
    --max_samples 100 \
    --testing
```

The new data can be output anywhere, but we recommend writing directly into the nnU-Net Raw directory (or copying the resulting `DatasetXXX_*` folder there).

## 3. Training

The next step is to train the model with [`nnU-Net`](https://github.com/MIC-DKFZ/nnUNet) (see the [documentation](https://github.com/MIC-DKFZ/nnUNet/blob/master/documentation/how_to_use_nnunet.md) for more details). Make sure `nnUNet_raw`, `nnUNet_preprocessed`, and `nnUNet_results` are set, and that the dataset from step 2 is in `nnUNet_raw`.

### Preprocessing

Run fingerprint extraction, experiment planning, and preprocessing:

```bash
nnUNetv2_plan_and_preprocess -d 1 --verify_dataset_integrity
```

Replace `1` with the `--nnunet_dataset_number` you used above. Use `--verify_dataset_integrity` the first time you run this. To preprocess only a specific configuration:

```bash
nnUNetv2_plan_and_preprocess -d 1 -c 3d_fullres
```

### Training

Train a fold with:

```bash
nnUNetv2_train DATASET_NAME_OR_ID CONFIGURATION FOLD
```

For example, with dataset `1` (`Dataset001_AORTAS`), train fold 0 of a 3D full-resolution model:

```bash
nnUNetv2_train 1 3d_fullres 0
```

Repeat for folds `0`–`4` (or train fold `all` for a single model on all training cases). Other common configurations:

```bash
nnUNetv2_train 1 2d 0
nnUNetv2_train 1 3d_lowres 0
nnUNetv2_train 1 3d_fullres 0
```

Add `--npz` if you plan to use `nnUNetv2_find_best_configuration` later. Resume an interrupted run with `--c`.

## 4. Inference

The final step is to run [`SeqSeg`](https://github.com/numisveinsson/SeqSeg/) inference on new data. This is done with the `SeqSeg/seqseg.py` script. You need direct access to the directory containing the images and seed points, and another containing the trained model weights.
