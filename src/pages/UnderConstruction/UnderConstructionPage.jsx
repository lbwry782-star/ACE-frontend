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
      <div className="uc-image-block">
        <img
          src="/assets/11.png?v=2"
          className="uc-center-image"
          alt="main"
        />
        <div className="uc-image-row">
          <img src="/assets/22.png?v=2" alt="" />
          <img src="/assets/33.png?v=2" alt="" />
          <img src="/assets/44.png?v=2" alt="" />
          <img src="/assets/55.png?v=2" alt="" />
        </div>
        <img src="/assets/66.png?v=2" className="uc-image-66" alt="" />
      </div>
    </div>
  );
}
