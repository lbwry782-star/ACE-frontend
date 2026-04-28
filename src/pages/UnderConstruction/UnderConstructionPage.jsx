import React, { useState } from "react";
import "./UnderConstructionPage.css";

const bgVideo = `${import.meta.env.BASE_URL}assets/${encodeURIComponent("ווידאו_פתיחה.mp4")}`;

export default function UnderConstructionPage() {
  const [isChecked33, setIsChecked33] = useState(false);

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
          <div
            className="uc-checkbox"
            onClick={() => setIsChecked33((prev) => !prev)}
          >
            <img src="/assets/33.png?v=2" alt="" />
            {isChecked33 && (
              <div className="uc-checkmark">✔</div>
            )}
          </div>
          <img src="/assets/44.png?v=2" alt="" />
          <div
            className="uc-hover uc-clickable"
            onClick={() => {
              window.open(
                "/assets/ACE_TERMS_AND_POLICIES.pdf",
                "_blank",
                "noopener,noreferrer"
              );
            }}
          >
            <img src="/assets/55.png?v=2" className="uc-default" alt="" />
            <img src="/assets/100.png?v=2" className="uc-hover-img" alt="" />
          </div>
        </div>
        <img src="/assets/66.png?v=2" className="uc-image-66" alt="" />
        <div className="uc-image-row-66-center">
          <div
            className={`uc-hover ${!isChecked33 ? "uc-disabled" : ""}`}
          >
            <img src="/assets/77.png?v=2" className="uc-default" alt="" />
            <img src="/assets/101.png?v=2" className="uc-hover-img" alt="" />
          </div>
          <img src="/assets/88.png?v=2" alt="" />
          <div
            className={`uc-hover ${!isChecked33 ? "uc-disabled" : ""}`}
          >
            <img src="/assets/99.png?v=2" className="uc-default" alt="" />
            <img src="/assets/102.png?v=2" className="uc-hover-img" alt="" />
          </div>
        </div>
      </div>
    </div>
  );
}
