import * as React from "react";

interface EmailTemplateProps {
  code: string;
  expires?: Date;
}

export function PasswordResetEmail({ code, expires }: EmailTemplateProps) {
  const expiresText = expires
    ? `This code will expire on ${expires.toLocaleString()}.`
    : "This code will expire soon.";

  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        padding: "20px",
        maxWidth: "600px",
        margin: "0 auto",
        color: "#333",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "30px" }}>
        <h1 style={{ color: "#4f46e5", fontSize: "24px", marginBottom: "10px" }}>
          Reset Your Password
        </h1>
      </div>
      <div style={{ backgroundColor: "#f9fafb", padding: "20px", borderRadius: "8px" }}>
        <p style={{ fontSize: "16px", lineHeight: "1.5", marginBottom: "15px" }}>
          We received a request to reset your password. Use the code below to set
          a new password for your account:
        </p>
        <div
          style={{
            backgroundColor: "#eef2ff",
            padding: "15px",
            borderRadius: "6px",
            textAlign: "center",
            margin: "20px 0",
            borderLeft: "4px solid #4f46e5",
          }}
        >
          <span style={{ fontSize: "24px", fontWeight: "bold", letterSpacing: "5px" }}>
            {code}
          </span>
        </div>
        <p style={{ fontSize: "16px", lineHeight: "1.5", marginBottom: "20px" }}>
          {expiresText}
        </p>
        <p style={{ fontSize: "16px", lineHeight: "1.5", color: "#666" }}>
          If you didn't request this password reset, you can safely ignore this
          email.
        </p>
      </div>
      <div style={{ textAlign: "center", marginTop: "30px", color: "#666", fontSize: "14px" }}>
        <p>© 2023 Your Application</p>
      </div>
    </div>
  );
} 