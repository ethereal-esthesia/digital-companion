# Motion

Place GETCHA dance motion files here, usually `.vmd`.

Place the official VRoid Project VRMA MotionPack under
`motion/vroid-project-vrma/VRMA_MotionPack/` if you want the VRM motion
dropdown to use the seven `.vrma` files from that pack. Keep the bundled
readmes beside the files.

Place locally converted Mixamo-to-VRMA files under
`motion/mixamo-vrma/`. The admin console auto-discovers `.vrma` files in
that folder, but Mixamo-derived raw motion files should stay local-only unless
a separate redistribution review clears public raw asset delivery.

Download the CMU Motion Capture Database ASF/AMC archive with:

```bash
npm run resources:download:cmu
```

The CMU downloader writes to `motion/cmu-mocap/`, saves source snapshots and
metadata, and leaves the archive unextracted and uninstalled.

Source credit:

- Motion: `GETCHA!`
- Creator: `apr(社会の窓P)`
- Link: https://www.nicovideo.jp/watch/sm39269321

VRMA source credit:

- Motion pack: `VRMA MotionPack`
- Creator: `pixiv Inc.'s VRoid Project`
- Link: https://booth.pm/items/5512385

Mixamo source:

- Service: Adobe Mixamo
- Link: https://www.mixamo.com/
- License notes: `MIXAMO_VRMA_LICENSE_NOTES.md`

CMU source:

- Dataset: CMU Graphics Lab Motion Capture Database
- Link: http://mocap.cs.cmu.edu/
- License notes: `CMU_MOCAP_LICENSE_NOTES.md`
