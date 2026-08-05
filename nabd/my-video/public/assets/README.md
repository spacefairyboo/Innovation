# Visual asset placeholders (optional)

The entire ad renders from code — no images are required. If you want to
replace any programmatic visual with real footage or artwork, these are the
swap points and suggested filenames:

| Placeholder file | Replaces | Where |
| --- | --- | --- |
| `city-loop.mp4` | The programmatic skyline + rain outside the car window | `Scene1Morning.tsx`, `Scene2Listening.tsx` — swap the `<Sky>/<CityLayer>/<RainOnGlass>` block for `<Video src={staticFile("assets/city-loop.mp4")} />` (from `@remotion/media`) |
| `manager.png` | The illustrated manager figure | `Scene1Morning.tsx`, `Scene2Listening.tsx`, `Scene4Arrival.tsx` — replace `<Person …/>` with `<CanvasImage src={staticFile("assets/manager.png")} …/>` |
| `office-hallway.png` | The imagined-hallway backdrop | `Scene1Morning.tsx` → `ImaginedHallway` |
| `workplace-*.png` (office, warehouse, construction, retail, remote, field) | Panel backdrops | `Scene3Team.tsx` → `WorkplacePanel` background gradient |
| `office-interior.png` | The arrival office wide shot | `Scene4Arrival.tsx` background block |
| `echo-logo.svg` | The programmatic logo mark | `src/components/ui/index.tsx` → `EchoMark` |

Keep replacements in this `public/assets/` folder and reference them with
`staticFile("assets/<name>")`.
