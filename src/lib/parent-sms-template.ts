export type ParentSmsDetails = {
  schoolName: string;
  parentName: string;
  studentName: string;
  admissionNumber: string;
  classStream: string;
  schoolPhone: string;
  schoolEmail: string;
  messageBody: string;
  footerNote?: string;
};

export function buildParentSmsMessage(details: ParentSmsDetails) {
  return buildParentNotice(details, details.messageBody);
}

export function renderParentTemplate(
  template: string,
  values: Record<string, string | number | null | undefined>,
  fallback = "",
) {
  const rendered = template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, key: string) =>
    String(values[key] ?? ""),
  );
  return rendered.trim() && rendered.trim().toLowerCase() !== "undefined" ? rendered : fallback;
}

export function buildParentNotice(details: ParentSmsDetails, messageBody: string) {
  const safeMessageBody =
    typeof messageBody === "string" &&
    messageBody.trim() &&
    messageBody.trim().toLowerCase() !== "undefined"
      ? messageBody
      : "No message content is available.";
  return `${details.schoolName} Official Notice
Dear ${details.parentName},

Re: ${details.studentName} (Adm No: ${details.admissionNumber}, ${details.classStream})

—
${safeMessageBody}
—

Contact: ${details.schoolPhone} | ${details.schoolEmail}`;
}