---
layout: page
title: Try SeqSeg
permalink: /tools/seqseg/
description: Trace a coronary artery in your browser from a single seed.
nav: false
sitemap: false
_styles: |
  .seqseg { display: grid; gap: 1.25rem; }
  .seqseg-notice { border-left: 3px solid var(--global-theme-color); padding: 0.5rem 0 0.5rem 1rem; color: var(--global-text-color-light); font-size: 0.95rem; }
  .seqseg-notice p { margin: 0 0 0.35rem; }
  .seqseg-notice p:last-child { margin-bottom: 0; }
  .seqseg-drop { display: block; border: 1.5px dashed var(--global-divider-color); border-radius: 10px; padding: 1.5rem; text-align: center; cursor: pointer; }
  .seqseg-drop:hover, .seqseg-drop.is-over, .seqseg-drop:focus-within { border-color: var(--global-theme-color); }
  .seqseg-drop input { position: absolute; opacity: 0; width: 1px; height: 1px; }
  .seqseg-drop small { display: block; color: var(--global-text-color-light); }
  .seqseg-viewer { position: relative; background: #000; border-radius: 10px; overflow: hidden; aspect-ratio: 4 / 3; max-height: 75vh; width: 100%; }
  .seqseg-viewer canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .seqseg-panel { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); }
  .seqseg-group { display: grid; gap: 0.5rem; align-content: start; min-width: 0; }
  .seqseg-group h2 { font-size: 1.05rem; margin: 0; }
  .seqseg-group label { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; font-size: 0.95rem; margin: 0; }
  .seqseg-group input[type="number"], .seqseg-group select { width: 6rem; padding: 0.15rem 0.35rem; border: 1px solid var(--global-divider-color); border-radius: 6px; background: var(--global-card-bg-color); color: var(--global-text-color); }
  .seqseg-group p { margin: 0; font-size: 0.9rem; color: var(--global-text-color-light); }
  .seqseg-coord { font-variant-numeric: tabular-nums; font-size: 0.85rem; color: var(--global-text-color-light); min-height: 1.3em; overflow-wrap: anywhere; }
  .seqseg button, .seqseg-link { font: inherit; font-size: 0.95rem; padding: 0.35rem 0.75rem; border-radius: 6px; border: 1px solid var(--global-divider-color); background: var(--global-card-bg-color); color: var(--global-text-color); cursor: pointer; text-align: center; }
  .seqseg button:hover:not(:disabled), .seqseg-link:hover { border-color: var(--global-theme-color); color: var(--global-theme-color); }
  .seqseg button:disabled { opacity: 0.5; cursor: not-allowed; }
  .seqseg button.seqseg-primary { background: var(--global-theme-color); border-color: var(--global-theme-color); color: #fff; }
  .seqseg button.seqseg-primary:hover:not(:disabled) { background: var(--global-hover-color); color: #fff; }
  .seqseg-row { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .seqseg-status { margin: 0; }
  .seqseg-status:empty { display: none; }
  .seqseg-status.is-error { color: var(--global-danger-block-title); }
  .seqseg [hidden] { display: none !important; }
---

<div class="seqseg" id="seqseg" data-api="{{ site.seqseg_api_url }}">
  <div class="seqseg-notice">
    <p>This research demo is not for clinical use and has not been validated for diagnosis or treatment.</p>
    <p>Your scan stays in your browser. Only a box of up to 80 mm around the seed is uploaded, without the original file header. It is processed by a server and deleted within 15 minutes. Please upload only images you have the right to share, and no scans with identifying information burned in.</p>
  </div>

  <label class="seqseg-drop" id="seqseg-drop">
    <input type="file" id="seqseg-file" accept=".nii,.gz,.mha,.nrrd">
    <strong>Choose a coronary CT angiography scan</strong>
    <small>Or drop it here. NIfTI, MHA or NRRD.</small>
  </label>

  <p class="seqseg-status" id="seqseg-load-status" role="status"></p>

  <div class="seqseg-viewer" id="seqseg-viewer" hidden>
    <canvas id="seqseg-canvas" aria-label="CT scan viewer. Click a slice to move the crosshair."></canvas>
  </div>

  <div class="seqseg-panel" id="seqseg-panel" hidden>
    <div class="seqseg-group">
      <h2>1. Place the seed</h2>
      <p>Click a slice to move the crosshair onto the vessel, then set each point.</p>
      <button type="button" id="seqseg-set-start">Set start point</button>
      <div class="seqseg-coord" id="seqseg-start-text">Start: not set</div>
      <button type="button" id="seqseg-set-direction">Set direction point</button>
      <div class="seqseg-coord" id="seqseg-direction-text">Direction: not set</div>
    </div>
    <div class="seqseg-group">
      <h2>2. Settings</h2>
      <label>Vessel radius (mm)
        <input type="number" id="seqseg-radius" min="0.5" max="10" step="0.1" value="2">
      </label>
      <label>Steps
        <input type="number" id="seqseg-steps" min="1" max="20" step="1" value="5">
      </label>
      <label>Image units
        <select id="seqseg-unit">
          <option value="mm">mm</option>
          <option value="cm">cm</option>
        </select>
      </label>
    </div>
    <div class="seqseg-group">
      <h2>3. Run</h2>
      <button type="button" class="seqseg-primary" id="seqseg-run" disabled>Trace vessel</button>
      <p class="seqseg-status" id="seqseg-status" role="status"></p>
    </div>
    <div class="seqseg-group" id="seqseg-result" hidden>
      <h2>Result</h2>
      <p id="seqseg-summary"></p>
      <div class="seqseg-row">
        <button type="button" id="seqseg-toggle-view">Show 3D</button>
        <button type="button" id="seqseg-toggle-ct" hidden>Hide CT</button>
      </div>
      <div class="seqseg-row">
        <a class="seqseg-link" id="seqseg-download-mask">Mask (.nii.gz)</a>
        <a class="seqseg-link" id="seqseg-download-mesh">Mesh (.vtp)</a>
      </div>
    </div>
  </div>
</div>

<script type="module" src="{{ '/assets/js/seqseg-tool.js' | relative_url }}"></script>
