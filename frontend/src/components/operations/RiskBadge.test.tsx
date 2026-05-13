import { render, screen } from "@testing-library/react";

import { RiskBadge } from "./RiskBadge";

jest.mock("../ui/StatusBadge", () => ({
  StatusBadge: ({ label }: { label: string }) => <span>{label}</span>,
}));

describe("RiskBadge", () => {
  it("renders critical risk label", () => {
    render(<RiskBadge risk="critical" />);

    expect(screen.getByText("Critical")).toBeInTheDocument();
  });

  it("returns empty output when risk is missing", () => {
    const { container } = render(<RiskBadge risk={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});
