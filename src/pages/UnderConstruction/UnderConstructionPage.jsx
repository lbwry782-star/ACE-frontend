import React from "react";
import "./UnderConstructionPage.css";
import png11 from "../../assets/11.png";

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
        src={png11}
        className="uc-center-image"
        alt="center visual"
      />
    </div>
  );
}
