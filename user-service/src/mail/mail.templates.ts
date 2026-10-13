const layout = (title: string, content: string) => `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f4f7fb;color:#172033;font-family:Arial,sans-serif;">
    <div style="padding:40px 16px;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5eaf2;border-radius:16px;overflow:hidden;">
        <div style="padding:28px 32px;background:#172033;color:#ffffff;">
          <div style="font-size:20px;font-weight:700;">ft_transcendence</div>
        </div>
        <div style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:26px;">${title}</h1>
          ${content}
        </div>
        <div style="padding:20px 32px;background:#f8fafc;color:#667085;font-size:12px;">
          This message was sent automatically. If you did not request it, you can ignore it.
        </div>
      </div>
    </div>
  </body>
</html>`;

const actionButton = (link: string, label: string) =>
  `<a href="${link}" style="display:inline-block;padding:13px 20px;background:#4f46e5;color:#ffffff;border-radius:9px;text-decoration:none;font-weight:700;">${label}</a>`;

export function verificationEmailTemplate(link: string) {
  return layout(
    'Verify your email',
    `<p style="margin:0 0 24px;line-height:1.6;">Thanks for joining us. Confirm your email address to finish setting up your account.</p>
     ${actionButton(link, 'Verify email')}
     <p style="margin:24px 0 0;color:#667085;font-size:13px;line-height:1.5;">If the button does not work, copy and paste this link into your browser:<br>${link}</p>`,
  );
}

export function passwordResetEmailTemplate(link: string) {
  return layout(
    'Reset your password',
    `<p style="margin:0 0 24px;line-height:1.6;">We received a request to reset your password. Use the button below to choose a new one.</p>
     ${actionButton(link, 'Reset password')}
     <p style="margin:24px 0 0;color:#667085;font-size:13px;line-height:1.5;">If you did not request this, no action is needed. Your password will remain unchanged.</p>
     <p style="margin:12px 0 0;color:#667085;font-size:13px;line-height:1.5;">If the button does not work, copy and paste this link into your browser:<br>${link}</p>`,
  );
}
