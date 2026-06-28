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
      "assets": {
        "model": { "path": "model/miku/model.pmx", "kind": "pmx", "required": true },
        "motion": { "path": "motion/getcha.vmd", "kind": "vmd", "required": true },
        "audio": { "path": "music/getcha.mp3", "kind": "audio", "required": false }
      }
    }
  ]
}
```

For WebKit packaging, the wrapper should grant read access to this folder or rewrite `assetRoot` to a wrapper-provided local URL.
