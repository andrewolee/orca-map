# orca-map

A map of the Puget Sound hydrophone network, prototyped as a standalone
visualization. Pins mark each hydrophone; the goal is for a pin to change
color when that hydrophone detects a southern resident killer whale (SRKW)
call, with a time-scrubber to move through detection history.

Hydrophone and detection data comes from
[OrcaHello](https://github.com/orcasound/orcahello)'s public API
(`/api/detections`) — this project is not affiliated with Orcasound, just
built against their public data.

## Status

Early prototype. Hydrophone pins render on a D3-projected map with name
labels; no coastline, bathymetry, or live detection data yet.

## Running locally

Static site, no build step. Serve the directory and open it in a browser:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Stack

- [D3.js](https://d3js.org/) v7, vendored locally in `vendor/` (no CDN,
  no runtime network dependency beyond OrcaHello's API)
- Static GeoJSON/JSON data baked in at `data/` — no live fetching except
  detections

## Roadmap

- [ ] Coastline (NOAA GSHHG, clipped to the Salish Sea)
- [ ] Place-name labels
- [ ] Bathymetry
- [ ] Live detection polling + pin state changes
- [ ] Time-scrubber
