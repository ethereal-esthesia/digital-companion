# Original Video Assets

This folder is for the real assets credited by the source MMD video:

- Source video: https://www.bilibili.com/video/BV1MsZtYCE4t/
- Title: `油管上100万播放的MMD - MikuのGETCHA 其一`
- Creator/final render: `jza233`
- Duration: 75 seconds
- Source resolution: 3840 x 2160

The files are not bundled here. Many MMD resources have redistribution rules, so put real downloaded assets in the ignored local folder:

`local-resources/original-video-assets/`

Keep original readmes/licenses with any asset files you add there.

Start with [LICENSE_AUDIT.md](LICENSE_AUDIT.md) before downloading or importing anything. Several resources are reference-only or need bundled README/license review before they can be used in the app.

## Credited Resources

| Type | Credit | Link / Notes |
| --- | --- | --- |
| Stage | `新场景 - HZ-D` | No source link listed in the Bilibili description |
| Music | `初音ミク,GUMI,ギガP - GETCHA!` | Use only with appropriate audio rights |
| Model | `つみ式ミクさんv2.1 - つみだんご` | https://www.nicovideo.jp/watch/sm29503530 |
| Motion | `GETCHA! - apr(社会の窓P)` | https://www.nicovideo.jp/watch/sm39269321 |
| Camera | `GETCHA! - apr(社会の窓P)` | https://www.nicovideo.jp/watch/sm39269321 |
| Facial | `GETCHA! - apr(社会の窓P)` | https://www.nicovideo.jp/watch/sm39269321 |
| Render | Eevee | Blender render path used by the source video |
| Software | MikuMikuDance, Blender, Premiere Pro, SVFI | Listed by the source video |
| Plugins | Cats, MMDBridge Material Importer, MMD tool | Listed by the source video |
| NodeTree | `RC皮肤预设V402` | https://www.bilibili.com/video/BV19A411u7MG |
| NodeTree | `RC选色抠图节点组` | https://www.bilibili.com/video/BV1A3411V79D |

## Folder Map

- `model/`: notes for Miku model files such as `.pmx`, `.pmd`, textures, and model readmes.
- `stage/`: notes for HZ-D stage model, textures, and stage readmes.
- `motion/`: notes for dance motion files, usually `.vmd` or `.vrma`.
- `camera/`: notes for camera motion files, usually `.vmd`.
- `facial/`: notes for facial/lip motion files, usually `.vmd`.
- `music/`: notes for audio references or local working audio files.
- `nodetree/`: notes for Blender node-group references or `.blend` resources.
- `references/`: notes for cover image, first frame, screenshots, and visual notes.
- `software-notes/`: notes for import/export notes for MMD, Blender, plugins, and render settings.

## Import Plan

1. Add the model and its texture folder under `local-resources/original-video-assets/model/`.
2. Add the stage under `local-resources/original-video-assets/stage/`.
3. Add motion, camera, and facial VMD files under their matching `local-resources/original-video-assets/` folders.
4. Keep each downloaded asset's original README or license in the same folder as the asset.
5. Wire the app to load local files from these folders, falling back to the procedural recreation when files are missing.
