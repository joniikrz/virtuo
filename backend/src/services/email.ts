import nodemailer from 'nodemailer';

const smtpHost = process.env.SMTP_HOST?.trim() || '';
const smtpUser = process.env.SMTP_USER?.trim() || '';
const smtpPass = process.env.SMTP_PASS?.trim() || '';
const defaultFrom = process.env.SMTP_FROM?.trim() || '';
const smtpConfigured = Boolean(smtpHost && smtpUser && smtpPass && defaultFrom);

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: smtpHost,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true', // true për 465, false për STARTTLS/587
      auth: { user: smtpUser, pass: smtpPass },
      requireTLS: process.env.SMTP_REQUIRE_TLS !== 'false',
      tls: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false',
      },
      connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS) || 5_000,
      greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS) || 5_000,
      socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS) || 10_000,
    })
  : null;

let missingConfigurationLogged = false;

function logMissingConfigurationOnce() {
  if (missingConfigurationLogged) return;
  missingConfigurationLogged = true;
  console.warn('[SMTP] Email-et janë çaktivizuar: plotëso SMTP_HOST, SMTP_USER, SMTP_PASS dhe SMTP_FROM.');
}

export function isEmailConfigured(): boolean {
  return smtpConfigured;
}

export async function verifyEmailTransport(): Promise<boolean> {
  if (!transporter) {
    logMissingConfigurationOnce();
    return false;
  }

  try {
    await transporter.verify();
    console.log(`[SMTP] Lidhja u verifikua me sukses te ${smtpHost}:${process.env.SMTP_PORT || '587'}.`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gabim i panjohur SMTP';
    console.error(`[SMTP] Verifikimi dështoi: ${message}`);
    return false;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character] || character));
}

function safeSubject(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim().slice(0, 180);
}

export function buildTaskUrl(taskId: string, configuredFrontendUrl = process.env.FRONTEND_URL || ''): string {
  const firstConfiguredUrl = configuredFrontendUrl.split(',')[0]?.trim();
  if (!firstConfiguredUrl || !/^[A-Za-z0-9_-]{1,100}$/.test(taskId)) return '';

  try {
    const url = new URL(firstConfiguredUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    url.searchParams.set('task', taskId);
    return url.toString();
  } catch {
    return '';
  }
}

function taskButton(taskId: string): string {
  const taskUrl = buildTaskUrl(taskId);
  if (!taskUrl) return '';
  return `
    <p style="margin: 24px 0; text-align: center;">
      <a href="${escapeHtml(taskUrl)}" style="display: inline-block; padding: 12px 20px; color: #ffffff; background: #6d4aff; border-radius: 8px; font-weight: 700; text-decoration: none;">Hape detyrën në Virtuo</a>
    </p>
    <p style="font-size: 12px; color: #777; word-break: break-all;">Nëse butoni nuk hapet, përdor këtë link:<br><a href="${escapeHtml(taskUrl)}">${escapeHtml(taskUrl)}</a></p>
  `;
}

/**
 * Dërgon një njoftim me email kur një punonjësi i caktohet një detyrë e re.
 */
export async function sendTaskAssignedEmail(toEmail: string, employeeName: string, taskTitle: string, creatorName: string, deadline: Date, taskId: string): Promise<boolean> {
  if (!transporter) {
    logMissingConfigurationOnce();
    return false;
  }

  try {
    const safeEmployeeName = escapeHtml(employeeName);
    const safeTaskTitle = escapeHtml(taskTitle);
    const safeCreatorName = escapeHtml(creatorName);
    const formattedDeadline = new Date(deadline).toLocaleString('sq-AL', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const info = await transporter.sendMail({
      from: defaultFrom,
      to: toEmail,
      subject: `Detyrë e Re: ${safeSubject(taskTitle)}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #4A90E2; border-bottom: 2px solid #f5f5f5; padding-bottom: 10px;">Detyrë e re në Virtuo</h2>
          <p>Përshëndetje <strong>${safeEmployeeName}</strong>,</p>
          <p>Menaxheri <strong>${safeCreatorName}</strong> ju ka caktuar një detyrë të re:</p>
          <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #4A90E2; margin: 20px 0; border-radius: 0 4px 4px 0;">
            <h3 style="margin-top: 0; color: #333;">${safeTaskTitle}</h3>
            <p style="margin-bottom: 0; font-size: 14px; color: #666;"><strong>Afati i fundit:</strong> ${formattedDeadline}</p>
          </div>
          <p>Ju lutemi hyni në sistem për të parë detajet dhe për të filluar punën.</p>
          ${taskButton(taskId)}
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #999; text-align: center;">Ky është një email automatik nga sistemi Virtuo. Ju lutemi mos u përgjigjni.</p>
        </div>
      `,
    });
    console.log('Task assigned email sent: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending task assigned email:', error);
    return false;
  }
}

/**
 * Dërgon një njoftim me email te menaxheri kur punonjësi përfundon një detyrë.
 */
export async function sendTaskCompletedEmail(toEmail: string, managerName: string, taskTitle: string, employeeName: string, taskId: string): Promise<boolean> {
  if (!transporter) {
    logMissingConfigurationOnce();
    return false;
  }

  try {
    const safeManagerName = escapeHtml(managerName);
    const safeTaskTitle = escapeHtml(taskTitle);
    const safeEmployeeName = escapeHtml(employeeName);
    const info = await transporter.sendMail({
      from: defaultFrom,
      to: toEmail,
      subject: `Detyra u Përfundua: ${safeSubject(taskTitle)}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #2ECC71; border-bottom: 2px solid #f5f5f5; padding-bottom: 10px;">Detyra u Përfundua</h2>
          <p>Përshëndetje <strong>${safeManagerName}</strong>,</p>
          <p>Punonjësi <strong>${safeEmployeeName}</strong> ka shënuar si të përfunduar detyrën që ju keni krijuar:</p>
          <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #2ECC71; margin: 20px 0; border-radius: 0 4px 4px 0;">
            <h3 style="margin-top: 0; color: #333;">${safeTaskTitle}</h3>
          </div>
          <p>Ju lutemi hyni në sistemin Virtuo për të rishikuar punën e kryer dhe shtojcat nëse ka.</p>
          ${taskButton(taskId)}
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #999; text-align: center;">Ky është një email automatik nga sistemi Virtuo. Ju lutemi mos u përgjigjni.</p>
        </div>
      `,
    });
    console.log('Task completed email sent: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending task completed email:', error);
    return false;
  }
}
