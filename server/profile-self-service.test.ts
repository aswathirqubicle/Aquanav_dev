/**
 * Employee self-service on My Profile: which fields an employee may change,
 * how input is validated, what counts as a change, and the notification email.
 */
import { describe, it, expect } from "@jest/globals";
import {
  describeChanges,
  pickBasicInfo,
  pickNextOfKin,
  pickTraining,
  BASIC_INFO_LABELS,
} from "./lib/profile-self-service";
import { renderProfileChange } from "./notifications/templates";

describe("pickBasicInfo", () => {
  it("takes only the personal fields and ignores everything else", () => {
    const { data, errors } = pickBasicInfo({
      phone: " +91 98 ",
      salary: "99999",
      firstName: "Someone Else",
      position: "Manager",
      accountNumber: "123",
      isActive: false,
    });
    expect(errors).toEqual({});
    expect(data).toEqual({ phone: "+91 98" });
  });

  it("treats an emptied field as cleared", () => {
    expect(pickBasicInfo({ address: "  " }).data).toEqual({ address: null });
  });

  it("validates email, date of birth, height and weight", () => {
    const { errors } = pickBasicInfo({
      email: "not-an-email",
      dateOfBirth: "2999-01-01",
      height: "abc",
      weight: "900",
    });
    expect(Object.keys(errors).sort()).toEqual(["dateOfBirth", "email", "height", "weight"]);
  });
});

describe("pickNextOfKin", () => {
  it("requires a name, a known relationship and a phone or email", () => {
    expect(Object.keys(pickNextOfKin({ relationship: "cousin" }).errors).sort()).toEqual([
      "name",
      "phone",
      "relationship",
    ]);
  });

  it("accepts a valid contact and reads the primary flag from a form value", () => {
    const { data, errors } = pickNextOfKin({
      name: "Asha",
      relationship: "Spouse",
      phone: "123",
      isPrimary: "true",
    });
    expect(errors).toEqual({});
    expect(data).toEqual({
      name: "Asha",
      relationship: "spouse",
      phone: "123",
      email: null,
      isPrimary: true,
    });
  });
});

describe("pickTraining", () => {
  it("requires name, provider and date, and rejects expiry before training", () => {
    expect(Object.keys(pickTraining({}).errors).sort()).toEqual([
      "trainingDate",
      "trainingName",
      "trainingProvider",
    ]);
    expect(
      pickTraining({
        trainingName: "BST",
        trainingProvider: "IMU",
        trainingDate: "2026-05-01",
        expiryDate: "2026-04-01",
      }).errors,
    ).toEqual({ expiryDate: "Expiry date cannot be before the training date" });
  });

  it("never takes a status from the employee", () => {
    const { data } = pickTraining({
      trainingName: "BST",
      trainingProvider: "IMU",
      trainingDate: "2026-05-01",
      status: "expired",
    });
    expect(data).not.toHaveProperty("status");
  });
});

describe("describeChanges", () => {
  it("lists only fields whose value changes, ignoring decimal and date formats", () => {
    const changes = describeChanges(
      { phone: "1", height: "172.00", dateOfBirth: "1990-01-02", address: "Old" },
      { phone: "1", height: "172", dateOfBirth: "1990-01-02", address: null },
      BASIC_INFO_LABELS,
    );
    expect(changes).toEqual([{ label: "Address", value: "(removed)" }]);
  });
});

describe("renderProfileChange", () => {
  const base = {
    sectionLabel: "Next of kin",
    itemLabel: "Asha",
    action: "added" as const,
    employeeName: "Vishnu Sajeevan",
    employeeCode: "AQ-041",
    details: [{ label: "Phone", value: "<123>" }],
    changedAt: "10 Nov 2026, 09:45",
  };

  it("tells project managers who changed what, with escaped values", () => {
    const { subject, html } = renderProfileChange({ ...base, forEmployee: false, viewUrl: "https://x/employees" });
    expect(subject).toBe("Vishnu Sajeevan added their next of kin");
    expect(html).toContain("Vishnu Sajeevan (AQ-041)");
    expect(html).toContain("&lt;123&gt;");
    expect(html).toContain("View in Aquanav");
    expect(html).toContain("cid:aquanav-logo");
  });

  it("confirms to the employee in their own wording", () => {
    const { subject, html } = renderProfileChange({ ...base, forEmployee: true });
    expect(subject).toBe("Your next of kin was added in Aquanav");
    expect(html).toContain("If you did not make this change");
  });
});
