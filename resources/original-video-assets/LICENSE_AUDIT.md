# License Audit

Checked: 2026-06-28

This is a working rights/usage audit for the assets credited by the source video. It is not legal advice. Keep each downloaded asset's original README, license, and distribution page notes with the asset.

## Summary

| Asset | Current status | Practical rule for this project |
| --- | --- | --- |
| Source Bilibili video | Reference only | Do not reupload or redistribute the source video. Bilibili metadata marks `no_reprint: 1`. |
| Stage: `新场景 - HZ-D` | Unknown | Source video names the stage but gives no distribution link. Find original source and terms before import. |
| Model: `つみ式ミクさんv2.1` | Needs bundled README/license | BowlRoll page confirms file `つみ式ミクさんv2.1.zip`, but download requires login and public page does not show terms. Inspect bundled readme before using. |
| Motion/camera/facial: `GETCHA! - apr(社会の窓P)` | Restricted | Noncommercial MMD/MMD-derived-tool use appears allowed with credits. Direct Three.js/web use needs permission or clarification. |
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

### Model

The credited model is `つみ式ミクさんv2.1 - つみだんご`. The Nico description points to BowlRoll file `112578`, and the public BowlRoll page confirms file name and size. The BowlRoll page currently requires login for download and does not expose the bundled license text publicly. The original archive README must be inspected before importing.

Because this is a Hatsune Miku model, character rights may also involve Crypton/Piapro terms. Do not assume the model README alone covers all public/commercial uses.

Sources:

- https://www.nicovideo.jp/watch/sm29503530
- https://bowlroll.net/file/112578
- https://piapro.net/license

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
