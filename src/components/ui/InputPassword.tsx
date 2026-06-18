import { useState } from "react";

interface InputPasswordProps {
  name?: string;
  password?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}

export default function InputPassword({
  name = "password",
  password = "",
  onChange,
  placeholder = "Masukkan password",
}: InputPasswordProps) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
      }}
    >
      <input
        name={name}
        type={showPassword ? "text" : "password"} // Dynamically switch type
        value={password}
        onChange={onChange}
        placeholder={placeholder}
        required
        style={{ width: "100%", paddingRight: "40px" }} // Make room for the button
      />
      <button
        type="button" // Prevents form submission when clicked
        onClick={() => setShowPassword(!showPassword)}
        style={{
          position: "absolute",
          right: "12px",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          display: "flex",
          alignItems: "center",
          color: "var(--muted)",
        }}
        aria-label={
          showPassword ? "Sembunyikan password" : "Tampilkan password"
        }
      >
        {showPassword ? (
          /* Eye Off Icon (SVG) */
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
          </svg>
        ) : (
          /* Eye Icon (SVG) */
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        )}
      </button>
    </div>
  );
}
