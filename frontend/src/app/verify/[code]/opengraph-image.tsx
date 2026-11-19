import { ImageResponse } from "next/og";
import { qrModules } from "@/lib/qr";
import { loadCertificate } from "./certificate-data";
import { loadCertificateFonts } from "./certificate-fonts";
import { CERTIFICATE_SIZE, CertificateArtwork } from "./certificate-artwork";

// The certificate as a PNG. The verify page shows it, "Download image" saves it, and LinkedIn
// uses it as the link preview, so all three are the same document (see certificate-artwork.tsx).

export const size = CERTIFICATE_SIZE;
export const contentType = "image/png";
export const alt = "Certificate of completion";

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const certificate = await loadCertificate(code);

  if (!certificate) {
    return new ImageResponse(<div style={{ display: "flex", width: "100%", height: "100%", background: "#fff", alignItems: "center", justifyContent: "center", fontSize: 56, color: "#0A1240" }}>Certificate not found</div>, size);
  }

  const fonts = await loadCertificateFonts();
  // The QR code holds the full verify link, so a phone camera opens the page that proves the certificate.
  const qr = (() => { try { return qrModules(certificate.verifyUrl); } catch { return null; } })();

  return new ImageResponse(<CertificateArtwork certificate={certificate} qr={qr} />, { ...size, fonts: fonts.length ? fonts : undefined });
}
