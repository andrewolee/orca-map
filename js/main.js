// The Norway hydrophone is a real but unrelated outlier (see the project notes) --
// excluded here so the projection fits tightly around the Puget Sound cluster.
const EXCLUDED_HYDROPHONE_IDS = new Set(["rpi_lehmkuhl"]);

const svg = d3.select("#map");
const width = svg.node().getBoundingClientRect().width;
const height = svg.node().getBoundingClientRect().height;

d3.json("data/hydrophones.json").then((hydrophones) => {
  const visible = hydrophones.filter((h) => !EXCLUDED_HYDROPHONE_IDS.has(h.id));

  // Build a GeoJSON FeatureCollection so the projection can auto-fit to the
  // actual data bounds, rather than hand-picking a center/scale.
  const points = {
    type: "FeatureCollection",
    features: visible.map((h) => ({
      type: "Feature",
      properties: { id: h.id, name: h.name },
      geometry: { type: "Point", coordinates: [h.longitude, h.latitude] },
    })),
  };

  const projection = d3.geoMercator().fitExtent(
    [
      [40, 40],
      [width - 40, height - 40],
    ],
    points
  );

  const pathGenerator = d3.geoPath(projection);

  const pins = svg
    .selectAll(".hydrophone-pin")
    .data(points.features)
    .join("circle")
    .attr("class", "hydrophone-pin")
    .attr("r", 6)
    .attr("cx", (d) => projection(d.geometry.coordinates)[0])
    .attr("cy", (d) => projection(d.geometry.coordinates)[1]);

  svg
    .selectAll(".hydrophone-label")
    .data(points.features)
    .join("text")
    .attr("class", "hydrophone-label")
    .attr("x", (d) => projection(d.geometry.coordinates)[0] + 10)
    .attr("y", (d) => projection(d.geometry.coordinates)[1] + 4)
    .text((d) => d.properties.name);
});
