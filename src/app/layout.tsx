import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "토론나침반 - 고등학교 토론 및 발표 준비 도우미",
  description: "뉴스 기사로부터 토론 논제를 발굴하고, 신뢰성 높은 찬성/반대/배경 근거 자료를 수집·검증해주는 고등학생용 토론 도우미 서비스입니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
