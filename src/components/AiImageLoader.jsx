import React from "react";

export default function AiImageLoader({ progress, message }) {
  const dots = [];

  // Generate a rectangular 20 columns x 10 rows grid of dots (200 dots total)
  // Delays radiate from the center coordinates (5, 10)
  for (let i = 0; i < 200; i++) {
    const row = Math.floor(i / 20);
    const col = i % 20;
    
    const distance =
      Math.abs(row - 5) +
      Math.abs(col - 10);

    dots.push(
      <div
        key={i}
        className="dot"
        style={{
          animationDelay: `${distance * 0.08}s`,
        }}
      />
    );
  }

  const displayMessage = message || "Creating image...";

  return (
    <div className="loader-wrapper">
      <div className="loader-card">
        {/* Dynamic message updates trigger CSS entry animations via React key re-render */}
        <h1 key={displayMessage} className="animatedText">
          {displayMessage} <span className="pct">({progress}%)</span>
        </h1>

        <div className="grid-wrapper">
          <div className="grid">{dots}</div>
        </div>
      </div>

      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .loader-wrapper {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          overflow: visible;
          padding: 8px 0;
        }

        .loader-card {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
        }

        .animatedText {
          color: white;
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.5px;
          font-family: 'Nunito', sans-serif;
          animation: fadeText .5s ease;
          text-align: center;
          max-width: 100%;
          line-height: 1.4;
          margin-bottom: 8px;
        }

        .animatedText .pct {
          color: var(--accent-cyan);
          font-weight: 800;
        }

        @keyframes fadeText {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0px);
          }
        }

        .grid-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          padding: 12px 0;
          overflow: visible;
          mask-image: radial-gradient(ellipse at center, rgba(0, 0, 0, 1) 35%, rgba(0, 0, 0, 0) 80%);
          -webkit-mask-image: radial-gradient(ellipse at center, rgba(0, 0, 0, 1) 35%, rgba(0, 0, 0, 0) 80%);
        }

        .grid {
          display: grid;
          /* 20 columns make it rectangular */
          grid-template-columns: repeat(20, 1fr);
          gap: 12px;
          z-index: 1;
        }

        .dot {
          width: 4px;
          height: 4px;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.8);
          opacity: .08;
          transform: scale(.6);
          animation: wavePulse 3s ease-in-out infinite;
          will-change: transform, opacity, box-shadow;
        }

        @keyframes wavePulse {
          0% {
            opacity: .08;
            transform: scale(.6);
            box-shadow: 0 0 0 rgba(255, 255, 255, 0);
          }
          35% {
            opacity: 1;
            transform: scale(1.9);
            background: #ffffff;
            box-shadow:
              0 0 12px rgba(255, 255, 255, 0.95),
              0 0 4px rgba(139, 92, 246, 0.8);
          }
          70% {
            opacity: .25;
            transform: scale(1);
            box-shadow: 0 0 4px rgba(255, 255, 255, 0.3);
          }
          100% {
            opacity: .08;
            transform: scale(.6);
            box-shadow: 0 0 0 rgba(255, 255, 255, 0);
          }
        }

        @media (max-width: 540px) {
          .grid {
            grid-template-columns: repeat(15, 1fr);
            gap: 10px;
          }
          .dot {
            width: 3px;
            height: 3px;
          }
        }
      `}</style>
    </div>
  );
}
