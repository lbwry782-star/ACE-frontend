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
      <img
        src="/assets/11.png?v=2"
        className="uc-center-image"
        alt="center visual"
      />
    </div>
  );
}
