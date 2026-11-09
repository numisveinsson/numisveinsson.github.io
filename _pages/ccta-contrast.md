---
layout: page
title: CCTA contrast
permalink: /tools/ccta-contrast/
description: Measure aortic root attenuation, noise and SNR in a coronary CT angiogram, right in your browser.
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
  #snr-summary.is-error { color: var(--global-danger-block-title); }
  .snr-ref { display: block; font-weight: normal; color: var(--global-text-color-light); font-size: 0.85rem; }
---

<div class="seqseg" id="snr" data-example="{{ '/assets/data/seqseg_example.nii.gz' | relative_url }}" data-core="{{ '/assets/js/iqa-core.js' | relative_url }}?v=1">
  <div class="seqseg-notice">
    <p>This research tool is not for clinical use and has not been validated for diagnosis or treatment.</p>
  </div>

  <p>Click inside the aortic root, just above the valve, and the tool measures how bright the contrast is and how noisy the image is there. It finds the contrast-filled lumen near your click, grows a region inside it, keeps the part at least 3 mm from the wall within 12 mm of the lumen centre, and reports the median HU, the noise (a robust standard deviation) and their ratio.</p>

  <label class="seqseg-drop" id="snr-drop">
    <input type="file" id="snr-file" accept=".nii,.gz,.mha,.nrrd">
    <strong>Choose a coronary CT angiography scan</strong>
    <small>Or drop it here. NIfTI, MHA or NRRD, in Hounsfield units.</small>
  </label>

  <p class="seqseg-example">No scan? <button type="button" id="snr-example">Try an example scan</button></p>

  <p class="seqseg-status" id="snr-load-status" role="status"></p>

  <div class="seqseg-viewer" id="snr-viewer" hidden>
    <canvas id="snr-canvas" aria-label="CT scan viewer. Click a slice to move the crosshair."></canvas>
  </div>

  <div class="seqseg-panel" id="snr-panel" hidden>
    <div class="seqseg-group">
      <h2>1. Click the aortic root</h2>
      <p>Move the crosshair into the bright aortic root, then measure.</p>
      <label>Image units
        <select id="snr-unit">
          <option value="mm">mm</option>
          <option value="cm">cm</option>
        </select>
      </label>
      <button type="button" class="seqseg-primary" id="snr-run">Measure here</button>
      <p class="seqseg-status" id="snr-status" role="status"></p>
    </div>
    <div class="seqseg-group" id="snr-result" hidden>
      <h2>Result</h2>
      <table class="snr-table">
        <tbody>
          <tr><th scope="row">Lumen attenuation<span class="snr-ref" id="snr-hu-ref"></span></th><td id="snr-hu"></td></tr>
          <tr><th scope="row">Noise<span class="snr-ref" id="snr-noise-ref"></span></th><td id="snr-noise"></td></tr>
          <tr><th scope="row">SNR<span class="snr-ref" id="snr-snr-ref"></span></th><td id="snr-snr"></td></tr>
        </tbody>
      </table>
      <p id="snr-summary"></p>
      <div class="seqseg-row">
        <button type="button" id="snr-copy">Copy as JSON</button>
      </div>
    </div>
  </div>
</div>

<p class="seqseg-credit">The comparison under each value places it among 158 scans from the test set of the CAS-X coronary CT dataset, measured the same way. It is not a quality threshold, and the tool gives no pass or fail. Noise and SNR depend on the scanner, dose and reconstruction kernel, so compare scans from similar protocols.</p>
<p class="seqseg-credit">The measurement runs on your computer, and this tool does not upload your scan. The page does load code from outside services, and the site uses Google Analytics, so please do not use it with identifiable patient data.</p>
<p class="seqseg-credit">Example scan: cropped from case 0066_H_CORO_H of the <a href="https://www.vascularmodel.com">Vascular Model Repository</a> (Wilson, Ortiz and Johnson, J. Med. Devices 7(4), 2013), provided for research and development use. See its <a href="{{ '/assets/data/seqseg_example_LICENSE.txt' | relative_url }}">license</a>. The data was provided in whole or in part with Federal funds from the National Library of Medicine under Grant No. R01LM013120, and the National Heart, Lung, and Blood Institute, National Institutes of Health, Department of Health and Human Services, under Contract No. HHSN268201100035C. Viewer: <a href="https://github.com/niivue/niivue">NiiVue</a>.</p>

<script id="snr-reference" type="application/json">{"median_hu":[322.0,339.0,342.0,343.0,344.0,358.0,362.0,363.0,363.0,363.0,364.0,365.0,367.0,370.0,373.0,376.0,380.0,381.0,387.0,389.0,390.0,391.0,393.0,393.0,394.0,395.0,398.0,399.0,401.0,401.0,401.0,403.0,405.0,414.0,414.0,415.0,416.0,421.0,421.0,422.0,427.0,431.0,434.0,435.0,438.0,440.0,441.0,441.0,442.0,443.0,444.0,445.0,448.0,448.0,449.0,449.0,451.0,453.0,453.0,456.0,457.0,457.0,457.0,461.0,463.0,463.0,466.0,466.0,466.0,467.0,471.0,471.0,474.0,474.0,474.0,480.0,482.0,482.0,482.0,485.0,486.0,488.0,488.0,500.0,500.0,500.0,502.0,503.0,503.0,503.0,503.0,504.0,505.0,510.0,512.0,512.0,513.0,516.0,516.0,517.0,518.0,519.0,519.0,519.0,522.0,537.0,537.0,537.0,540.0,544.0,544.0,546.0,546.0,548.0,552.0,552.0,553.0,554.0,554.0,554.0,555.0,556.0,557.0,559.0,559.0,560.0,562.0,571.0,571.0,571.0,573.0,577.0,583.0,585.0,594.0,594.0,602.0,602.0,602.0,607.0,615.0,619.0,624.0,629.0,645.0,662.0,668.0,669.0,676.0,681.0,708.0,734.0,739.0,744.0,801.0,827.0,849.0,882.0],"noise_sd":[22.2,22.2,23.7,23.7,23.7,23.7,23.7,25.2,25.2,25.2,25.2,25.2,25.2,25.2,25.2,25.2,26.7,26.7,26.7,26.7,26.7,26.7,26.7,26.7,26.7,26.7,26.7,26.7,26.7,28.2,28.2,28.2,28.2,28.2,28.2,28.2,28.2,28.2,28.2,28.2,28.2,28.2,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.7,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,32.6,32.6,32.6,32.6,32.6,32.6,32.6,32.6,32.6,32.6,32.6,32.6,32.6,32.6,32.6,34.1,34.1,34.1,34.1,34.1,34.1,34.1,34.1,34.1,34.1,34.1,34.1,35.6,35.6,35.6,35.6,35.6,35.6,35.6,37.1,37.1,37.1,37.1,37.1,37.1,38.5,38.5,38.5,38.5,38.5,38.5,38.5,38.5,38.5,40.0,40.0,40.0,40.0,40.0,41.5,41.5,41.5,41.5,41.5,41.5,41.5,43.0,43.0,43.0,44.5,44.5,44.5,44.5,44.5,44.5,47.4,48.9,50.4,50.4,51.9,51.9,53.4,54.9,54.9,59.3,59.3],"snr":[8.2,9.1,10.1,10.3,10.5,10.7,10.9,10.9,10.9,11.3,11.4,11.5,11.6,11.7,12.0,12.1,12.1,12.1,12.2,12.2,12.3,12.4,12.5,12.5,12.5,12.7,12.8,12.8,12.9,12.9,12.9,12.9,12.9,13.0,13.0,13.0,13.0,13.0,13.0,13.1,13.1,13.2,13.4,13.4,13.5,13.5,13.6,13.7,13.8,13.8,13.8,13.8,13.9,13.9,14.0,14.0,14.0,14.0,14.1,14.1,14.1,14.2,14.2,14.3,14.3,14.3,14.3,14.3,14.4,14.4,14.8,14.8,14.8,14.9,15.0,15.0,15.0,15.0,15.1,15.1,15.1,15.2,15.2,15.3,15.3,15.4,15.4,15.4,15.5,15.5,15.5,15.6,15.6,15.7,15.7,15.7,15.7,15.9,15.9,15.9,15.9,15.9,16.0,16.0,16.1,16.1,16.2,16.2,16.2,16.2,16.3,16.3,16.4,16.4,16.4,16.4,16.5,16.5,16.5,16.6,16.6,16.6,16.7,16.7,16.8,16.8,16.8,16.8,16.9,17.0,17.1,17.1,17.2,17.3,17.3,17.4,17.5,17.5,17.5,17.5,17.6,17.7,17.8,17.8,17.8,18.0,18.4,18.4,18.6,18.6,18.6,18.7,18.8,18.9,19.2,19.8,21.0,22.3]}</script>
<script type="module" src="{{ '/assets/js/ccta-contrast.js' | relative_url }}?v=1"></script>
