---
layout: distill
title: SeqSeg, From New Dataset to Training to Inference
description: A tutorial on setting up SeqSeg for medical image segmentation
categories: data-science
giscus_comments: false
date: 2025-01-15
featured: true
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

The repository for this is [`BloodVesselML3D`](https://github.com/numisveinsson/BloodVesselML3D) and the script is `gather_sampling_data_parallel.py`. This requires the following arguments:
- `config` - the configuration file for the dataset, which you must change to match your data

Next, we must change the naming structure to match nnU-Net. This is done with the `dataset_dirs/create_nnunet.py` script. The new data can be output anywhere, but we recommend directly into the nnU-Net Raw directory.

## 3. Training

The next step is to train the model. This is done with the specific nnU-Net commands, which are detailed in the [`nnU-Net`](https://github.com/MIC-DKFZ/nnUNet) repository.

This requires two commands:
- `prepocessing` command
- `train` command

You can train:
- 2D models
- 3D low resolution models
- 3D full resolution models

## 4. Inference

The final step is to run [`SeqSeg`](https://github.com/numisveinsson/SeqSeg/) inference on new data. This is done with the `SeqSeg/auto_centerline.py` script. You need direct access to the directory containing the images and seed points, and another containing the trained model weights.