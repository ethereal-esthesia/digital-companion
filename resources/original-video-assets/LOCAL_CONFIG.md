# Local Config

Real assets should live under the ignored folder:

`local-resources/original-video-assets/`

The app reads:

`local-resources/original-video-assets/config.json`

Use [config.example.json](config.example.json) as the tracked template. The local config supports one or more scenes:

```json
{
  "version": 1,
  "assetRoot": "/local-resources/original-video-assets/",
  "activeScene": "getcha-local",
  "scenes": [
    {
      "id": "getcha-local",
      "title": "GETCHA local assets",
      "activeModelPreset": "miku",
      "modelPresets": [
        { "id": "miku", "label": "Miku", "path": "model/miku/model.pmx", "kind": "pmx", "required": true },
        { "id": "sameko-saba", "label": "Sameko Saba", "path": "model/sameko-saba/model.pmx", "kind": "pmx", "required": false }
      ],
      "assets": {
        "model": { "path": "model/miku/model.pmx", "kind": "pmx", "required": true },
        "motion": { "path": "motion/getcha.vmd", "kind": "vmd", "required": true },
        "audio": { "path": "music/getcha.mp3", "kind": "audio", "required": false }
      }
    }
  ]
}
```

`assets.model` remains supported for old configs. When `modelPresets` is present, the selected preset is loaded instead; change it with `?modelPreset=some-id` or the in-app model dropdown.

## Auto-discovered model folders

For quick local model testing, create one folder per character under:

`local-resources/original-video-assets/model/vrm-samples/`

Each immediate child folder should contain a `.vrm`, `.pmx`, or `.pmd` file somewhere inside it. When the Vite dev or preview server starts, those folders are exposed at `/local-model-presets.json` and merged into the model dropdown. The folder name becomes the dropdown label.

For WebKit packaging, the wrapper should grant read access to this folder or rewrite `assetRoot` to a wrapper-provided local URL.
