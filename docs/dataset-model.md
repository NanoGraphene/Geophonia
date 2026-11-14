# 2D dataset model and automatic sound mapping

The runtime has no dataset-ID branches for sampling, speech, units, source metadata, calibration, or audio mapping. The catalog supplies dataset names and manifest URLs. Each manifest supplies geography, ordered frames, feature decoding, units/calibration and recommended sound settings. Adding a compatible static source requires a manifest/catalog entry and prepared assets, not a new UI or synthesizer.

## Source contract

```json
{
  "id": "example-layer",
  "title": "Example layer",
  "credit": "Source attribution",
  "sourcePage": "https://example.org/source",
  "width": 360,
  "height": 180,
  "geo": {"projection": "equirectangular", "extent": [-180,-90,180,90]},
  "frames": [{"timestamp": null, "timeLabel": "2023 annual average", "local": "./frames/input.webp", "display": "./frames/input-mercator.webp"}],
  "feature": {"method": "brightness", "name": "Image brightness", "unit": "percent image brightness", "estimate": true},
  "valueScale": {"min": 0, "max": 100, "unit": "percent image brightness", "symbol": "%", "decimals": 1},
  "mapping": {"curve": "sqrt", "amplitude": "value"}
}
```

Supported image source projections are full/partial equirectangular and Web Mercator, with explicit geographic extent. `local` is the original-resolution sampling raster after any verified preprocessing/crop. `display` is a corresponding full-world Mercator image. Source margins/overlays must be cropped or masked, never implicitly sampled. `masks` contains excluded `[left,top,right,bottom]` source-pixel rectangles. Current NASA preparation scripts produce full-world, nearest-neighbor Mercator displays; they do not infer camera geometry from arbitrary images. Image profiles with regional coverage require a correctly positioned full-world display raster; the numeric-grid renderer positions regional grids automatically.

`timestamp` is an actual verified ISO scientific timestamp, not movie playback time. `timeLabel` preserves annual averages, intervals and unverified dates. Real timestamps are spoken as UTC; a year is never silently converted to January 1. A one-frame dataset disables time stepping. Animation-frame labels do not imply verified scientific dates.

Feature decoders:

- `palette`: nearest RGB matching or normalized chromatic matching against `feature.paletteUrl`; the palette order must be meaningful. Optional `background` rejection and maximum RGB distance prevent neutral backgrounds from becoming data. Palette values convert through `valueScale`.
- `brightness`: mean normalized sRGB-weighted luminance, explicitly a visual index. Dark/black is valid zero, not missing.
- `categories`: explicit named `categories` with hue intervals. Select one category; its matched color strength and neighborhood coverage are sampled. Categories are never ranked as concentrations. Overlap, lighting and compositing can contaminate visual matching.
- `grid`: finite numeric values, with null/missing cells preserved. Units come from the user/source. Geographic cells use explicit coverage and, for imported grids, exact regular cell centers.

Calibration supports min/max linear scales, positive logarithmic scales, and nonuniform `anchors:[{position,value}]`. Anchors are interpolated linearly or logarithmically as specified. This matters for CO's uneven ticks and PM2.5/NOx logarithmic legends. Image estimates convert the mean matched palette position; they are not authoritative means of underlying scientific measurements. NASA image profiles set `estimate:true`; local numeric grids set `estimate:false` and remain explicitly user-supplied.

A sample returns `{value,measurement,density,intensity,validity,matchedPixels,totalPixels,pixel}`. `value` is normalized feature position, `measurement` retains source units, `density` is feature/valid-cell coverage, and `intensity` is image brightness when available. Missing/outside-coverage samples use null values and silent data tone. Valid zero remains valid and is spoken as zero. Neighborhoods wrap only for full-longitude coverage; regional grids cannot wrap onto their opposite edge.

## Automatic mapping and overrides

Static profiles recommend a meaningful source range, linear/log/square-root response, and amplitude channel. Imported CSVs automatically detect the minimum/maximum of all finite values across **every frame**. Constant datasets receive a padded audio range. Ranges never refit during cursor or time movement.

Pitch is an exponential interpolation between the user's low/high Hz endpoints, driven by the normalized selected value. Amplitude follows feature/valid-cell coverage, mapped value, or image brightness. Main volume caps gain; transitions remain smoothed by the audio engine. “Amplitude modulation” here means continuously changing output gain from data, not an additional audible tremolo oscillator.

The Audio mapping panel exposes value range, curve and amplitude channel. Clipping is explicit and fixed across time. Restore automatic mapping returns to source/all-frame defaults. Per-dataset overrides remain in tab memory. Changing a mapping changes sound, not the displayed/spoken source value or unit. Pitch Hz endpoints remain configurable in the audio panel.

## Local CSV import

Files stay in memory in the current browser tab. No CSV content is sent to a server. Speech follows the selected system/browser voice's own network behavior.

Choose a regular geographic grid CSV (up to 16 MB / two million total cells), confirm inferred latitude, longitude, value and optional time columns, and supply units/no-data marker if needed. Quoted fields/newlines, sparse missing cells and valid zeros are supported. At least two regularly spaced cell centers per axis are required. Duplicate cells, invalid numbers, irregular grids and excessive size reject with actionable text. Reproject/regrid other coordinate systems or scattered observations before importing; GeoTIFF, NetCDF, arbitrary screenshots and 3D views are not parsed by this importer.

The importer sorts real ISO timestamps, calendar dates or annual labels, computes one complete-sequence range, preserves exact cell centers when geographic edges clip, and renders values into the same Mercator world as NASA layers. Missing/outside coverage is transparent over a separate Natural Earth basemap. Sahara/Atlantic/Paris test points preserve the selected dataset. “Go to dataset center” helps locate a regional grid without changing position automatically on dataset/time selection. Imported datasets are lost when the tab reloads. The downloadable CSV is clearly synthetic demo data, not a NASA observation.

## Verification boundaries

Automated checks cover units/calibration, clipping/curves/amplitude channels, coordinate transforms, raster placement, real NASA source patches, city-light alignment checkpoints, annual/unverified date precision, CSV schema and temporal normalization, cancellation/race handling, and all earlier map/audio regressions. Browser, subjective listening, fullscreen layout and assistive-technology verification remain pending because browser-control tooling is unavailable in this managed environment.
