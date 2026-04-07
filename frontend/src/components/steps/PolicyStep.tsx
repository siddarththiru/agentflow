import React from "react";
import { PolicyCreate, Tool } from "../../types";

const labelStyle: React.CSSProperties = { display: "block", marginBottom: "6px", fontWeight: 600, color: "#000000" };
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #B6B09F",
  background: "#F2F2F2",
  color: "#000000",
};
const buttonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "1px solid #B6B09F",
  background: "#B6B09F",
  color: "#000000",
  cursor: "pointer",
  fontWeight: 600,
};
const ghostButton: React.CSSProperties = {
  ...buttonStyle,
  background: "transparent",
  color: "#000000",
};
const errorStyle: React.CSSProperties = {
  background: "#7f1d1d",
  color: "#fecdd3",
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #b91c1c",
  marginBottom: "12px",
};

type Props = {
  selectedToolIds: number[];
  availableTools: Tool[];
  form: PolicyCreate;
  setForm: (form: PolicyCreate) => void;
  loading: boolean;
  error: string;
  onSubmit: () => void;
  onBack: () => void;
};

const PolicyStep: React.FC<Props> = ({
  selectedToolIds,
  availableTools,
  form,
  setForm,
  loading,
  error,
  onSubmit,
  onBack,
}) => (
  <div>
    <h2 style={{ marginTop: 0, marginBottom: "12px", color: "#000000" }}>Policies</h2>
    {error && <div style={errorStyle}>{error}</div>}
    <div style={{ marginBottom: "12px" }}>
      <strong style={{ color: "#000000" }}>Selected tools</strong>
      {selectedToolIds.length === 0 ? (
        <p style={{ color: "#B6B09F" }}>No tools selected.</p>
      ) : (
        <ul>
          {availableTools
            .filter((t) => selectedToolIds.includes(t.id))
            .map((t) => (
              <li key={t.id}>{t.name}</li>
            ))}
        </ul>
      )}
    </div>
    <div style={{ display: "grid", gap: "12px" }}>
      <div>
        <label style={labelStyle}>Frequency limit (max calls per session)</label>
        <input
          style={inputStyle}
          type="number"
          min={1}
          value={form.frequency_limit ?? ""}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const value = e.target.value === "" ? null : Number(e.target.value);
            setForm({ ...form, frequency_limit: value });
          }}
          placeholder="Leave blank for no limit"
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <input
          type="checkbox"
          checked={form.require_approval_for_all_tool_calls}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setForm({ ...form, require_approval_for_all_tool_calls: e.target.checked })
          }
        />
        <label>Tool calls require approval</label>
      </div>
    </div>
    <div style={{ marginTop: "16px", display: "flex", justifyContent: "space-between", gap: "12px" }}>
      <button style={ghostButton} onClick={onBack} disabled={loading}>
        Back
      </button>
      <button style={buttonStyle} onClick={onSubmit} disabled={loading}>
        {loading ? "Saving..." : "Next: Review"}
      </button>
    </div>
  </div>
);

export default PolicyStep;
