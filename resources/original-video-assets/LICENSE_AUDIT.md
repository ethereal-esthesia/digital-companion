# License Audit

Checked: 2026-07-04

This is a working rights/usage audit for the assets credited by the source video. It is not legal advice. Keep each downloaded asset's original README, license, and distribution page notes with the asset.

## Summary

| Asset | Current status | Practical rule for this project |
| --- | --- | --- |
| Source Bilibili video | Reference only | Do not reupload or redistribute the source video. Bilibili metadata marks `no_reprint: 1`. |
| Stage: `新场景 - HZ-D` | Unknown | Source video names the stage but gives no distribution link. Find original source and terms before import. |
| Model: `つみ式ミクさんv2.1` | Needs bundled README/license | BowlRoll page confirms file `つみ式ミクさんv2.1.zip`, but download requires login and public page does not show terms. Inspect bundled readme before using. |
| Model preset: `Sameko Saba 3D Model` | Paid/manual, needs terms review | Public listing points to BOOTH/Patreon downloads for PMX/VRM/Blend/VRChat formats. Purchase/access manually, inspect bundled terms, and do not redistribute. |
| Model preset: `Sameko Saba / Fan Made 3D VRChat Avatar` | Paid/manual, local-only pending terms review | BOOTH download includes VRM/Unity/FBX/Blend/textures. Preserve locally, do not redistribute, and treat as personal/demo only until seller terms are reviewed. |
| Motion/camera/facial: `GETCHA! - apr(社会の窓P)` | Restricted | Noncommercial MMD/MMD-derived-tool use appears allowed with credits. Direct Three.js/web use needs permission or clarification. |
| Motion: `VRMA MotionPack` by VRoid Project | Local app playback allowed | Load from ignored local resources. Do not commit/bundle extractable `.vrma` files without a redistribution review. |
| Motion: Mixamo-derived `.vrma` | Project use allowed, raw redistribution not cleared | Use locally from `motion/mixamo-vrma/`. Do not commit or expose raw converted `.vrma` files as public downloadable assets without a separate review. |
| Motion dataset: CMU Motion Capture Database | Free to include in products | May be copied, modified, redistributed, and included in commercial products with attribution; do not resell the data directly, even in converted form. |
| Music: `GETCHA!` by Giga/KIRA | No reuse license found | Do not bundle the recording or instrumental unless a clear license/permission is obtained. Link/reference only for now. |
| Choreography: 足太ぺんた `GETCHA!` dance | Credit dependency | apr terms require crediting the choreography/trace source when using the motion. |
| Node tree: `RC皮肤预设V402` | Terms not found in description | Download page is linked, but no explicit reuse/redistribution terms were found in the Bilibili description. Inspect bundled files. |
| Node tree: `RC选色抠图节点组` | Terms not found in description | Download page is linked, but no explicit reuse/redistribution terms were found in the Bilibili description. Inspect bundled files. |
| Blender | GPL | Blender itself is GPL; rendered outputs/assets keep their own licenses. |
| mmd_tools / Cats | GPL-family depending on fork | Tool licenses do not grant rights to third-party models, motions, stages, or music. |

## Key Findings

### Motion, camera, and facial files

apr's online terms are the strongest source found. They require credit for the song/artist, choreography or trace source, and motion author. They forbid commercial use, redistribution/transfer/sale of the motion, sharing download/extract passwords, claiming authorship, sexual/violent/hate/political/religious uses, and uses outside MMD and MMD-derived tools.

That last point matters for this app: loading the VMD directly in a Three.js web runtime is not clearly allowed. Treat real VMD import into this app as blocked until we either keep it inside an MMD/Blender-derived workflow or get permission/clarification from apr.

Sources:

- https://www.nicovideo.jp/watch/sm39269321
- https://bowlroll.net/file/261196
- https://apr-mmd.hatenablog.jp/entry/ar384801
- https://www.nicovideo.jp/watch/sm38028810

### VRM Animation pack

The official VRoid Project `VRMA MotionPack` contains seven `.vrma` files: Show full body, Greeting, Peace sign, Shoot, Spin, Model pose, and Squat. The BOOTH page and bundled readmes allow customization and broad use, including commercial use with credit, subject to prohibited-use restrictions. They prohibit distributing the motions or altered motions in a riggable or extractable form without permission.

This app may load the files from ignored local resources for development/demo playback. Do not commit the extracted `.vrma` files or ship a public bundle that exposes them as downloadable assets without checking the current BOOTH terms again.

Sources:

- https://booth.pm/items/5512385
- Bundled `Readme_VRMA_MotionPack_EN.txt`

### Mixamo-derived VRMA motions

Adobe's Mixamo FAQ says Mixamo is free with an Adobe ID and that Mixamo characters and animations may be used royalty-free in personal, commercial, and non-profit projects, including films and video games.

That is enough for local development and for using Mixamo-derived motion as integrated app/game/video content. It is not a clear standalone redistribution grant for raw `.fbx`, `.vrma`, or converted motion packs. In this app, public static `.vrma` files are directly fetchable, so converted Mixamo files should stay under ignored local resources unless a separate review clears that delivery model.

Sources:

- https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html
- https://www.mixamo.com/

### CMU Motion Capture Database

The official CMU page allows inclusion of the data in commercially sold products and forbids reselling the data directly, even in converted form. The FAQ says the motion capture data may be copied, modified, or redistributed without permission. CMU requests attribution for published results.

This makes CMU a better source for shippable motion data than Mixamo when we need raw downloadable web assets, provided the app is not just reselling a converted data pack and attribution is included.

Sources:

- http://mocap.cs.cmu.edu/
- http://mocap.cs.cmu.edu/faqs.php
- http://mocap.cs.cmu.edu/info.php

### Model

The credited model is `つみ式ミクさんv2.1 - つみだんご`. The Nico description points to BowlRoll file `112578`, and the public BowlRoll page confirms file name and size. The BowlRoll page currently requires login for download and does not expose the bundled license text publicly. The original archive README must be inspected before importing.

Because this is a Hatsune Miku model, character rights may also involve Crypton/Piapro terms. Do not assume the model README alone covers all public/commercial uses.

Sources:

- https://www.nicovideo.jp/watch/sm29503530
- https://bowlroll.net/file/112578
- https://piapro.net/license

### Model preset: Sameko Saba

The requested reference video is `【MMD】Sameko Saba (GIMMExGIMME [Cover])`. The likely model source is the xxSnowCherryxx/SnowCherry listing for `Sameko Saba 3D Model`, which advertises MMD `.pmx`, VRM, Blender, FBX, and VRChat formats and points to BOOTH/Patreon sources. The BOOTH item is a paid downloadable product. Treat this as manual-only and do not automate purchase/download.

This is a fanart/source-character model, so both the 3D model creator's terms and any underlying character/rightsholder terms may matter. Keep the original purchase/download terms and bundled readme beside the local model.

Sources:

- https://www.youtube.com/watch?v=ZqR6xMDtOJU
- https://www.deviantart.com/xxsnowcherryxx/art/MMD-VRChat-Sameko-Saba-3D-Model-Download-1231830604
- https://xsnowcherry.booth.pm/items/7323959
- https://www.patreon.com/posts/vtuber-sameko-3-136835269

### Model preset: Sameko Saba Abakat VRM

The Abakat_VT BOOTH listing is a paid fan-made VRChat avatar package. The public listing describes a VRChat prefab and a VRM model, and the local archive includes VRM, Unity package, FBX, Blend, and texture files. The extracted archive inspected here did not include a separate top-level README/license file, so the BOOTH listing and any seller terms visible at purchase time are the current authority.

Use this preset for local personal/demo testing only. Do not redistribute the downloaded files, converted files, textures, Unity package, or extracted parts from this repo or app bundle.

Sources:

- https://booth.pm/ja/items/7211882
- https://abakat.booth.pm/items/7211882

### Music

The motion source credits `Giga & KIRA - GETCHA! ft. 初音ミク & GUMI`, with streaming links and an `OffVocal & Vocals` link in the Nico description. These links are not a blanket license to redistribute audio in this repo or app.

For now, keep music as an external reference only. If we add audio, use a locally licensed/approved source and document that permission beside the file.

Sources:

- https://www.nicovideo.jp/watch/sm37467451
- https://lnk.to/aAWfxznZ

### Node Trees

The Bilibili descriptions provide download links but no explicit license text. The videos are marked `no_reprint: 1` in Bilibili metadata. Treat the node-group files as usable only after checking bundled terms or obtaining permission.

Sources:

- https://www.bilibili.com/video/BV19A411u7MG
- https://www.bilibili.com/video/BV1A3411V79D

### Stage

The stage is credited as `新场景 - HZ-D`, but no source URL was listed in the source video's description. We need to identify the original distribution page and terms before importing or redistributing it.

Source:

- https://www.bilibili.com/video/BV1MsZtYCE4t/

## Import Rules

1. Do not commit downloaded third-party asset archives unless their terms permit redistribution.
2. Keep each asset's original readme/license file beside the asset.
3. Put real downloaded assets under `local-resources/original-video-assets/`, which is ignored by git.
4. Treat direct Three.js use of apr's VMD as blocked until clarified.
5. Keep the procedural recreation as the public-safe fallback.
