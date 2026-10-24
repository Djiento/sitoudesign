import { Resend } from "resend";

type InquiryEmailData = {
  kind: "contact" | "quote";
  fullName: string;
  email: string;
  phone?: string;
  company?: string;
  service?: string;
  quantity?: number | null;
  deadline?: string;
  message: string;
  locale: "fr" | "en";
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

export async function sendInquiryEmail(data: InquiryEmailData) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const to = process.env.CONTACT_EMAIL_TO || "secretariatsitousarl@gmail.com";

  if (!apiKey || !from) {
    throw new Error("Resend is not configured: set RESEND_API_KEY and RESEND_FROM_EMAIL.");
  }

  const resend = new Resend(apiKey);
  const english = data.locale === "en";
  const title = data.kind === "quote"
    ? english ? "New quote request" : "Nouvelle demande de devis"
    : english ? "New contact message" : "Nouveau message de contact";
  const details = [
    [english ? "Name" : "Nom", data.fullName],
    ["E-mail", data.email],
    [english ? "Phone" : "Téléphone", data.phone || (english ? "Not provided" : "Non renseigné")],
    ...(data.company ? [[english ? "Company" : "Entreprise", data.company]] : []),
    ...(data.service ? [[english ? "Service" : "Prestation", data.service]] : []),
    ...(data.quantity ? [[english ? "Quantity" : "Quantité", String(data.quantity)]] : []),
    ...(data.deadline ? [[english ? "Desired deadline" : "Délai souhaité", data.deadline]] : []),
  ];
  const safeDetails = details.map(([label, value]) => [
    escapeHtml(label),
    escapeHtml(value),
  ]);
  const subjectName = data.fullName.replace(/[\r\n]+/g, " ").trim();
  const { error } = await resend.emails.send({
    from,
    to,
    replyTo: data.email,
    subject: `${title} — ${subjectName}`,
    text: [
      title,
      "",
      ...details.map(([label, value]) => `${label}: ${value}`),
      "",
      english ? "Message:" : "Message :",
      data.message,
    ].join("\n"),
    html: `
      <main style="font-family:Arial,sans-serif;color:#18212f;line-height:1.6">
        <h1 style="font-size:22px">${escapeHtml(title)}</h1>
        <table style="border-collapse:collapse">
          ${safeDetails.map(([label, value]) => `
            <tr>
              <th style="padding:6px 16px 6px 0;text-align:left">${label}</th>
              <td style="padding:6px 0">${value}</td>
            </tr>
          `).join("")}
        </table>
        <h2 style="font-size:16px">${english ? "Message" : "Votre message"}</h2>
        <p style="white-space:pre-wrap">${escapeHtml(data.message)}</p>
      </main>
    `,
  });

  if (error) {
    throw new Error(`Resend failed to send the notification: ${error.message}`);
  }
}
