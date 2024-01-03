---
layout: page
title: Transfomers for Tracking 
description: Utilizing transformer neural network architecture to exploit the sequential nature of blood vessel tracking
img: assets/img/trans_tracing.png
importance: 3
category: solo
related_publications:
---

### Background

Blood vessel tracking refers to the method of moving along within a medical image volume and constructing a series of points defining the vessel's centerline.
The purpose of blood vessel tracking can vary but most commonly is related to geometric modeling of blood vessels.
This remains an unsolved problem to such a degree that the most common blood vessel tracking is the manual approach.

Transformers are a type of neural network architecture. Transformers emmerged within natural language processing field of machine learning because of their impressive ability to solve sequential ML tasks (such as those related to language translation, text summarization etc).

### Objective

The objective of this project is twofold:
1. Define the blood vessel tracking task as a sequential problem
2. Apply a transformer neural network to learn to solve that problem

### Method

## Dataset
We use a dataset from vascularmodel.com consisting of pairs of medical images and blood vessel centerlines constructed by experts.

## Neural Network
Utilize a pytorch implementation of a transformer neural network written in python
