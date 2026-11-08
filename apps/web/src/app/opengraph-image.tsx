import { ImageResponse } from "next/og";

export const alt = "Planwerk: a realtime collaborative board";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const columns = [
  { title: "To do", cards: ["Buy groceries", "Plan the flat party"] },
  { title: "In progress", cards: ["Fix the bike"] },
  { title: "Done", cards: ["Pay the internet bill", "Water the plants"] },
];

/** Preview image for links shared on social networks and in chats. */
export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 64,
        background: "#0a0a0a",
        color: "#ededed",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: -2 }}>Planwerk</div>
        <div style={{ fontSize: 32, color: "#a3a3a3" }}>
          Plan together. See every change instantly.
        </div>
      </div>
      <div style={{ display: "flex", gap: 24 }}>
        {columns.map((column) => (
          <div
            key={column.title}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              width: 340,
              padding: 20,
              borderRadius: 16,
              border: "2px solid #262626",
              background: "#141414",
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 600 }}>{column.title}</div>
            {column.cards.map((card) => (
              <div
                key={card}
                style={{
                  fontSize: 22,
                  padding: "12px 16px",
                  borderRadius: 10,
                  background: "#1f1f1f",
                  border: "1px solid #2e2e2e",
                }}
              >
                {card}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>,
    size,
  );
}
