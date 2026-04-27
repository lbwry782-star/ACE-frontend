import React from "react";
import "./UnderConstructionPage.css";

const bgVideo = `${import.meta.env.BASE_URL}assets/${encodeURIComponent("ווידאו_פתיחה.mp4")}`;

export default function UnderConstructionPage() {
  return (
    <div className="uc-page">
      <video
        className="uc-video"
        src={bgVideo}
        autoPlay
        loop
        muted
        playsInline
      />
    </div>
  );
}
