import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

const defaultFrom = process.env.SMTP_FROM || '"Virtuo Task Manager" <no-reply@virtuo.local>';

/**
 * Dërgon një njoftim me email kur një punonjësi i caktohet një detyrë e re.
 */
export async function sendTaskAssignedEmail(toEmail: string, employeeName: string, taskTitle: string, creatorName: string, deadline: Date) {
  try {
    const formattedDeadline = new Date(deadline).toLocaleString('sq-AL', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const info = await transporter.sendMail({
      from: defaultFrom,
      to: toEmail,
      subject: `Detyrë e Re: ${taskTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #4A90E2; border-bottom: 2px solid #f5f5f5; padding-bottom: 10px;">Detyrë e re në Virtuo</h2>
          <p>Përshëndetje <strong>${employeeName}</strong>,</p>
          <p>Menaxheri <strong>${creatorName}</strong> ju ka caktuar një detyrë të re:</p>
          <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #4A90E2; margin: 20px 0; border-radius: 0 4px 4px 0;">
            <h3 style="margin-top: 0; color: #333;">${taskTitle}</h3>
            <p style="margin-bottom: 0; font-size: 14px; color: #666;"><strong>Afati i fundit:</strong> ${formattedDeadline}</p>
          </div>
          <p>Ju lutemi hyni në sistem për të parë detajet dhe për të filluar punën.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #999; text-align: center;">Ky është një email automatik nga sistemi Virtuo. Ju lutemi mos u përgjigjni.</p>
        </div>
      `,
    });
    console.log('Task assigned email sent: %s', info.messageId);
  } catch (error) {
    console.error('Error sending task assigned email:', error);
  }
}

/**
 * Dërgon një njoftim me email te menaxheri kur punonjësi përfundon një detyrë.
 */
export async function sendTaskCompletedEmail(toEmail: string, managerName: string, taskTitle: string, employeeName: string) {
  try {
    const info = await transporter.sendMail({
      from: defaultFrom,
      to: toEmail,
      subject: `Detyra u Përfundua: ${taskTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #2ECC71; border-bottom: 2px solid #f5f5f5; padding-bottom: 10px;">Detyra u Përfundua</h2>
          <p>Përshëndetje <strong>${managerName}</strong>,</p>
          <p>Punonjësi <strong>${employeeName}</strong> ka shënuar si të përfunduar detyrën që ju keni krijuar:</p>
          <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #2ECC71; margin: 20px 0; border-radius: 0 4px 4px 0;">
            <h3 style="margin-top: 0; color: #333;">${taskTitle}</h3>
          </div>
          <p>Ju lutemi hyni në sistemin Virtuo për të rishikuar punën e kryer dhe shtojcat nëse ka.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #999; text-align: center;">Ky është një email automatik nga sistemi Virtuo. Ju lutemi mos u përgjigjni.</p>
        </div>
      `,
    });
    console.log('Task completed email sent: %s', info.messageId);
  } catch (error) {
    console.error('Error sending task completed email:', error);
  }
}
