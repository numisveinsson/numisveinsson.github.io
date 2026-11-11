---
layout: page
title: Scan check
permalink: /tools/scan-check/
description: Check any CT or MRI scan for basic quality problems, such as missing or clipped values, empty or duplicate slices, thick or tilted slices, cut-off anatomy, noise and metal, right in your browser.
nav: false
_styles: |
  .seqseg { display: grid; gap: 1.25rem; }
  .seqseg-notice { border-left: 3px solid var(--global-theme-color); padding: 0.5rem 0 0.5rem 1rem; color: var(--global-text-color-light); font-size: 0.95rem; }
  .seqseg-notice p { margin: 0; }
  .seqseg-drop { display: block; border: 1.5px dashed var(--global-divider-color); border-radius: 10px; padding: 1.5rem; text-align: center; cursor: pointer; }
  .seqseg-drop:hover, .seqseg-drop.is-over, .seqseg-drop:focus-within { border-color: var(--global-theme-color); }
  .seqseg-drop input { position: absolute; opacity: 0; width: 1px; height: 1px; }
  .seqseg-drop small { display: block; color: var(--global-text-color-light); }
  .seqseg-viewer { position: relative; background: #000; border-radius: 10px; overflow: hidden; aspect-ratio: 4 / 3; max-height: 75vh; width: 100%; }
  .seqseg-viewer canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .seqseg button { font: inherit; font-size: 0.95rem; padding: 0.35rem 0.75rem; border-radius: 6px; border: 1px solid var(--global-divider-color); background: var(--global-card-bg-color); color: var(--global-text-color); cursor: pointer; }
  .seqseg button:hover:not(:disabled) { border-color: var(--global-theme-color); color: var(--global-theme-color); }
  .seqseg button:disabled { opacity: 0.5; cursor: not-allowed; }
  .seqseg-status { margin: 0; }
  .seqseg-status:empty { display: none; }
  .seqseg-status.is-error { color: var(--global-danger-block-title); }
  .seqseg [hidden] { display: none !important; }
  .seqseg-example { margin: -0.5rem 0 0; text-align: center; color: var(--global-text-color-light); }
  .seqseg-credit { margin: 0.5rem 0 0; font-size: 0.85rem; color: var(--global-text-color-light); }
  .seqseg + .seqseg-credit { margin-top: 1.5rem; }
  .sc-how summary { cursor: pointer; color: var(--global-theme-color); }
  .sc-how[open] summary { margin-bottom: 0.5rem; }
  .sc-how p { font-size: 0.95rem; }
  .sc-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 1rem; font-size: 0.9rem; color: var(--global-text-color-light); font-variant-numeric: tabular-nums; }
  .sc-bar label { display: flex; align-items: center; gap: 0.35rem; margin: 0; }
  .sc-bar select { padding: 0.15rem 0.35rem; border: 1px solid var(--global-divider-color); border-radius: 6px; background: var(--global-card-bg-color); color: var(--global-text-color); font: inherit; }
  .sc-bar .sc-file { color: var(--global-text-color); font-weight: 600; overflow-wrap: anywhere; }
  .sc-result { border: 1px solid var(--global-divider-color); border-radius: 10px; padding: 0.9rem 1.1rem; display: grid; gap: 0.75rem; }
  .sc-verdict { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.25rem 0.75rem; }
  .sc-verdict strong { font-size: 1.25rem; }
  .sc-verdict[data-level="pass"] strong { color: var(--global-theme-color); }
  .sc-verdict[data-level="warn"] strong { color: var(--global-warning-block-title); }
  .sc-verdict[data-level="fail"] strong { color: var(--global-danger-block-title); }
  .sc-verdict p { margin: 0; flex-basis: 100%; }
  .sc-checks { list-style: none; margin: 0; padding: 0; }
  .sc-check { display: grid; grid-template-columns: 1.4rem 1fr auto; gap: 0.15rem 0.6rem; padding: 0.55rem 0; border-top: 1px solid var(--global-divider-color); align-items: baseline; }
  .sc-icon { font-weight: 700; text-align: center; }
  .sc-check[data-status="pass"] .sc-icon { color: var(--global-theme-color); }
  .sc-check[data-status="warn"] .sc-icon { color: var(--global-warning-block-title); }
  .sc-check[data-status="fail"] .sc-icon { color: var(--global-danger-block-title); }
  .sc-check[data-status="skip"] .sc-icon, .sc-check[data-status="skip"] .sc-name { color: var(--global-text-color-light); }
  .sc-name { font-weight: 600; }
  .sc-value { font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
  .sc-detail { grid-column: 2 / -1; margin: 0; font-size: 0.9rem; color: var(--global-text-color-light); }
  .sc-detail button { font-size: 0.85rem; padding: 0.1rem 0.5rem; margin-left: 0.4rem; }
  .sc-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .sc-exams { display: grid; gap: 0.4rem; }
  .sc-exams h2 { font-size: 1.05rem; margin: 0; }
  .sc-exams p { margin: 0; font-size: 0.95rem; }
  .sc-exams ul { margin: 0; padding-left: 1.2rem; font-size: 0.95rem; }
  .sc-exams .sc-soon { color: var(--global-text-color-light); }
  .sc-roi { border: 1px solid var(--global-divider-color); border-radius: 10px; padding: 0.9rem 1.1rem; display: grid; gap: 0.6rem; }
  .sc-roi h2 { font-size: 1.05rem; margin: 0; }
  .sc-roi p { margin: 0; font-size: 0.9rem; color: var(--global-text-color-light); }
  .sc-step { display: grid; grid-template-columns: 7rem auto 1fr; align-items: center; gap: 0.5rem 0.75rem; }
  .sc-step-name { font-weight: 600; }
  .sc-step-name .sc-swatch { display: inline-block; width: 0.7rem; height: 0.7rem; border-radius: 2px; margin-right: 0.4rem; vertical-align: baseline; }
  .sc-chip { font-size: 0.85rem; color: var(--global-text-color-light); font-variant-numeric: tabular-nums; }
  .sc-roi-options { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; font-size: 0.9rem; color: var(--global-text-color-light); }
  .sc-roi-options label { display: flex; align-items: center; gap: 0.35rem; margin: 0; }
  .sc-roi-options select { padding: 0.15rem 0.35rem; border: 1px solid var(--global-divider-color); border-radius: 6px; background: var(--global-card-bg-color); color: var(--global-text-color); font: inherit; }
  .seqseg .sc-table { display: table; width: 100%; border-collapse: collapse; font-size: 0.95rem; font-variant-numeric: tabular-nums; }
  .sc-table th, .sc-table td { text-align: left; padding: 0.3rem 0.5rem 0.3rem 0; border-bottom: 1px solid var(--global-divider-color); }
  .sc-table th { font-weight: 600; }
  .sc-table td { text-align: right; white-space: nowrap; }
  .sc-table .sc-ref { display: block; font-weight: normal; color: var(--global-text-color-light); font-size: 0.85rem; }
  @media (max-width: 560px) {
    .sc-step { grid-template-columns: 1fr auto; }
    .sc-step .sc-chip { grid-column: 1 / -1; }
    .sc-check { grid-template-columns: 1.4rem 1fr; }
    .sc-value { grid-column: 2; text-align: left; white-space: normal; }
  }
---

<p class="tools-back"><a href="{{ '/tools/' | relative_url }}">← All tools</a></p>

<div class="seqseg" id="sc" data-example="{{ '/assets/data/seqseg_example.nii.gz' | relative_url }}" data-core="{{ '/assets/js/scan-checks.js' | relative_url }}?v=4">
  <div class="seqseg-notice">
    <p>This research tool is not for clinical use and has not been validated for diagnosis or treatment.</p>
  </div>

  <p>Load a CT or MRI scan and get a quick check for problems that make it a poor input for analysis: missing values, 8-bit exports or masks, values not in Hounsfield units or clipped, thick or tilted slices, empty or duplicate slices, sudden jumps between slices, anatomy cut off at the image edge, high noise and metal. No clicking on the image is needed, and the scan stays on your computer. To measure contrast, you can also click a signal and a background region and get SNR and CNR.</p>

  <details class="sc-how">
    <summary>How it works</summary>
    <p>These are general checks that apply to any scan. They do not find organs, so they cannot tell whether contrast was timed well or whether the patient moved. Exam-specific checks will add those.</p>
    <p><strong>Voxel size.</strong> Voxels up to 1.5 mm pass, up to 5 mm get a warning, and thicker ones fail. <strong>Orientation.</strong> The angle between each image axis and the nearest body axis, from the header; above 1° the scan is tilted (oblique), which some tools ignore. <strong>Missing values.</strong> Any voxel that is not a number or infinite fails. <strong>Distinct values.</strong> 16 or fewer different values look like a segmentation and fail; up to 256 look like an 8-bit export and get a warning. <strong>Hounsfield units</strong> (CT). Air should read about −1000 HU; the check takes the median of values between −1100 and −950 HU (lung, at about −870 HU, is left out) and passes it between −1030 and −960 HU. A scan whose lowest value fills a large share of the image above −950 HU has been clipped, as has one whose highest value is below 2000 HU and holds at least 0.05% of the voxels; a scan with no values below −200 is not in Hounsfield units. <strong>Value range</strong> (MRI). Values at the limits of a 16-bit integer mean the data overflowed, and many negative values mean it is not a magnitude image. <strong>Empty slices.</strong> Slices that hold a single value. More than 10% fails. <strong>Duplicate slices.</strong> A slice stored exactly the same as the one before it, which noise makes impossible in a real acquisition.</p>
    <p><strong>Sudden changes between slices.</strong> For each slice the tool takes the mean tissue value (−200 to 300 HU in CT, above the background in MRI) and the centre of the anatomy. Neighbouring slices are flagged when the mean jumps by more than 25 HU in CT (10% of the median signal in MRI) and well beyond the scan's usual change, or when the anatomy shifts by more than 5 mm without a matching change in area. <strong>Anatomy at the image edge.</strong> On up to 64 slices the tool keeps the largest connected region above −500 HU in CT (above an Otsu threshold in MRI) and warns when it covers more than 5% of an image edge on more than a quarter of them.</p>
    <p><strong>Noise</strong> (CT) is a global noise index: the most common standard deviation in windows of about 5 mm over soft tissue (0 to 100 HU) on up to 30 slices (<a href="https://doi.org/10.1148/radiol.14132563">Christianson et al., Radiology 2015</a>). It warns above 40 HU. <strong>Signal to noise</strong> (MRI) is the median tissue signal over the background noise. The noise is the most common value in the background at the outer edge of the image, which for magnitude images equals the Rayleigh noise level and ignores dark tissue there. It warns below 10 and is skipped when the background has been blanked. <strong>Very dense material</strong> (CT). Voxels above 3000 HU are metal or undiluted contrast in the vein it was injected into; the check warns from 3 mL.</p>
    <p><strong>Signal and background</strong> are optional points you choose. Around each, the tool takes the voxels within 1.5 mm, then grows a region from the point through connected voxels within 3 robust standard deviations of their median, up to the chosen radius, so it stops at the edge of the tissue. It reports the median and the robust standard deviation (1.4826 × the median absolute deviation) of each region. SNR is the signal median over the noise in the signal region, and CNR is the signal minus the background, over that same noise, as the <a href="{{ '/tools/ccta-contrast/' | relative_url }}">coronary CT page</a> does with the aorta and fat. In MRI, where coil combination and parallel imaging make noise vary across the image, noise measured inside the tissue is the more reliable choice. In CT, SNR depends on where 0 HU sits (water), so CNR is the more meaningful number.</p>
    <p>The thresholds are starting points, not validated limits. Noise in particular depends on dose, reconstruction kernel and slice thickness, so compare scans of the same protocol.</p>
  </details>

  <label class="seqseg-drop" id="sc-drop">
    <input type="file" id="sc-file" accept=".nii,.gz,.mha,.nrrd">
    <strong>Choose a CT or MRI scan</strong>
    <small>Or drop it here. NIfTI, MHA or NRRD. DICOM folders are not supported yet.</small>
  </label>

  <p class="seqseg-example">No scan? <button type="button" id="sc-example">Try an example scan</button></p>

  <p class="seqseg-status" id="sc-load-status" role="status"></p>

  <div class="sc-bar" id="sc-bar" hidden>
    <span class="sc-file" id="sc-file-name"></span>
    <label>Scan type
      <select id="sc-modality">
        <option value="auto">Detect</option>
        <option value="ct">CT</option>
        <option value="mr">MRI</option>
      </select>
    </label>
    <label>Image units
      <select id="sc-unit">
        <option value="mm">mm</option>
        <option value="cm">cm</option>
      </select>
    </label>
    <label>Window
      <select id="sc-window"></select>
    </label>
  </div>

  <div class="seqseg-viewer" id="sc-viewer" hidden>
    <canvas id="sc-canvas" aria-label="Scan viewer. Click a slice to move the crosshair."></canvas>
  </div>

  <div class="sc-result" id="sc-result" hidden>
    <div class="sc-verdict" id="sc-verdict">
      <strong id="sc-verdict-label"></strong>
      <span id="sc-verdict-kind" class="seqseg-credit"></span>
      <p id="sc-verdict-summary"></p>
    </div>
    <ul class="sc-checks" id="sc-checks"></ul>
    <div class="sc-actions">
      <button type="button" id="sc-copy">Copy as JSON</button>
    </div>
    <p class="seqseg-status" id="sc-status" role="status"></p>
  </div>

  <div class="sc-roi" id="sc-roi" hidden>
    <h2>Signal and background</h2>
    <p>To measure contrast, click a slice to move the crosshair into the tissue you want to see, then press Set signal. Do the same for the tissue it should stand out from and press Set background. The tool grows a uniform region of up to the chosen radius from each point, without crossing into other tissue.</p>
    <div class="sc-step">
      <span class="sc-step-name"><span class="sc-swatch" style="background: rgb(230, 60, 60)"></span>Signal</span>
      <button type="button" id="sc-set-signal">Set signal</button>
      <span class="sc-chip" id="sc-chip-signal">not set</span>
    </div>
    <div class="sc-step">
      <span class="sc-step-name"><span class="sc-swatch" style="background: rgb(40, 170, 255)"></span>Background</span>
      <button type="button" id="sc-set-background">Set background</button>
      <span class="sc-chip" id="sc-chip-background">not set</span>
    </div>
    <div class="sc-roi-options">
      <label>Region radius
        <select id="sc-radius">
          <option value="3">3 mm</option>
          <option value="5" selected>5 mm</option>
          <option value="10">10 mm</option>
          <option value="20">20 mm</option>
        </select>
      </label>
    </div>
    <table class="sc-table" id="sc-roi-table" hidden>
      <tbody>
        <tr data-roi-row="signal"><th scope="row">Signal<span class="sc-ref">Median in the red region</span></th><td id="sc-signal"></td></tr>
        <tr data-roi-row="signal"><th scope="row">Noise<span class="sc-ref">Robust SD in the red region</span></th><td id="sc-noise"></td></tr>
        <tr data-roi-row="background"><th scope="row">Background<span class="sc-ref">Median in the blue region</span></th><td id="sc-background"></td></tr>
        <tr data-roi-row="background"><th scope="row">Background noise<span class="sc-ref">Robust SD in the blue region</span></th><td id="sc-background-noise"></td></tr>
        <tr data-roi-row="signal"><th scope="row">SNR<span class="sc-ref">Signal over noise</span></th><td id="sc-snr"></td></tr>
        <tr data-roi-row="both"><th scope="row">CNR<span class="sc-ref">Signal minus background, over noise</span></th><td id="sc-cnr"></td></tr>
      </tbody>
    </table>
    <p class="seqseg-status" id="sc-roi-status" role="status"></p>
  </div>

  <div class="sc-exams">
    <h2>Exam-specific checks</h2>
    <p>Quality depends on what the scan is for, so each exam type needs its own checks.</p>
    <ul>
      <li><a href="{{ '/tools/ccta-contrast/' | relative_url }}">Coronary CT angiography</a>: contrast and noise in the aortic root and along the coronaries.</li>
      <li class="sc-soon">CT pulmonary angiography: contrast in the pulmonary arteries, bolus timing and breathing motion. Planned.</li>
      <li class="sc-soon">Abdomen CT: contrast phase and liver enhancement. Planned.</li>
      <li class="sc-soon">Brain MRI: motion, ghosting and tissue contrast. Planned.</li>
    </ul>
  </div>
</div>

<p class="seqseg-credit">The checks run on your computer, and this tool does not upload your scan. The page does load code from outside services, and the site uses Google Analytics, so please do not use it with identifiable patient data.</p>
<p class="seqseg-credit">Example scan: cropped from case 0066_H_CORO_H of the <a href="https://www.vascularmodel.com">Vascular Model Repository</a> (Wilson, Ortiz and Johnson, J. Med. Devices 7(4), 2013), provided for research and development use. See its <a href="{{ '/assets/data/seqseg_example_LICENSE.txt' | relative_url }}">license</a>. The data was provided in whole or in part with Federal funds from the National Library of Medicine under Grant No. R01LM013120, and the National Heart, Lung, and Blood Institute, National Institutes of Health, Department of Health and Human Services, under Contract No. HHSN268201100035C. Viewer: <a href="https://github.com/niivue/niivue">NiiVue</a>.</p>

<script type="module" src="{{ '/assets/js/scan-check.js' | relative_url }}?v=4"></script>
