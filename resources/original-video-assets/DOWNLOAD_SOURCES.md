# Download Sources

Real files should be downloaded into the ignored folder:

`local-resources/original-video-assets/`

Run:

```sh
npm run resources:download
```

To open the manual/auth pages in your browser:

```sh
npm run resources:open-manual
```

The script downloads public metadata and reference images automatically. It does not bypass logins, passwords, CAPTCHAs, cloud-drive flows, or unclear audio/model/motion redistribution terms.

## Read First

The script writes this ignored local text file:

`local-resources/original-video-assets/READ_FIRST_SOURCE_DESCRIPTIONS.txt`

Read it before opening gated source downloads. It gathers original source descriptions, password clues, cloud-drive codes, and any discovered downloaded readme/license file paths.

## Automatic

| Item | Destination |
| --- | --- |
| Source Bilibili metadata | `local-resources/original-video-assets/sources/bilibili-BV1MsZtYCE4t.json` |
| RedialC node-tree metadata | `local-resources/original-video-assets/sources/` |
| Source cover image | `local-resources/original-video-assets/references/source-cover.jpg` |
| Source first frame | `local-resources/original-video-assets/references/source-first-frame.jpg` |

## Manual / Gated

| Item | Source | Why manual |
| --- | --- | --- |
| Model: `つみ式ミクさんv2.1` | https://bowlroll.net/file/112578 | Requires BowlRoll login and bundled README review. |
| Model preset: `Sameko Saba 3D Model` | https://www.deviantart.com/xxsnowcherryxx/art/MMD-VRChat-Sameko-Saba-3D-Model-Download-1231830604 | Creator listing points to paid/manual BOOTH and Patreon sources; bundled terms need review. |
| Motion/camera/facial: `GETCHA!` | https://bowlroll.net/file/261196 | Requires Nico/BowlRoll password flow; terms restrict use to MMD/MMD-derived tools. |
| Music/off-vocal | https://xfs.jp/jxHc3C | Audio rights are not cleared for bundling/redistribution. |
| Stage: `新场景 - HZ-D` | No public download found | YouTube mirror says `尚未公配`, not publicly distributed. |
| `RC皮肤预设V402` node tree | https://share.weiyun.com/OdFDVd2n | Cloud-drive flow and bundled terms need manual review. |
| `RC选色抠图节点组` node tree | https://pan.baidu.com/s/16P_Cc98hESoPUkhXCBttPQ?pwd=qbtv | Cloud-drive flow and bundled terms need manual review. |
