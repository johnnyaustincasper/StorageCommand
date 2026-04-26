import { useEffect, useMemo, useRef, useState } from "react";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || "";

const P = {
  bg: "#fefefe", card: "#ffffff", border: "#f0ece4",
  text: "#1a1714", sub: "#8c8378", muted: "#b8afa5",
  gold: "#c9a84c", goldLight: "#f5eed9", goldDark: "#8b7432",
  font: "'Cormorant Garamond', serif", fontBody: "'Nunito', sans-serif", radius: 12,
};

const STATUS_COLORS = {
  available: "#22c55e",
  occupied:  "#ef4444",
  reserved:  "#3b82f6",
  maintenance: "#f59e0b",
  overdue:   "#dc2626",
};

function Input({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: P.sub, marginBottom: 4, fontFamily: P.fontBody }}>{label}</label>}
      <input
        type={type} value={value || ""} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: "100%", padding: "11px 14px", borderRadius: 9, border: `1px solid ${P.border}`, background: P.card, fontSize: 15, color: P.text, fontFamily: P.fontBody, outline: "none", boxSizing: "border-box" }}
        onFocus={e => e.target.style.borderColor = P.gold}
        onBlur={e => e.target.style.borderColor = P.border}
      />
    </div>
  );
}

// ─── Unit Config Panel ────────────────────────────────────────────────────────
function UnitPanel({ unit, onUpdate, onDelete, onClose }) {
  const [label, setLabel] = useState(unit.label || "");
  const [status, setStatus] = useState(unit.status || "available");
  const [price, setPrice] = useState(unit.price || "");
  const [size, setSize] = useState(unit.size || "");

  const save = () => {
    onUpdate({ ...unit, label, status, price, size });
    onClose();
  };

  return (
    <div style={{
      position: "absolute", bottom: 80, left: "50%", transform: "translateX(-50%)",
      width: "calc(100% - 32px)", maxWidth: 420,
      background: P.card, borderRadius: 16, padding: 20,
      boxShadow: "0 8px 40px rgba(0,0,0,0.18)", border: `1px solid ${P.border}`,
      zIndex: 50, fontFamily: P.fontBody,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: P.text, fontFamily: P.font }}>Configure Unit</div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: P.muted }}>✕</button>
      </div>
      <Input label="Unit Label (e.g. A-01)" value={label} onChange={setLabel} placeholder="A-01" />
      <Input label="Size (e.g. 10×10)" value={size} onChange={setSize} placeholder="10×10" />
      <Input label="Monthly Price" value={price} onChange={setPrice} placeholder="99" type="number" />
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: P.sub, marginBottom: 6, fontFamily: P.fontBody }}>Status</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Object.entries(STATUS_COLORS).map(([k, v]) => (
            <button key={k} onClick={() => setStatus(k)} style={{
              padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontFamily: P.fontBody,
              fontSize: 11, fontWeight: 700, border: `1px solid ${status === k ? v : "rgba(0,0,0,0.1)"}`,
              background: status === k ? v + "18" : "transparent", color: status === k ? v : P.muted,
            }}>
              {k.charAt(0).toUpperCase() + k.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={save} style={{
          flex: 1, padding: "11px", borderRadius: 9, border: "none",
          background: `linear-gradient(135deg, ${P.gold}, #b8943f)`,
          color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: P.fontBody,
        }}>Save Unit</button>
        <button onClick={onDelete} style={{
          padding: "11px 16px", borderRadius: 9, border: `1px solid #ef4444`,
          background: "transparent", color: "#ef4444", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: P.fontBody,
        }}>Delete</button>
      </div>
    </div>
  );
}

// ─── Layout Draft Modal ───────────────────────────────────────────────────────
function LayoutDraftModal({ onClose, onAccept, suggestions }) {
  return (
    <div style={{
      position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{ background: P.card, borderRadius: 16, padding: 24, maxWidth: 420, width: "100%", fontFamily: P.fontBody }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: P.text, fontFamily: P.font, marginBottom: 8 }}>Layout Draft Ready</div>
        <div style={{ fontSize: 13, color: P.sub, marginBottom: 10, lineHeight: 1.5 }}>
          This is a simple template, not an AI scan. It places {suggestions.length} suggested units around the current map center so you can edit them from a truthful starting point.
        </div>
        <div style={{ fontSize: 12, color: P.muted, marginBottom: 16, lineHeight: 1.5 }}>
          Need exact placement? Draw unit boundaries manually instead.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 200, overflowY: "auto", marginBottom: 16 }}>
          {suggestions.map((s, i) => (
            <div key={i} style={{ padding: "10px 14px", borderRadius: 8, background: P.goldLight, border: `1px solid ${P.gold}30`, fontSize: 13 }}>
              <span style={{ fontWeight: 700 }}>{s.label}</span> — {s.size} · ${s.price}/mo
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => onAccept(suggestions)} style={{
            flex: 1, padding: "11px", borderRadius: 9, border: "none",
            background: `linear-gradient(135deg, ${P.gold}, #b8943f)`,
            color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: P.fontBody,
          }}>Add Draft Units</button>
          <button onClick={onClose} style={{
            padding: "11px 16px", borderRadius: 9, border: `1px solid ${P.border}`,
            background: P.card, color: P.sub, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: P.fontBody,
          }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Facility Builder ────────────────────────────────────────────────────
export default function FacilityBuilder({ onSave, onBack, existingUnits = [], facilityAddress = "" }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const draw = useRef(null);
  const mapboxglRef = useRef(null);
  const markersRef = useRef({});

  const [address, setAddress] = useState(facilityAddress);
  const [searching, setSearching] = useState(false);
  const [units, setUnits] = useState(existingUnits);
  const [, setSelectedId] = useState(null);
  const [editingUnit, setEditingUnit] = useState(null);
  const [mode, setMode] = useState("view"); // view | draw | draft
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftSuggestions, setDraftSuggestions] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [noToken] = useState(!MAPBOX_TOKEN);
  const [saveMessage, setSaveMessage] = useState("");

  const snapshot = useMemo(() => JSON.stringify({
    address: address.trim(),
    units: units.map(unit => ({ ...unit, price: Number(unit.price || 0) })),
  }), [address, units]);

  const initialSnapshot = useMemo(() => JSON.stringify({
    address: facilityAddress.trim(),
    units: existingUnits.map(unit => ({ ...unit, price: Number(unit.price || 0) })),
  }), [existingUnits, facilityAddress]);

  const hasUnsavedChanges = snapshot !== initialSnapshot;

  useEffect(() => {
    setSaveMessage("");
  }, [snapshot]);

  useEffect(() => {
    if (typeof window === "undefined" || !hasUnsavedChanges) return undefined;

    const beforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [hasUnsavedChanges]);

  const handleBack = () => {
    if (!hasUnsavedChanges || typeof window === "undefined" || window.confirm("Leave builder without saving? Your layout edits will be lost.")) {
      onBack?.();
    }
  };

  // Init map
  useEffect(() => {
    if (!MAPBOX_TOKEN || map.current) return;

    let active = true;

    const initMap = async () => {
      const [mapboxModule, drawModule] = await Promise.all([
        import("mapbox-gl"),
        import("@mapbox/mapbox-gl-draw"),
        import("mapbox-gl/dist/mapbox-gl.css"),
        import("@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css"),
      ]);

      if (!active || map.current || !mapContainer.current) return;

      const mapboxgl = mapboxModule.default;
      const MapboxDraw = drawModule.default;
      mapboxglRef.current = mapboxgl;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/satellite-streets-v12",
        center: [-95.9928, 36.154],
        zoom: 17,
        pitch: 0,
      });

      draw.current = new MapboxDraw({
        displayControlsDefault: false,
        controls: {},
        defaultMode: "simple_select",
        styles: [
          { id: "gl-draw-polygon-fill", type: "fill", filter: ["all", ["==", "$type", "Polygon"]], paint: { "fill-color": P.gold, "fill-opacity": 0.25 } },
          { id: "gl-draw-polygon-stroke", type: "line", filter: ["all", ["==", "$type", "Polygon"]], paint: { "line-color": P.gold, "line-width": 2 } },
          { id: "gl-draw-polygon-fill-active", type: "fill", filter: ["all", ["==", "$type", "Polygon"], ["==", "active", "true"]], paint: { "fill-color": P.gold, "fill-opacity": 0.4 } },
        ],
      });

      map.current.addControl(draw.current);
      map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

      map.current.on("load", () => setMapReady(true));

      map.current.on("draw.create", e => {
        const feature = e.features[0];
        const newUnit = {
          id: feature.id,
          featureId: feature.id,
          label: `Unit ${Object.keys(markersRef.current).length + 1}`,
          status: "available",
          price: "99",
          size: "10×10",
          geometry: feature.geometry,
          center: getCentroid(feature.geometry.coordinates[0]),
        };
        setUnits(prev => {
          const updated = [...prev, newUnit];
          return updated;
        });
        setEditingUnit(newUnit);
        draw.current.changeMode("simple_select");
        setMode("view");
      });

      map.current.on("draw.selectionchange", e => {
        if (e.features.length > 0) setSelectedId(e.features[0].id);
        else setSelectedId(null);
      });
    };

    initMap().catch(error => {
      console.error("Failed to initialize facility builder map", error);
    });

    return () => {
      active = false;
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
      draw.current = null;
      mapboxglRef.current = null;
    };
  }, []);

  // Render unit labels as markers
  useEffect(() => {
    if (!mapReady || !map.current || !mapboxglRef.current) return;

    // Remove old markers
    Object.values(markersRef.current).forEach(m => m.remove());
    markersRef.current = {};

    units.forEach(unit => {
      if (!unit.center) return;
      const el = document.createElement("div");
      el.style.cssText = `
        background: ${STATUS_COLORS[unit.status] || "#22c55e"};
        color: white; font-family: 'Nunito', sans-serif; font-weight: 800;
        font-size: 11px; padding: 3px 8px; border-radius: 6px;
        cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        white-space: nowrap; user-select: none;
      `;
      el.textContent = unit.label || "?";
      el.addEventListener("click", () => setEditingUnit(unit));

      const marker = new mapboxglRef.current.Marker({ element: el, anchor: "center" })
        .setLngLat(unit.center)
        .addTo(map.current);

      markersRef.current[unit.id] = marker;
    });
  }, [units, mapReady]);

  // Geocode address
  const geocode = async () => {
    if (!address.trim() || !MAPBOX_TOKEN) return;
    setSearching(true);
    try {
      const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_TOKEN}&limit=1`);
      const data = await res.json();
      if (data.features?.length > 0) {
        const [lng, lat] = data.features[0].center;
        map.current.flyTo({ center: [lng, lat], zoom: 18, speed: 1.5 });
      }
    } catch (e) { console.error(e); }
    setSearching(false);
  };

  // Draft a simple starter layout from the current map center
  const generateLayoutDraft = async () => {
    if (!map.current) return;
    setDraftLoading(true);
    await new Promise(r => setTimeout(r, 250));
    const center = map.current.getCenter();
    const suggestions = Array.from({ length: 12 }, (_, i) => ({
      id: `draft-${Date.now()}-${i}`,
      label: `${String.fromCharCode(65 + Math.floor(i / 4))}-${String((i % 4) + 1).padStart(2, "0")}`,
      size: i % 3 === 0 ? "10×20" : i % 3 === 1 ? "10×10" : "5×5",
      price: i % 3 === 0 ? "169" : i % 3 === 1 ? "99" : "49",
      status: "available",
      center: [
        center.lng + (i % 4 - 1.5) * 0.00008,
        center.lat + (Math.floor(i / 4) - 1) * 0.00012,
      ],
      geometry: null,
    }));
    setDraftSuggestions(suggestions);
    setDraftLoading(false);
  };

  const acceptDraftSuggestions = (suggestions) => {
    setUnits(prev => [...prev, ...suggestions]);
    setDraftSuggestions(null);
  };

  const normalizeUnit = (unit) => ({
    ...unit,
    price: Number(unit.price || 0),
  });

  const updateUnit = (updated) => {
    setUnits(prev => prev.map(u => u.id === updated.id ? normalizeUnit(updated) : u));
    setEditingUnit(null);
  };

  const deleteUnit = (id) => {
    setUnits(prev => prev.filter(u => u.id !== id));
    if (draw.current) {
      try { draw.current.delete(id); } catch { return; }
    }
    setEditingUnit(null);
  };

  const startDraw = () => {
    setMode("draw");
    setEditingUnit(null);
    if (draw.current) draw.current.changeMode("draw_polygon");
  };

  const handleSave = () => {
    onSave?.({ units: units.map(normalizeUnit), address: address.trim() });
    setSaveMessage(`Saved ${units.length} unit${units.length === 1 ? "" : "s"} to this device.`);
  };

  if (noToken) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: 32, fontFamily: P.fontBody, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🗺️</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: P.text, fontFamily: P.font, marginBottom: 8 }}>Mapbox API Key Required</div>
        <div style={{ fontSize: 14, color: P.sub, marginBottom: 24, lineHeight: 1.6, maxWidth: 340 }}>
          Get a free key at <a href="https://account.mapbox.com/auth/signup/" target="_blank" rel="noreferrer" style={{ color: P.gold }}>mapbox.com</a>, then add it to your <code>.env</code> file:
        </div>
        <div style={{
          background: "#1a1714", color: "#00D47E", fontFamily: "monospace",
          fontSize: 13, padding: "14px 20px", borderRadius: 10, width: "100%", maxWidth: 380,
          textAlign: "left", marginBottom: 24,
        }}>
          VITE_MAPBOX_TOKEN=pk.eyJ1...
        </div>
        <button onClick={handleBack} style={{
          padding: "11px 24px", borderRadius: 9, border: `1px solid ${P.border}`,
          background: P.card, color: P.sub, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: P.fontBody,
        }}>← Back</button>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Nunito:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* Map */}
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />

      {/* Top bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 20,
        background: "rgba(255,255,255,0.96)", backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${P.border}`, padding: "10px 14px",
      }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={handleBack} style={{
            padding: "7px 12px", borderRadius: 7, border: `1px solid ${P.border}`,
            background: P.card, color: P.sub, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: P.fontBody, flexShrink: 0,
          }}>← Back</button>
          <input
            value={address} onChange={e => setAddress(e.target.value)}
            onKeyDown={e => e.key === "Enter" && geocode()}
            placeholder="Enter facility address..."
            style={{
              flex: 1, padding: "8px 12px", borderRadius: 8, border: `1px solid ${P.border}`,
              background: P.card, fontSize: 13, color: P.text, fontFamily: P.fontBody, outline: "none",
            }}
          />
          <button onClick={geocode} disabled={searching} style={{
            padding: "8px 14px", borderRadius: 8, border: "none",
            background: `linear-gradient(135deg, ${P.gold}, #b8943f)`,
            color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: P.fontBody, flexShrink: 0,
          }}>{searching ? "..." : "Go"}</button>
        </div>
      </div>

      {/* Bottom toolbar */}
      <div style={{
        position: "absolute", bottom: 16, left: 16, right: 16, zIndex: 20,
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          padding: "8px 12px", borderRadius: 10,
          background: "rgba(255,255,255,0.95)", backdropFilter: "blur(10px)",
          border: `1px solid ${hasUnsavedChanges ? P.gold + "40" : P.border}`,
          fontFamily: P.fontBody,
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: hasUnsavedChanges ? P.goldDark : P.text }}>
              {hasUnsavedChanges ? "Unsaved layout changes" : "All builder changes saved"}
            </div>
            <div style={{ fontSize: 11, color: saveMessage ? P.goldDark : P.sub }}>
              {saveMessage || (hasUnsavedChanges ? "Save before leaving to update the dashboard and customer flow." : "Saved locally on this device. Billing and locks are still demo-only.")}
            </div>
          </div>
          <div style={{
            padding: "5px 9px", borderRadius: 999,
            background: hasUnsavedChanges ? P.goldLight : "#eef9f0",
            color: hasUnsavedChanges ? P.goldDark : STATUS_COLORS.available,
            fontSize: 10, fontWeight: 800, letterSpacing: "0.04em",
          }}>
            {hasUnsavedChanges ? "NOT SAVED" : "SAVED"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={startDraw} style={{
            flex: 1, padding: "12px 8px", borderRadius: 10,
            background: mode === "draw" ? P.gold : "rgba(255,255,255,0.95)",
            backdropFilter: "blur(10px)",
            border: `1px solid ${mode === "draw" ? P.gold : P.border}`,
            color: mode === "draw" ? "#fff" : P.text,
            fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: P.fontBody,
          }}>
            ✏️ Draw Unit
          </button>
          <button onClick={generateLayoutDraft} disabled={draftLoading} style={{
            flex: 1, padding: "12px 8px", borderRadius: 10,
            background: "rgba(255,255,255,0.95)", backdropFilter: "blur(10px)",
            border: `1px solid ${P.border}`,
            color: P.text, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: P.fontBody,
          }}>
            {draftLoading ? "⏳ Building Draft..." : "📐 Draft Layout"}
          </button>
          <button onClick={handleSave} style={{
            flex: 1, padding: "12px 8px", borderRadius: 10,
            background: `linear-gradient(135deg, ${P.gold}, #b8943f)`,
            border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: P.fontBody,
            boxShadow: hasUnsavedChanges ? `0 6px 20px ${P.gold}30` : "none",
          }}>
            {hasUnsavedChanges ? `💾 Save Changes (${units.length})` : `✅ Saved (${units.length})`}
          </button>
        </div>
      </div>

      {/* Unit count badge */}
      {units.length > 0 && !editingUnit && (
        <div style={{
          position: "absolute", top: 70, right: 14, zIndex: 20,
          background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)",
          border: `1px solid ${P.border}`, borderRadius: 10, padding: "8px 14px",
          fontFamily: P.fontBody, fontSize: 12,
        }}>
          <div style={{ fontWeight: 800, color: P.text }}>{units.length} units</div>
          <div style={{ color: STATUS_COLORS.available, fontSize: 11 }}>{units.filter(u => u.status === "available").length} available</div>
        </div>
      )}

      {/* Unit edit panel */}
      {editingUnit && (
        <UnitPanel
          unit={editingUnit}
          onUpdate={updateUnit}
          onDelete={() => deleteUnit(editingUnit.id)}
          onClose={() => setEditingUnit(null)}
        />
      )}

      {/* Layout draft modal */}
      {draftSuggestions && (
        <LayoutDraftModal
          suggestions={draftSuggestions}
          onAccept={acceptDraftSuggestions}
          onClose={() => setDraftSuggestions(null)}
        />
      )}

      {/* Draw mode hint */}
      {mode === "draw" && (
        <div style={{
          position: "absolute", top: 70, left: "50%", transform: "translateX(-50%)",
          background: "rgba(201,168,76,0.95)", backdropFilter: "blur(8px)",
          borderRadius: 10, padding: "8px 16px", zIndex: 20,
          fontFamily: P.fontBody, fontSize: 12, fontWeight: 700, color: "#fff",
          whiteSpace: "nowrap",
        }}>
          Tap to draw unit boundary · Double-tap to finish
        </div>
      )}
    </div>
  );
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function getCentroid(coords) {
  let lng = 0, lat = 0;
  const n = coords.length;
  coords.forEach(([x, y]) => { lng += x; lat += y; });
  return [lng / n, lat / n];
}
