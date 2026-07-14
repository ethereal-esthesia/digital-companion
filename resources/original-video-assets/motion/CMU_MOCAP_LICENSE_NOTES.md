# License Notes: CMU Motion Capture Database

Asset class: Carnegie Mellon University Graphics Lab Motion Capture Database

Status: free to include in products, modify, copy, and redistribute; do not resell the data directly, even in converted form.

## Sources Checked

- CMU Motion Capture Database home: http://mocap.cs.cmu.edu/
- CMU Motion Capture Database FAQ: http://mocap.cs.cmu.edu/faqs.php
- CMU Motion Capture info: http://mocap.cs.cmu.edu/info.php

## Current Reading

The CMU home page states that the data is free for research projects and may be included in commercially sold products, but may not be resold directly, even in converted form.

The FAQ states that the motion capture data may be copied, modified, or redistributed without permission.

CMU requests attribution when publishing results.

## Required / Recommended Attribution

Use this attribution when shipping or publishing results based on the dataset:

```text
The data used in this project was obtained from mocap.cs.cmu.edu.
The database was created with funding from NSF EIA-0196217.
```

## Project Rule

- `npm run resources:download:cmu` downloads the official `allasfamc.zip` archive to the ignored local resources folder.
- The downloaded archive is not extracted and is not wired into the app config by default.
- Converted CMU motions may be shipped as part of the larger app/product with attribution, provided the product is not simply reselling the CMU data or a converted motion pack.
- Keep conversion scripts, file mappings, and attribution with any converted subset that is added later.
