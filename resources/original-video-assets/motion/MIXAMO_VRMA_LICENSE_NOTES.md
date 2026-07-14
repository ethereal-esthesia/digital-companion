# License Notes: Mixamo to VRMA

Asset class: Mixamo-derived animation files converted to VRM Animation (`.vrma`)

Source: Adobe Mixamo

Status: local development/import lane only; do not commit or ship raw converted motion files as standalone downloadable assets.

## Sources Checked

- Adobe Mixamo FAQ: https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html
- Adobe Mixamo: https://www.mixamo.com/

## Current Reading

Adobe's Mixamo FAQ says Mixamo is free with an Adobe ID and that characters and animations may be used royalty-free for personal, commercial, and non-profit projects, including films and video games.

The FAQ is enough to treat Mixamo animations as usable in a larger creative app/game/video project. It does not clearly grant permission to redistribute raw Mixamo animations, or converted raw animation assets, as standalone downloadable asset files.

## Project Rule

- Put converted Mixamo `.vrma` files under `local-resources/original-video-assets/motion/mixamo-vrma/`.
- The admin console auto-discovers those local `.vrma` files for VRM model playback.
- Do not commit Mixamo `.fbx`, `.vrma`, converted files, or bulk animation packs to this repo.
- Do not include Mixamo-derived `.vrma` files in a public static demo bundle while they are directly fetchable as reusable animation assets.
- A shipped product may use Mixamo-derived animation as integrated project content, but public raw asset redistribution needs separate review.

## Conversion Notes

Keep the original Mixamo download metadata and conversion notes beside each converted file. Recommended local layout:

```text
local-resources/original-video-assets/motion/mixamo-vrma/
  idle/
    idle.vrma
    README_LOCAL.txt
```

`README_LOCAL.txt` should include the original Mixamo animation name, download date, Adobe account/source URL if useful, conversion tool/version, and any edits.
