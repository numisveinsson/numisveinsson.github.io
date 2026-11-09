---
layout: page
title: CCTA contrast
permalink: /tools/ccta-contrast/
description: Measure aortic root attenuation, noise, SNR and CNR, and trace the coronaries to measure contrast along them, right in your browser.
nav: true
nav_order: 3.6
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
  .seqseg + .seqseg-credit { margin-top: 1.5rem; }
  .seqseg [hidden] { display: none !important; }
  .seqseg-example { margin: -0.5rem 0 0; text-align: center; color: var(--global-text-color-light); }
  .seqseg-credit { margin: 0.5rem 0 0; font-size: 0.85rem; color: var(--global-text-color-light); }
  .seqseg .snr-table { display: table; width: 100%; border-collapse: collapse; font-size: 0.95rem; font-variant-numeric: tabular-nums; }
  .snr-table th, .snr-table td { text-align: left; padding: 0.3rem 0.5rem 0.3rem 0; border-bottom: 1px solid var(--global-divider-color); }
  .snr-table td { text-align: right; white-space: nowrap; font-size: 1.05rem; }
  #snr-summary.is-error, #snr-coronary-notes { color: var(--global-danger-block-title); }
  .seqseg .snr-vessels th, .seqseg .snr-vessels td { padding-right: 0.6rem; }
  .seqseg .snr-vessels thead th { font-size: 0.85rem; color: var(--global-text-color-light); font-weight: normal; }
  .seqseg .snr-vessels thead th:nth-child(n+3) { text-align: right; }
  .seqseg .snr-vessels td:first-of-type { text-align: left; color: var(--global-text-color-light); }
  .seqseg .snr-vessels tr:not(.snr-vessel-end) td, .seqseg .snr-vessels tr:not(.snr-vessel-end) th[rowspan] { border-bottom-color: transparent; }
  .seqseg .snr-vessels th[rowspan] { vertical-align: top; }
  .snr-chart { position: relative; margin: 1rem 0 0; }
  .snr-chart figcaption { font-weight: 600; font-size: 0.95rem; }
  .snr-chart svg { width: 100%; height: auto; display: block; font-size: 11px; fill: var(--global-text-color-light); touch-action: pan-y; }
  .snr-chart .grid { stroke: var(--global-divider-color); }
  .snr-chart .third { stroke: var(--global-divider-color); stroke-dasharray: 2 3; }
  .snr-chart .aorta { stroke: var(--global-text-color-light); stroke-dasharray: 5 4; stroke-width: 1.5; }
  .snr-chart .lumen { fill: none; stroke: var(--global-theme-color); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
  .snr-chart .calcium { stroke: var(--global-warning-block-title); stroke-width: 2.5; }
  .snr-chart .cursor { stroke: var(--global-text-color-light); }
  .snr-chart .dot { fill: var(--global-theme-color); stroke: var(--global-bg-color); stroke-width: 2; }
  .snr-tip { position: absolute; top: 1.6rem; background: var(--global-card-bg-color); color: var(--global-text-color); border: 1px solid var(--global-divider-color); border-radius: 6px; padding: 0.2rem 0.45rem; font-size: 0.8rem; pointer-events: none; max-width: 17rem; }
  .snr-key { font-size: 0.85rem; color: var(--global-text-color-light); }
  .snr-lede { margin: 0; }
  .snr-how summary { cursor: pointer; color: var(--global-theme-color); }
  .snr-how[open] summary { margin-bottom: 0.5rem; }
  .snr-how p { font-size: 0.95rem; }
  .snr-stage { display: grid; gap: 0.5rem; }
  .snr-tools { display: grid; gap: 0.6rem; border: 1px solid var(--global-divider-color); border-radius: 10px; padding: 0.75rem 0.9rem; }
  .snr-scan-info { font-size: 0.85rem; color: var(--global-text-color-light); font-variant-numeric: tabular-nums; padding-bottom: 0.5rem; border-bottom: 1px solid var(--global-divider-color); }
  .snr-window { display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; margin-top: 0.5rem; }
  .snr-window label { display: flex; align-items: center; gap: 0.35rem; margin: 0; }
  .snr-window select, .snr-window input { padding: 0.15rem 0.35rem; border: 1px solid var(--global-divider-color); border-radius: 6px; background: var(--global-card-bg-color); color: var(--global-text-color); font: inherit; }
  .snr-window input { width: 5.5rem; }
  .snr-scan-warning { margin: 0.35rem 0 0; color: var(--global-danger-block-title); font-variant-numeric: normal; }
  .snr-hint { margin: 0; font-size: 0.85rem; color: var(--global-text-color-light); }
  .snr-steps { display: grid; gap: 0.45rem; }
  .snr-step { display: grid; grid-template-columns: 9.5rem 1fr minmax(0, auto); align-items: center; gap: 0.5rem 0.75rem; }
  .snr-step-name { font-weight: 600; font-size: 0.95rem; }
  .snr-step-actions { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .snr-step-actions button { min-width: 6.5rem; }
  .snr-step-actions button.is-set::before { content: "✓ "; }
  .snr-chip { font-size: 0.85rem; color: var(--global-text-color-light); font-variant-numeric: tabular-nums; text-align: right; }
  .snr-chip.is-done { color: var(--global-text-color); }
  .snr-chip.is-warning { color: var(--global-danger-block-title); }
  .snr-trace-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; padding-top: 0.6rem; border-top: 1px solid var(--global-divider-color); }
  .snr-unit { margin: 0 0 0 auto; display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; color: var(--global-text-color-light); }
  .snr-unit select { padding: 0.15rem 0.35rem; border: 1px solid var(--global-divider-color); border-radius: 6px; background: var(--global-card-bg-color); color: var(--global-text-color); }
  .snr-tools .seqseg-status { font-size: 0.9rem; }
  @media (max-width: 560px) {
    .snr-step { grid-template-columns: 1fr auto; }
    .snr-step-actions { grid-column: 1 / -1; grid-row: 2; }
    .snr-step-actions button { flex: 1; }
    .snr-unit { margin-left: 0; }
  }
  .snr-quality { border: 1px solid var(--global-divider-color); border-radius: 10px; padding: 0.75rem 1rem; margin-bottom: 1rem; }
  .snr-quality-label { color: var(--global-text-color-light); }
  #snr-quality-score { font-size: 1.6rem; font-variant-numeric: tabular-nums; margin: 0 0.4rem; }
  #snr-quality-status { font-weight: 600; }
  #snr-quality-status[data-status="manual review"], #snr-quality-status[data-status="cannot score"] { color: var(--global-danger-block-title); }
  #snr-quality-reasons { margin: 0.25rem 0 0; padding-left: 1.2rem; font-size: 0.9rem; }
  #snr-quality-reasons:empty { display: none; }
  .snr-quality .snr-key { margin: 0.25rem 0 0; }
  .snr-flag { color: var(--global-danger-block-title); cursor: help; }
  .seqseg .snr-vessels td.snr-band-note { text-align: left; color: var(--global-text-color-light); font-size: 0.85rem; white-space: normal; }
  .snr-key .swatch { display: inline-block; width: 1.1rem; height: 0; border-top: 2px solid var(--global-theme-color); vertical-align: middle; margin-right: 0.25rem; }
  .snr-key .swatch.aorta { border-top: 2px dashed var(--global-text-color-light); }
  .snr-key .swatch.calcium { width: 3px; height: 0.8rem; border: 0; background: var(--global-warning-block-title); }
  .snr-ref { display: block; font-weight: normal; color: var(--global-text-color-light); font-size: 0.85rem; }
---

<div class="seqseg" id="snr" data-example="{{ '/assets/data/seqseg_example.nii.gz' | relative_url }}" data-core="{{ '/assets/js/iqa-core.js' | relative_url }}?v=7" data-model="{{ '/assets/models/seqseg_coronary.onnx' | relative_url }}" data-worker="{{ '/assets/js/seqseg-worker.js' | relative_url }}?v=4" data-tracer="{{ '/assets/js/seqseg-tracer.js' | relative_url }}?v=2">
  <div class="seqseg-notice">
    <p>This research tool is not for clinical use and has not been validated for diagnosis or treatment.</p>
  </div>

  <p class="snr-lede">Measure contrast and noise in a coronary CT angiogram. Click the aortic root, some fat and the coronary origins, and the tool reports SNR, CNR, contrast along each coronary and a provisional quality score. It all runs in your browser.</p>

  <details class="snr-how">
    <summary>How it works</summary>
  <p>Click inside the aortic root, just above the valve, and the tool measures how bright the contrast is and how noisy the image is there. It finds the contrast-filled lumen near your click, grows a region inside it, keeps the part at least 3 mm from the wall within 12 mm of the lumen centre, and reports the median HU, the noise (a robust standard deviation) and their ratio, the SNR.</p>
  <p>Then click fat for the contrast-to-noise ratio. Epicardial fat beside a proximal coronary artery is the usual choice, since that is the contrast a reader sees around the vessel. The tool takes the patch of fat (−190 to −30 HU) connected to your click within 5 mm, trims 1 mm off its edges, and reports its median HU. CNR is the lumen HU minus the fat HU, divided by the aortic noise.</p>
  <p>For each coronary, set a start point at its origin from the aorta and a direction point a few millimetres down the vessel. SeqSeg then traces up to 80 steps down the left coronary and 40 down the right, with at most 40 steps on any one branch, and the tool samples the lumen every millimetre along the left main, LAD, LCx and RCA. You can trace one coronary or both.</p>
  </details>

  <label class="seqseg-drop" id="snr-drop">
    <input type="file" id="snr-file" accept=".nii,.gz,.mha,.nrrd">
    <strong>Choose a coronary CT angiography scan</strong>
    <small>Or drop it here. NIfTI, MHA or NRRD, in Hounsfield units.</small>
  </label>

  <p class="seqseg-example">No scan? <button type="button" id="snr-example">Try an example scan</button></p>

  <p class="seqseg-status" id="snr-load-status" role="status"></p>

  <div class="snr-stage">
    <div class="seqseg-viewer" id="snr-viewer" hidden>
      <canvas id="snr-canvas" aria-label="CT scan viewer. Click a slice to move the crosshair."></canvas>
    </div>

    <div class="snr-tools" id="snr-panel" hidden>
      <div class="snr-scan-info">
        <span id="snr-scan-info"></span>
        <p class="snr-scan-warning" id="snr-scan-warning" role="alert" hidden></p>
        <div class="snr-window">
          <label>Window
            <select id="snr-window-preset">
              <option value="vessels">Vessels</option>
              <option value="soft">Soft tissue</option>
              <option value="fat">Fat</option>
              <option value="calcium">Calcium</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label>Level <input type="number" id="snr-window-level" step="10"> HU</label>
          <label>Width <input type="number" id="snr-window-width" min="1" step="10"> HU</label>
        </div>
      </div>
      <p class="snr-hint">Click a slice to move the crosshair, then press a button to use that point. Shift-drag on the image to change the window: up and down for level, left and right for width.</p>
      <div class="snr-steps">
        <div class="snr-step">
          <span class="snr-step-name">1. Aortic root</span>
          <div class="snr-step-actions"><button type="button" class="seqseg-primary" id="snr-run-aorta">Measure aorta</button></div>
          <span class="snr-chip" id="snr-chip-aorta">not measured</span>
        </div>
        <div class="snr-step">
          <span class="snr-step-name">2. Fat</span>
          <div class="snr-step-actions"><button type="button" id="snr-run-fat">Measure fat</button></div>
          <span class="snr-chip" id="snr-chip-fat">optional, for CNR</span>
        </div>
        <div class="snr-step">
          <span class="snr-step-name">3. Left coronary</span>
          <div class="snr-step-actions"><button type="button" id="snr-set-left">Start</button><button type="button" id="snr-set-leftNext">Direction</button></div>
          <span class="snr-chip" id="snr-chip-left">not set</span>
        </div>
        <div class="snr-step">
          <span class="snr-step-name">4. Right coronary</span>
          <div class="snr-step-actions"><button type="button" id="snr-set-right">Start</button><button type="button" id="snr-set-rightNext">Direction</button></div>
          <span class="snr-chip" id="snr-chip-right">not set</span>
        </div>
      </div>
      <div class="snr-trace-row">
        <button type="button" class="seqseg-primary" id="snr-trace" disabled>Trace and measure</button>
        <button type="button" id="snr-stop" hidden>Stop</button>
        <label class="snr-unit">Image units
          <select id="snr-unit">
            <option value="mm">mm</option>
            <option value="cm">cm</option>
          </select>
        </label>
      </div>
      <p class="seqseg-status" id="snr-status" role="status"></p>
      <p class="seqseg-status" id="snr-trace-hint"></p>
      <p class="seqseg-status" id="snr-trace-status" role="status"></p>
    </div>
  </div>

  <div class="seqseg-group" id="snr-result" hidden>
    <h2>Aortic root and fat</h2>
    <table class="snr-table">
      <tbody>
        <tr data-snr-row="aorta"><th scope="row">Lumen attenuation<span class="snr-ref" id="snr-hu-ref"></span></th><td id="snr-hu"></td></tr>
        <tr data-snr-row="aorta"><th scope="row">Noise<span class="snr-ref" id="snr-noise-ref"></span></th><td id="snr-noise"></td></tr>
        <tr data-snr-row="aorta"><th scope="row">SNR<span class="snr-ref" id="snr-snr-ref"></span></th><td id="snr-snr"></td></tr>
        <tr data-snr-row="fat"><th scope="row">Fat attenuation</th><td id="snr-fat"></td></tr>
        <tr data-snr-row="cnr"><th scope="row">CNR<span class="snr-ref">Lumen minus fat, over aortic noise</span></th><td id="snr-cnr"></td></tr>
      </tbody>
    </table>
    <p id="snr-summary"></p>
    <div class="seqseg-row">
      <button type="button" id="snr-copy">Copy as JSON</button>
    </div>
  </div>

  <div class="seqseg-group" id="snr-coronary" hidden>
  <div id="snr-coronary-result" hidden>
    <h2>Coronary arteries</h2>
    <div class="snr-quality">
      <div><span class="snr-quality-label">Quality score</span> <strong id="snr-quality-score"></strong> <span id="snr-quality-status"></span></div>
      <p class="snr-key">Provisional. It rates contrast and noise for segmentation, from thresholds that are not yet validated. Motion and other artifacts are not measured.</p>
      <ul id="snr-quality-reasons"></ul>
    </div>
    <table class="snr-table snr-vessels">
      <thead><tr><th scope="col">Vessel</th><th scope="col">Segment</th><th scope="col">HU</th><th scope="col">Ratio</th><th scope="col">SNR</th><th scope="col">CNR</th><th scope="col">Score</th></tr></thead>
      <tbody id="snr-vessel-rows"></tbody>
    </table>
    <p id="snr-calcium"></p>
    <p id="snr-coronary-notes" hidden></p>
    <p class="snr-key"><span class="swatch"></span>lumen HU <span class="swatch aorta"></span>aortic HU <span class="swatch calcium"></span>calcium. Dotted lines mark 40 and 80 mm from the origin. Hover or tap a chart for the values at that point.</p>
    <div id="snr-charts"></div>
    <p class="snr-key">Each segment is 0 to 40, 40 to 80 or beyond 80 mm from the vessel origin, and its HU is the median lumen HU over its millimetres, leaving out calcified and very thin parts. Ratio is that over the aortic HU, SNR is that over the aortic noise, and CNR is that minus the median perivascular fat (a 1 to 3 mm shell around the lumen), over the aortic noise. A segment's score is 0.4 × CNR part + 0.3 × noise part + 0.3 × lumen part, each from 0 to 1 and linear between its limits. Aortic noise scores 1 at 20 HU or less and 0 above 45 HU. CNR falls along a healthy vessel, so it scores 0 below 10, 8 and 5 and 1 from 20, 16 and 12 in the 0 to 40, 40 to 80 and 80+ mm segments. Lumen HU scores 0 at 150 HU and 1 from 250 HU, the coronary opacification that the <a href="https://www.journalofcardiovascularct.com/article/S1934-5925(16)30239-8/fulltext">SCCT 2016 acquisition guideline</a> calls optimal, with no upper limit. A segment is marked as possibly non-diagnostic, in the spirit of the <a href="https://radiologyassistant.nl/cardiovascular/cad-rads/coronary-artery-disease-reporting-and-data-system">CAD-RADS 2.0</a> N modifier, when its lumen is below 150 HU, its CNR is below its floor, at least half of it is calcified (blooming), or it has a focal HU dip (possible motion). Hover over the mark to see why. A vessel's score weights its segments 0.4, 0.35 and 0.25, over the segments that could be measured, and needs at least the first 40 mm. The scan score is 0.6 × the weakest vessel + 0.4 × the mean. A possibly non-diagnostic segment, a vessel that could not be assessed, or aortic noise above 45 HU sends the scan to manual review. Calcium is flagged where voxels within 1.5 mm of the centreline exceed the brighter of the aortic HU and the nearby lumen HU (a running median over 20 mm) by 4 aortic noise SDs. With these step limits the traces may not reach the distal segment, and missing segments are left out of the score rather than counted as 0.</p>
  </div>
  </div>
</div>

<p class="seqseg-credit">The comparison under the aortic values places each among 158 scans from the test set of the CAS-X coronary CT dataset, measured the same way. CNR has no such comparison yet, because it depends on where the fat click goes. That comparison is not a quality threshold. Noise and SNR depend on the scanner, dose and reconstruction kernel, so compare scans from similar protocols.</p>
<p class="seqseg-credit">The measurement runs on your computer, and this tool does not upload your scan. The page does load code from outside services, and the site uses Google Analytics, so please do not use it with identifiable patient data.</p>
<p class="seqseg-credit">Example scan: cropped from case 0066_H_CORO_H of the <a href="https://www.vascularmodel.com">Vascular Model Repository</a> (Wilson, Ortiz and Johnson, J. Med. Devices 7(4), 2013), provided for research and development use. See its <a href="{{ '/assets/data/seqseg_example_LICENSE.txt' | relative_url }}">license</a>. The data was provided in whole or in part with Federal funds from the National Library of Medicine under Grant No. R01LM013120, and the National Heart, Lung, and Blood Institute, National Institutes of Health, Department of Health and Human Services, under Contract No. HHSN268201100035C. Viewer: <a href="https://github.com/niivue/niivue">NiiVue</a>.</p>
<p class="seqseg-credit">Coronary tracing uses the browser version of <a href="{{ '/tools/seqseg/' | relative_url }}">SeqSeg</a> with the <a href="https://doi.org/10.5281/zenodo.23813298">SeqSeg nnU-Net weights for CT coronary segmentation</a> (CC BY 4.0), run with <a href="https://onnxruntime.ai">ONNX Runtime</a>. Method: <a href="https://doi.org/10.1007/s10439-024-03611-z">Sveinsson Cepero and Shadden, Annals of Biomedical Engineering, 2024</a>.</p>

<script id="snr-reference" type="application/json">{"median_hu":[322.0,339.0,342.0,343.0,344.0,358.0,362.0,363.0,363.0,363.0,364.0,365.0,367.0,370.0,373.0,376.0,380.0,381.0,387.0,389.0,390.0,391.0,393.0,393.0,394.0,395.0,398.0,399.0,401.0,401.0,401.0,403.0,405.0,414.0,414.0,415.0,416.0,421.0,421.0,422.0,427.0,431.0,434.0,435.0,438.0,440.0,441.0,441.0,442.0,443.0,444.0,445.0,448.0,448.0,449.0,449.0,451.0,453.0,453.0,456.0,457.0,457.0,457.0,461.0,463.0,463.0,466.0,466.0,466.0,467.0,471.0,471.0,474.0,474.0,474.0,480.0,482.0,482.0,482.0,485.0,486.0,488.0,488.0,500.0,500.0,500.0,502.0,503.0,503.0,503.0,503.0,504.0,505.0,510.0,512.0,512.0,513.0,516.0,516.0,517.0,518.0,519.0,519.0,519.0,522.0,537.0,537.0,537.0,540.0,544.0,544.0,546.0,546.0,548.0,552.0,552.0,553.0,554.0,554.0,554.0,555.0,556.0,557.0,559.0,559.0,560.0,562.0,571.0,571.0,571.0,573.0,577.0,583.0,585.0,594.0,594.0,602.0,602.0,602.0,607.0,615.0,619.0,624.0,629.0,645.0,662.0,668.0,669.0,676.0,681.0,708.0,734.0,739.0,744.0,801.0,827.0,849.0,882.0],"noise_sd":[22.2,22.2,23.7,23.7,23.7,23.7,23.7,25.2,25.2,25.2,25.2,25.2,25.2,25.2,25.2,25.2,26.7,26.7,26.7,26.7,26.7,26.7,26.7,26.7,26.7,26.7,26.7,26.7,26.7,28.2,28.2,28.2,28.2,28.2,28.2,28.2,28.2,28.2,28.2,28.2,28.2,28.2,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.7,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,32.6,32.6,32.6,32.6,32.6,32.6,32.6,32.6,32.6,32.6,32.6,32.6,32.6,32.6,32.6,34.1,34.1,34.1,34.1,34.1,34.1,34.1,34.1,34.1,34.1,34.1,34.1,35.6,35.6,35.6,35.6,35.6,35.6,35.6,37.1,37.1,37.1,37.1,37.1,37.1,38.5,38.5,38.5,38.5,38.5,38.5,38.5,38.5,38.5,40.0,40.0,40.0,40.0,40.0,41.5,41.5,41.5,41.5,41.5,41.5,41.5,43.0,43.0,43.0,44.5,44.5,44.5,44.5,44.5,44.5,47.4,48.9,50.4,50.4,51.9,51.9,53.4,54.9,54.9,59.3,59.3],"snr":[8.2,9.1,10.1,10.3,10.5,10.7,10.9,10.9,10.9,11.3,11.4,11.5,11.6,11.7,12.0,12.1,12.1,12.1,12.2,12.2,12.3,12.4,12.5,12.5,12.5,12.7,12.8,12.8,12.9,12.9,12.9,12.9,12.9,13.0,13.0,13.0,13.0,13.0,13.0,13.1,13.1,13.2,13.4,13.4,13.5,13.5,13.6,13.7,13.8,13.8,13.8,13.8,13.9,13.9,14.0,14.0,14.0,14.0,14.1,14.1,14.1,14.2,14.2,14.3,14.3,14.3,14.3,14.3,14.4,14.4,14.8,14.8,14.8,14.9,15.0,15.0,15.0,15.0,15.1,15.1,15.1,15.2,15.2,15.3,15.3,15.4,15.4,15.4,15.5,15.5,15.5,15.6,15.6,15.7,15.7,15.7,15.7,15.9,15.9,15.9,15.9,15.9,16.0,16.0,16.1,16.1,16.2,16.2,16.2,16.2,16.3,16.3,16.4,16.4,16.4,16.4,16.5,16.5,16.5,16.6,16.6,16.6,16.7,16.7,16.8,16.8,16.8,16.8,16.9,17.0,17.1,17.1,17.2,17.3,17.3,17.4,17.5,17.5,17.5,17.5,17.6,17.7,17.8,17.8,17.8,18.0,18.4,18.4,18.6,18.6,18.6,18.7,18.8,18.9,19.2,19.8,21.0,22.3]}</script>
<script type="module" src="{{ '/assets/js/ccta-contrast.js' | relative_url }}?v=19"></script>
