import { describe, expect, it } from "vitest";
import { buildParentSmsMessage } from "./parent-sms-template";
import { renderParentTemplate } from "./parent-sms-template";

describe("buildParentSmsMessage", () => {
  it("renders the school, parent, learner, contact, and custom message details", () => {
    expect(
      buildParentSmsMessage({
        schoolName: "Riverside Academy",
        parentName: "Jane Doe",
        studentName: "Sam Doe",
        admissionNumber: "ADM-0001",
        classStream: "Grade 6 Blue",
        schoolPhone: "+254700000000",
        schoolEmail: "office@riverside.example",
        messageBody: "Please collect the report card on Friday.",
      }),
    ).toBe(`Riverside Academy Official Notice
Dear Jane Doe,

This is a message from Riverside Academy regarding Sam Doe (Adm No: ADM-0001, Grade/Class: Grade 6 Blue).

—
Please collect the report card on Friday.
—

For inquiries, contact the school office on +254700000000 or office@riverside.example.
This is an automated message from Riverside Academy`);
  });

  it("replaces an undefined body with a safe message", () => {
    expect(
      buildParentSmsMessage({
        schoolName: "Riverside Academy",
        parentName: "Jane Doe",
        studentName: "Sam Doe",
        admissionNumber: "ADM-0001",
        classStream: "Grade 6 Blue",
        schoolPhone: "+254700000000",
        schoolEmail: "office@riverside.example",
        messageBody: "undefined",
      }),
    ).toContain("No message content is available.");
  });
});

describe("renderParentTemplate", () => {
  it("substitutes message placeholders without producing undefined text", () => {
    expect(renderParentTemplate("{{message_body}}", { message_body: "School event on Friday." })).toBe(
      "School event on Friday.",
    );
    expect(renderParentTemplate("undefined", { message_body: "School event on Friday." }, "School event on Friday.")).toBe(
      "School event on Friday.",
    );
  });
});