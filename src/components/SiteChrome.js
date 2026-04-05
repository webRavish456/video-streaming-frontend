"use client";

import Link from "next/link";
import UserAvatarMenu from "@/components/UserAvatarMenu";

export default function SiteChrome({ title, children }) {
  return (
    <div className="page-wrapper">
      <header className="site-header site-header--elevated org-sub-header">
        <div className="site-header-inner">
          <div className="header-left">
            <Link href="/" className="logo">
              <div className="logo-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <span className="logo-text">
                Stream<span>Hub</span>
              </span>
            </Link>
            {title ? <span className="org-sub-title">{title}</span> : null}
          </div>
          <div className="header-right">
            <UserAvatarMenu />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
